import { canonicalJsonString } from '../../canonicalJson';
import type {
  CompilationReceipt,
  IntentProgramSource,
  IntentProgramSourceV1,
  ProjectDocument
} from '../../model';
import {
  INTENT_PROGRAM_COMPILER_VERSION,
  INTENT_PROGRAM_SOURCE_VERSION,
  INTENT_PROGRAM_SPECIFICATION_VERSION,
  type IntentProgramRasterProjection,
  type IntentProgramProvenanceIssue,
  type IntentProgramReceiptExpectation
} from './contract';
import { sha256ByteDigest, sha256Digest } from './digest';
import { rasterizeTexture } from '../../textures/textureRecipe/raster';
import { SURFACE_SYNTHESIS_VERSION } from '../../textures/appearance/contract';

interface IntentProgramParsedSource {
  readonly source: string;
  readonly hash: string;
}

export const intentProgramReviewDigest = (
  source: IntentProgramSource
): string => source.receipt.sourceDigest;

export const intentProgramRasterProjection = (
  document: ProjectDocument
): readonly IntentProgramRasterProjection[] => Object.values(document.textures)
  .filter((texture) => texture.atlasMode === 'generate')
  .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  .map((texture) => ({
    id: texture.id,
    width: texture.width,
    height: texture.height,
    sampling: texture.sampling,
    colorSpace: texture.colorSpace,
    renderMode: texture.renderMode,
    synthesisVersion: SURFACE_SYNTHESIS_VERSION,
    rgbaDigest: sha256ByteDigest(rasterizeTexture(document, texture).rgba)
  }));

const compilerTextureProjection = (
  document: ProjectDocument
): unknown => Object.fromEntries(
  Object.entries(document.textures).map(([id, texture]) => {
    if (texture.atlasMode !== 'generate') return [id, texture];
    const { source, ...compiled } = texture;
    return [id, {
      ...compiled,
      source: {
        contentType: source.contentType,
        ...(source.byteLength === undefined
          ? {}
          : { byteLength: source.byteLength })
      }
    }];
  })
);

const compilerAnimationProjection = (
  document: ProjectDocument
): unknown => Object.fromEntries(
  Object.entries(document.animations).map(([id, animation]) => {
    if (
      id !== 'idle' ||
      animation.name !== `animation.${document.id}.idle`
    ) return [id, animation];
    const { name: _runtimeName, ...compiled } = animation;
    return [id, compiled];
  })
);

export const intentProgramOutputProjection = (
  document: ProjectDocument
): unknown => ({
  settings: {
    textureResolution: document.settings.textureResolution
  },
  intent: document.intent,
  authoringProfile: document.authoringProfile,
  modeling: document.modeling,
  scene: document.scene,
  // Generated blob locators and clip display names are host/session identity,
  // not source-owned compiler semantics. Raw raster bytes remain receipt-bound.
  textures: compilerTextureProjection(document),
  animations: compilerAnimationProjection(document),
  generatedRasters: intentProgramRasterProjection(document)
});

export const intentProgramOutputDigest = (
  document: ProjectDocument
): string => sha256Digest(
  canonicalJsonString(intentProgramOutputProjection(document))
);

export const validateIntentProgramReceipt = (
  source: IntentProgramSourceV1,
  expected: IntentProgramReceiptExpectation
): readonly IntentProgramProvenanceIssue[] => {
  const issues: IntentProgramProvenanceIssue[] = [];
  const checks = [
    ['sourceDigest', sha256Digest(expected.source), 'Intent Program source digest does not match its source.'],
    ['semanticDigest', sha256Digest(expected.semanticCanonical), 'Intent Program semantic digest does not match its normalized program.'],
    ['compilerVersion', INTENT_PROGRAM_COMPILER_VERSION, 'Intent Program compiler version is unsupported.'],
    ['specificationVersion', INTENT_PROGRAM_SPECIFICATION_VERSION, 'Intent Program specification version is unsupported.']
  ] as const;
  for (const [key, value, message] of checks) {
    if (source.receipt[key] !== value) {
      issues.push({ path: `receipt.${key}`, message });
    }
  }
  if (
    expected.outputDigest !== undefined &&
    source.receipt.outputDigest !== expected.outputDigest
  ) {
    issues.push({
      path: 'receipt.outputDigest',
      message: 'Intent Program output digest does not match its compiler output.'
    });
  }
  return issues;
};

export const createCompilationReceiptFromDigest = (
  source: string,
  semanticCanonical: string,
  outputDigest: string
): CompilationReceipt => ({
  sourceDigest: sha256Digest(source),
  semanticDigest: sha256Digest(semanticCanonical),
  compilerVersion: INTENT_PROGRAM_COMPILER_VERSION,
  specificationVersion: INTENT_PROGRAM_SPECIFICATION_VERSION,
  outputDigest
});

export const createCompilationReceipt = (
  source: string,
  semanticCanonical: string,
  output: ProjectDocument
): CompilationReceipt => createCompilationReceiptFromDigest(
  source,
  semanticCanonical,
  intentProgramOutputDigest(output)
);

export const createIntentProgramSourceV1FromDigest = (
  candidate: IntentProgramParsedSource,
  semanticCanonical: string,
  outputDigest: string
): IntentProgramSourceV1 => ({
  version: INTENT_PROGRAM_SOURCE_VERSION,
  source: candidate.source,
  hash: candidate.hash,
  receipt: createCompilationReceiptFromDigest(
    candidate.source,
    semanticCanonical,
    outputDigest
  )
});

export const createIntentProgramSourceV1 = (
  candidate: IntentProgramParsedSource,
  semanticCanonical: string,
  output: ProjectDocument
): IntentProgramSourceV1 => createIntentProgramSourceV1FromDigest(
  candidate,
  semanticCanonical,
  intentProgramOutputDigest(output)
);
