import {
  parseProjectDocument,
  type ProjectDocument,
  type TextureAsset
} from '@ashfox/engine-core';

import {
  type ProjectAsset,
  type ProjectAssets
} from '../../application/projectAssets';
import {
  createStoredZip,
  readStoredZip,
  type ZipEntry
} from './zip';

const ARCHIVE_FORMAT = 'ashfox.project';
const MANIFEST_PATH = 'manifest.json';
const PROJECT_PATH = 'project.json';
const MAX_PROJECT_JSON_BYTES = 8 * 1024 * 1024;
const MAX_TEXTURE_BYTES = 32 * 1024 * 1024;

interface ArchiveAssetEntry {
  textureId: string;
  path: string;
}

interface ArchiveManifest {
  format: typeof ARCHIVE_FORMAT;
  project: typeof PROJECT_PATH;
  assets: readonly ArchiveAssetEntry[];
}

export interface ProjectArchiveFile {
  document: ProjectDocument;
  assets: ProjectAssets;
}

export type TextureAssetResolver = (
  texture: TextureAsset
) => Promise<ProjectAsset>;

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseManifest = (bytes: Uint8Array): ArchiveManifest => {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('ashfox manifest is not valid JSON.');
  }
  if (
    !isRecord(value) ||
    value.format !== ARCHIVE_FORMAT ||
    value.project !== PROJECT_PATH ||
    !Array.isArray(value.assets)
  ) {
    throw new Error('ashfox manifest has an invalid structure.');
  }
  const assets: ArchiveAssetEntry[] = value.assets.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.textureId !== 'string' ||
      entry.textureId.length === 0 ||
      typeof entry.path !== 'string' ||
      !entry.path.startsWith('assets/')
    ) {
      throw new Error('ashfox manifest contains an invalid texture asset.');
    }
    return {
      textureId: entry.textureId,
      path: entry.path
    };
  });
  const textureIds = new Set(assets.map((asset) => asset.textureId));
  const paths = new Set(assets.map((asset) => asset.path));
  if (textureIds.size !== assets.length || paths.size !== assets.length) {
    throw new Error('ashfox manifest contains duplicate texture assets.');
  }
  return {
    format: ARCHIVE_FORMAT,
    project: PROJECT_PATH,
    assets
  };
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
};

const extensionForContentType = (contentType: string): string => {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    default:
      throw new Error(
        `Texture content type "${contentType}" cannot be stored in an ashfox project.`
      );
  }
};

const startsWithBytes = (
  bytes: Uint8Array,
  signature: readonly number[]
): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const assertTextureBytes = (
  contentType: string,
  bytes: Uint8Array
): void => {
  const valid = contentType === 'image/png'
    ? startsWithBytes(bytes, [137, 80, 78, 71, 13, 10, 26, 10])
    : contentType === 'image/jpeg'
      ? startsWithBytes(bytes, [255, 216, 255])
      : false;
  if (!valid) {
    throw new Error(
      `Texture bytes do not match content type "${contentType}".`
    );
  }
};

const encodeJson = (value: unknown): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

export const createProjectArchive = async (
  document: ProjectDocument,
  resolveTexture: TextureAssetResolver
): Promise<Uint8Array> => {
  const orderedTextures = Object.values(document.textures).sort(
    (left, right) => left.id.localeCompare(right.id)
  );
  const resolved = await Promise.all(
    orderedTextures.map(async (texture, index) => {
      const asset = await resolveTexture(texture);
      if (
        asset.contentType !== texture.source.contentType ||
        asset.bytes.length === 0 ||
        asset.bytes.length > MAX_TEXTURE_BYTES
      ) {
        throw new Error(
          `Texture "${texture.name}" has invalid archive bytes.`
        );
      }
      assertTextureBytes(asset.contentType, asset.bytes);
      const extension = extensionForContentType(asset.contentType);
      return {
        texture,
        asset,
        path: `assets/texture-${String(index + 1).padStart(4, '0')}.${extension}`,
        contentHash: await sha256(asset.bytes)
      };
    })
  );

  const textures = { ...document.textures };
  for (const entry of resolved) {
    textures[entry.texture.id] = {
      ...entry.texture,
      source: {
        ...entry.texture.source,
        contentHash: entry.contentHash,
        byteLength: entry.asset.bytes.length
      }
    };
  }
  const archivedDocument: ProjectDocument = {
    ...document,
    textures
  };
  const projectBytes = encodeJson(archivedDocument);
  if (projectBytes.length > MAX_PROJECT_JSON_BYTES) {
    throw new Error('ashfox project JSON exceeds the 8 MB limit.');
  }
  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    project: PROJECT_PATH,
    assets: resolved.map((entry) => ({
      textureId: entry.texture.id,
      path: entry.path
    }))
  };
  return createStoredZip([
    { path: MANIFEST_PATH, bytes: encodeJson(manifest) },
    { path: PROJECT_PATH, bytes: projectBytes },
    ...resolved.map((entry) => ({
      path: entry.path,
      bytes: entry.asset.bytes
    }))
  ]);
};

