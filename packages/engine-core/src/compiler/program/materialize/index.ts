import { createAuthoringProfile } from '../../../authoring/profile';
import { evaluateAuthoringPlan } from '../../../authoring/plan';
import type {
  ProjectDocument
} from '../../../model';
import { normalizeProjectIntent } from '../../../project/intent';
import { projectSpatialFrame } from '../../../project/frame';
import { materializeCompilerParts } from './parts';
import { parseIntentProgram } from '../../../project/program';
import { deriveGeneratedTextures } from '../../../textures/textureRecipe';
import { compileIntentProgram } from '../lower';
import { compileCanonicalIdle } from '../motion';
import { sourcePathForCompilerIssue } from '../source/owner';
import type { IntentProgramCompilerPlan } from '../contract';

export interface IntentProgramMaterializationError {
  message: string;
  path: string;
}

export type MaterializeIntentProgramResult =
  | { ok: true; document: ProjectDocument }
  | { ok: false; error: IntentProgramMaterializationError };

/** Ephemeral parsed source passed into materialization before a receipt exists. */
export interface IntentProgramMaterializationSource {
  readonly source: string;
  readonly hash: string;
}

const failure = (
  message: string,
  path: string
): MaterializeIntentProgramResult => ({ ok: false, error: { message, path } });

const compileSeed = (
  seed: ProjectDocument,
  plan: IntentProgramCompilerPlan
): MaterializeIntentProgramResult => {
  const profile = createAuthoringProfile(seed, plan.authoring);
  if (!profile.ok) {
    const issue = profile.issues[0];
    return failure(
      issue?.message ?? 'Compiler output failed authoring normalization.',
      sourcePathForCompilerIssue(
        issue?.path ?? 'authoringProfile',
        plan.recipe.parts
      )
    );
  }
  const materialized = materializeCompilerParts(
    { ...seed, authoringProfile: profile.profile },
    {
      parts: plan.recipe.parts,
      materials: plan.recipe.materials
    },
    {
      attachmentDerivation: plan.attachmentReflections.length === 0
        ? undefined
        : {
            reflection: {
              frame: projectSpatialFrame(plan.projectIntent),
              pairs: plan.attachmentReflections
            }
          }
    }
  );
  if (!materialized.ok) {
    return failure(
      materialized.error.message,
      sourcePathForCompilerIssue(
        materialized.error.path ?? 'modeling',
        plan.recipe.parts
      )
    );
  }
  const idle = compileCanonicalIdle(
    materialized.value.document,
    plan.program.animation.idle,
    plan.motionTargetPartId
  );
  if (!idle) {
    return failure(
      'Compiler output has no root part for canonical idle.',
      'modeling.parts'
    );
  }
  return {
    ok: true,
    document: {
      ...materialized.value.document,
      animations: { idle }
    }
  };
};

const sameTextureResolution = (
  left: ProjectDocument,
  right: ProjectDocument
): boolean =>
  left.settings.textureResolution.width === right.settings.textureResolution.width &&
  left.settings.textureResolution.height === right.settings.textureResolution.height;

/** Materializes one already-validated immutable compiler plan without replay. */
export const materializeCompiledIntentProgram = (
  document: ProjectDocument,
  _source: IntentProgramMaterializationSource,
  plan: IntentProgramCompilerPlan
): MaterializeIntentProgramResult => {
  const normalizedIntent = normalizeProjectIntent(plan.projectIntent);
  if (!normalizedIntent.ok) {
    const issue = normalizedIntent.issues[0];
    return failure(
      issue?.message ?? 'Compiler intent projection is invalid.',
      issue?.path ?? 'intent'
    );
  }

  const {
    intent: _intent,
    intentProgram: _intentProgram,
    intentProgramProposal: _intentProgramProposal,
    authoringProfile: _authoringProfile,
    modeling: _modeling,
    scene: _scene,
    textures: _textures,
    animations: _animations,
    ...identity
  } = document;
  const seed: ProjectDocument = {
    ...identity,
    ...(document.intentProgram
      ? { intentProgram: document.intentProgram }
      : {}),
    intent: normalizedIntent.intent,
    scene: { roots: [], nodes: {} },
    textures: {},
    animations: {}
  };
  let currentSeed = seed;
  for (let pass = 0; pass < 3; pass += 1) {
    const output = compileSeed(currentSeed, plan);
    if (!output.ok) return output;
    const textured = deriveGeneratedTextures(output.document);
    if (!textured.ok) {
      return failure(textured.message, textured.path ?? 'textures');
    }
    if (sameTextureResolution(output.document, textured.document)) {
      const authoring = evaluateAuthoringPlan(textured.document);
      if (!authoring.ready) {
        const issue = authoring.issues[0];
        return failure(
          issue?.message ?? 'Compiler output is not mechanically ready.',
          sourcePathForCompilerIssue(
            issue?.path ?? 'authoringProfile',
            plan.recipe.parts
          )
        );
      }
      return { ok: true, document: textured.document };
    }
    currentSeed = {
      ...seed,
      settings: {
        ...seed.settings,
        textureResolution: textured.document.settings.textureResolution
      }
    };
  }
  return failure(
    'Compiler texture layout did not converge from the Intent Program.',
    'textures'
  );
};

/**
 * Rebuilds every compiler-owned field from source in a fresh seed. No previous
 * recipe, scene node, material, or animation participates in the result.
 */
export const materializeIntentProgram = (
  document: ProjectDocument,
  source: IntentProgramMaterializationSource
): MaterializeIntentProgramResult => {
  const parsed = parseIntentProgram(source.source);
  const parseIssue = parsed.diagnostics.find(
    (diagnostic) => diagnostic.severity === 'error'
  );
  if (!parsed.ir || parseIssue || parsed.hash !== source.hash) {
    return failure(
      parseIssue?.message ?? 'Intent Program hash does not match its source.',
      parseIssue
        ? `intentProgram.source:${parseIssue.span.start.line}:${parseIssue.span.start.column}`
        : 'intentProgram.hash'
    );
  }
  const compiled = compileIntentProgram({
    program: parsed.ir,
    sourceMap: parsed.sourceMap
  });
  if (!compiled.ok) {
    const issue = compiled.diagnostics[0];
    return failure(
      issue?.message ?? 'Intent Program could not be compiled.',
      issue
        ? `intentProgram.source:${issue.span.start.line}:${issue.span.start.column}`
        : 'intentProgram.source'
    );
  }
  return materializeCompiledIntentProgram(
    document,
    source,
    compiled.plan
  );
};
