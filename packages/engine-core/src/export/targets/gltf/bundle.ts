import type { ExportAdaptedDocument } from '../../adapter';
import type { InvariantFinding } from '../../../validation/types';
import { createCompactJsonExportFile } from '../../json';
import { createExportBundle } from '../../pipeline/createBundle';
import type {
  BinaryExportFile,
  ExportBundle
} from '../../types';
import type { CompiledGltf } from './buildTypes';
import { buildGlb } from './glb';

export const createGltfBundle = (
  document: ExportAdaptedDocument,
  compiled: CompiledGltf,
  findings: readonly InvariantFinding[]
): ExportBundle => {
  const profile = document.formatProfile;
  if (profile.id !== 'gltf.2') {
    throw new Error('Project does not use the gltf.2 profile.');
  }
  const modelPath = `${profile.modelPath}.${profile.container}`;
  const binaryPath = `${profile.modelPath}.bin`;
  const modelFile =
    profile.container === 'gltf'
      ? createCompactJsonExportFile(
          'model',
          modelPath,
          compiled.document,
          'model/gltf+json'
        )
      : ({
          kind: 'binary',
          role: 'model',
          path: modelPath,
          contentType: 'model/gltf-binary',
          data: buildGlb(compiled.document, compiled.binary)
        } satisfies BinaryExportFile);
  const binaryFiles: BinaryExportFile[] =
    profile.container === 'gltf' && compiled.binary.byteLength > 0
      ? [{
          kind: 'binary',
          role: 'buffer',
          path: binaryPath,
          contentType: 'application/octet-stream',
          data: compiled.binary
        }]
      : [];

  return createExportBundle(document, findings, {
    target: {
      id: 'gltf.2',
      version: profile.version
    },
    rootPath: 'gltf',
    entrypoints: [modelPath],
    files: [
      modelFile,
      ...binaryFiles,
      ...compiled.textureFiles
    ]
  });
};
