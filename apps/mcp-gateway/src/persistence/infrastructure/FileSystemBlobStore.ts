import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BlobPointer, BlobReadResult, BlobStore, BlobWriteInput } from '@ashfox/backend-core';

type BlobMeta = {
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  updatedAt: string;
};

const normalizePathSegment = (value: string, field: 'bucket' | 'key'): string => {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    throw new Error(`${field} must be a non-empty path segment.`);
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`${field} must not contain relative path segments.`);
  }
  return segments.join('/');
};

const resolveSafePath = (rootDir: string, bucket: string, key: string): string => {
  const absoluteRoot = path.resolve(rootDir);
  const fullPath = path.resolve(absoluteRoot, bucket, ...key.split('/'));
  const rootPrefix = `${absoluteRoot}${path.sep}`;
  if (fullPath !== absoluteRoot && !fullPath.startsWith(rootPrefix)) {
    throw new Error('Blob path resolved outside the configured storage root.');
  }
  return fullPath;
};

const loadMeta = async (metaPath: string): Promise<BlobMeta | null> => {
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BlobMeta>;
    if (!parsed || typeof parsed.contentType !== 'string' || typeof parsed.updatedAt !== 'string') {
      return null;
    }
    return {
      contentType: parsed.contentType,
      cacheControl: parsed.cacheControl,
      metadata: parsed.metadata,
      updatedAt: parsed.updatedAt
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
};

export class FileSystemBlobStore implements BlobStore {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async put(input: BlobWriteInput): Promise<BlobPointer> {
    const bucket = normalizePathSegment(input.bucket, 'bucket');
    const key = normalizePathSegment(input.key, 'key');
    const blobPath = resolveSafePath(this.rootDir, bucket, key);
    const metaPath = `${blobPath}.meta.json`;
    const meta: BlobMeta = {
      contentType: input.contentType,
      cacheControl: input.cacheControl,
      metadata: input.metadata,
      updatedAt: new Date().toISOString()
    };
    await fs.mkdir(path.dirname(blobPath), { recursive: true });
    await fs.writeFile(blobPath, input.bytes);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    return { bucket, key };
  }

  async get(pointer: BlobPointer): Promise<BlobReadResult | null> {
    const bucket = normalizePathSegment(pointer.bucket, 'bucket');
    const key = normalizePathSegment(pointer.key, 'key');
    const blobPath = resolveSafePath(this.rootDir, bucket, key);
    const metaPath = `${blobPath}.meta.json`;
    try {
      const bytes = await fs.readFile(blobPath);
      const meta = await loadMeta(metaPath);
      return {
        bucket,
        key,
        bytes,
        contentType: meta?.contentType ?? 'application/octet-stream',
        cacheControl: meta?.cacheControl,
        metadata: meta?.metadata,
        updatedAt: meta?.updatedAt
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(pointer: BlobPointer): Promise<void> {
    const bucket = normalizePathSegment(pointer.bucket, 'bucket');
    const key = normalizePathSegment(pointer.key, 'key');
    const blobPath = resolveSafePath(this.rootDir, bucket, key);
    const metaPath = `${blobPath}.meta.json`;
    try {
      await fs.unlink(blobPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
    try {
      await fs.unlink(metaPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
