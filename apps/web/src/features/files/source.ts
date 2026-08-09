import {
  ASHFOX_PROJECT_FILE_CONTENT_TYPE,
  ASHFOX_PROJECT_FILE_EXTENSION,
  INTENT_PROGRAM_SOURCE_MAX_LENGTH,
  openProjectFile,
  serializeProjectFile,
  type IntentProgramDiagnostic,
  type ProjectDocument,
  type ProjectFileIdentitySeed
} from '@ashfox/engine-core';

import {
  createArtifactBinding,
  safeArtifactName,
  type ArtifactFile
} from './artifactFile';

const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
const MAX_SOURCE_BYTES = INTENT_PROGRAM_SOURCE_MAX_LENGTH * 4 + 3;
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08]
] as const;

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[]
): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const diagnosticText = (
  diagnostics: readonly IntentProgramDiagnostic[]
): string => diagnostics.map((entry) =>
  `${entry.span.start.line}:${entry.span.start.column} ` +
  `[${entry.code}] ${entry.message}`
).join('\n');

const projectFileError = (
  diagnostics: readonly IntentProgramDiagnostic[]
): Error => new Error(
  `Intent Program could not be compiled:\n${diagnosticText(diagnostics)}`
);

/** Compiles decoded source without mutating the current Workbench session. */
export const openProjectSource = (
  source: string,
  identity: ProjectFileIdentitySeed
): ProjectDocument => {
  const result = openProjectFile({ source, identity });
  if (!result.ok) throw projectFileError(result.diagnostics);
  return result.document;
};

/** Decodes one source-only project file. ZIP archives and lossy UTF-8 fail. */
export const readProjectSource = (
  bytes: Uint8Array,
  identity: ProjectFileIdentitySeed
): ProjectDocument => {
  if (ZIP_SIGNATURES.some((signature) => startsWith(bytes, signature))) {
    throw new Error(
      'ZIP-based .ashfox files are not supported. Open an Intent Program 1 source file.'
    );
  }
  if (bytes.byteLength > MAX_SOURCE_BYTES) {
    throw new Error(
      `Intent Program source exceeds the ${INTENT_PROGRAM_SOURCE_MAX_LENGTH}-character limit.`
    );
  }
  if (startsWith(bytes, UTF8_BOM)) {
    throw new Error(
      'Intent Program source must be UTF-8 without a byte-order mark.'
    );
  }
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Intent Program source is not valid UTF-8.');
  }
  return openProjectSource(source, identity);
};

export const createOpenIdentity = (
  createdAt: string = new Date().toISOString(),
  projectId: string = `project-${crypto.randomUUID()}`
): ProjectFileIdentitySeed => ({
  id: projectId,
  revision: 'local-0001',
  createdAt
});

export const parseProjectFile = async (
  file: File,
  identity: ProjectFileIdentitySeed = createOpenIdentity()
): Promise<ProjectDocument> => {
  if (!file.name.toLowerCase().endsWith(ASHFOX_PROJECT_FILE_EXTENSION)) {
    throw new Error(
      `Project files must use the ${ASHFOX_PROJECT_FILE_EXTENSION} extension.`
    );
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(
      `Intent Program source exceeds the ${INTENT_PROGRAM_SOURCE_MAX_LENGTH}-character limit.`
    );
  }
  return readProjectSource(
    new Uint8Array(await file.arrayBuffer()),
    identity
  );
};

/** Emits only the exact confirmed Intent Program source bytes. */
export const createProjectArtifact = async (
  document: ProjectDocument
): Promise<ArtifactFile> => {
  const serialized = serializeProjectFile(document);
  if (!serialized.ok) throw new Error(serialized.error.message);
  const bytes = new TextEncoder().encode(serialized.source);
  return {
    ...await createArtifactBinding(document, bytes),
    kind: 'project',
    name: `${safeArtifactName(document.name)}${ASHFOX_PROJECT_FILE_EXTENSION}`,
    bytes,
    contentType: ASHFOX_PROJECT_FILE_CONTENT_TYPE
  };
};