const entryMap = (
  entries: readonly ZipEntry[]
): ReadonlyMap<string, Uint8Array> =>
  new Map(entries.map((entry) => [entry.path, entry.bytes]));

const requiredEntry = (
  entries: ReadonlyMap<string, Uint8Array>,
  path: string
): Uint8Array => {
  const bytes = entries.get(path);
  if (!bytes) throw new Error(`ashfox archive entry "${path}" is missing.`);
  return bytes;
};

export const readProjectArchive = async (
  bytes: Uint8Array
): Promise<ProjectArchiveFile> => {
  const entries = readStoredZip(bytes);
  const byPath = entryMap(entries);
  const manifest = parseManifest(requiredEntry(byPath, MANIFEST_PATH));
  const projectBytes = requiredEntry(byPath, manifest.project);
  if (projectBytes.length > MAX_PROJECT_JSON_BYTES) {
    throw new Error('ashfox project JSON exceeds the 8 MB limit.');
  }

  let rawDocument: unknown;
  try {
    rawDocument = JSON.parse(new TextDecoder().decode(projectBytes));
  } catch {
    throw new Error('ashfox project JSON is invalid.');
  }
  const document = parseProjectDocument(rawDocument);
  const documentTextureIds = Object.keys(document.textures).sort(
    (left, right) => left.localeCompare(right)
  );
  const manifestTextureIds = manifest.assets
    .map((asset) => asset.textureId)
    .sort((left, right) => left.localeCompare(right));
  if (
    documentTextureIds.length !== manifestTextureIds.length ||
    documentTextureIds.some(
      (textureId, index) => textureId !== manifestTextureIds[index]
    )
  ) {
    throw new Error(
      'ashfox manifest texture set does not match the project document.'
    );
  }

  const assets: Record<string, ProjectAsset> = {};
  const allowedPaths = new Set([MANIFEST_PATH, PROJECT_PATH]);
  for (const manifestAsset of manifest.assets) {
    const texture = document.textures[manifestAsset.textureId];
    const assetBytes = requiredEntry(byPath, manifestAsset.path);
    allowedPaths.add(manifestAsset.path);
    if (
      assetBytes.length === 0 ||
      assetBytes.length > MAX_TEXTURE_BYTES ||
      texture.source.byteLength !== assetBytes.length ||
      texture.source.contentHash !== await sha256(assetBytes)
    ) {
      throw new Error(
        `Texture "${manifestAsset.textureId}" failed archive integrity validation.`
      );
    }
    const extension = extensionForContentType(texture.source.contentType);
    if (!manifestAsset.path.endsWith(`.${extension}`)) {
      throw new Error(
        `Texture "${manifestAsset.textureId}" has an invalid archive path.`
      );
    }
    assertTextureBytes(texture.source.contentType, assetBytes);
    assets[manifestAsset.textureId] = {
      contentType: texture.source.contentType,
      bytes: assetBytes
    };
  }
  const unexpected = entries.find((entry) => !allowedPaths.has(entry.path));
  if (unexpected) {
    throw new Error(
      `ashfox archive contains unexpected entry "${unexpected.path}".`
    );
  }
  return {
    document,
    assets
  };
};
