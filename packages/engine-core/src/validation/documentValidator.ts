import {
  isCurrentInternalContractVersion
} from '@ashfox/internal-contracts';

import {
  isSurfacePixelDensity,
  type ProjectDocument
} from '../model';
import {
  readAuthoringProfile
} from '../authoring/authoringProfile';
import { evaluateAuthoringPlan } from '../authoring/authoringPlan';
import { readProjectIntent } from '../project/projectIntent';
import { canonicalJsonString } from '../canonicalJson';
import { parseIntentProgram } from '../project/intentProgram';
import { materializeIntentProgram } from '../compiler/intentProgram/materialize';
import { isNonEmptyString } from './shared/value';
import type { FindingSink } from './types';

const validateIdentity = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  for (const [path, value] of [
    ['id', document.id],
    ['name', document.name],
    ['revision', document.revision]
  ] as const) {
    if (!isNonEmptyString(value)) {
      add({
        code: 'document.required_value',
        severity: 'error',
        message: `${path} must be a non-empty string.`,
        path
      });
    }
  }
};

const validateIntent = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const result = readProjectIntent(document);
  if (result.ok) return;
  for (const issue of result.issues) {
    add({
      code: 'document.invalid_intent',
      severity: 'error',
      message: issue.message,
      path: issue.path === 'intent' ? issue.path : `intent.${issue.path}`,
      fix: 'Correct and recompile the confirmed Intent Program source.'
    });
  }
};

const validateIntentPrograms = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  for (const [path, program] of [
    ['intentProgram', document.intentProgram],
    ['intentProgramProposal', document.intentProgramProposal]
  ] as const) {
    if (!program) continue;
    const parsed = parseIntentProgram(program.source);
    const issue = parsed.diagnostics.find(
      (diagnostic) => diagnostic.severity === 'error'
    );
    if (issue || parsed.hash !== program.hash) {
      add({
        code: 'document.invalid_intent',
        severity: 'error',
        message: issue?.message ?? 'Intent Program hash does not match its source.',
        path: issue
          ? `${path}.source:${issue.span.start.line}:${issue.span.start.column}`
          : `${path}.hash`,
        fix: 'Submit the complete source through intent.program.propose, then compile that displayed hash.'
      });
    }
  }

  // A pending program can become the authoritative source immediately after
  // user confirmation. Imports must not admit a source the compiler itself
  // cannot materialize.
  const proposal = document.intentProgramProposal;
  if (!proposal) return;
  const parsed = parseIntentProgram(proposal.source);
  const parseIssue = parsed.diagnostics.find(
    (diagnostic) => diagnostic.severity === 'error'
  );
  if (parseIssue || parsed.hash !== proposal.hash) return;
  const materialized = materializeIntentProgram(document, proposal);
  if (materialized.ok) return;
  add({
    code: 'document.invalid_intent',
    severity: 'error',
    message:
      `Pending Intent Program cannot be compiled: ${materialized.error.message}`,
    path: materialized.error.path.startsWith('intentProgram')
      ? materialized.error.path.replace(
          /^intentProgram/,
          'intentProgramProposal'
        )
      : 'intentProgramProposal',
    fix: 'Replace the pending source with one complete Intent Program that can compile atomically.'
  });
};

const compilerOwnedFieldsEqual = (
  document: ProjectDocument,
  expected: ProjectDocument
): boolean => canonicalJsonString({
  intent: document.intent,
  authoringProfile: document.authoringProfile,
  modeling: document.modeling,
  scene: document.scene,
  textures: document.textures,
  animations: document.animations
}) === canonicalJsonString({
  intent: expected.intent,
  authoringProfile: expected.authoringProfile,
  modeling: expected.modeling,
  scene: expected.scene,
  textures: expected.textures,
  animations: expected.animations
});

const hasMaterializedAsset = (document: ProjectDocument): boolean =>
  document.modeling !== undefined ||
  document.authoringProfile !== undefined ||
  Object.keys(document.scene.nodes).length > 0 ||
  Object.keys(document.textures).length > 0 ||
  Object.keys(document.animations).length > 0;

/** Source is the only persisted modeling authority. Every derived cache must
 * exactly reproduce from it, including on archive import and local restore. */
const validateCompilerAuthority = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  if (!document.intentProgram) {
    if (
      document.intent !== undefined ||
      hasMaterializedAsset(document)
    ) {
      add({
        code: 'document.invalid_intent',
        severity: 'error',
        message: 'A semantic intent, profile, or generated model requires one confirmed Intent Program source.',
        path: 'intentProgram',
        fix: 'Create or import the asset through one Intent Program, then compile it.'
      });
    }
    return;
  }
  const materialized = materializeIntentProgram(document, document.intentProgram);
  if (!materialized.ok) {
    add({
      code: 'document.invalid_intent',
      severity: 'error',
      message: `Confirmed Intent Program cannot reproduce its compiler output: ${materialized.error.message}`,
      path: materialized.error.path,
      fix: 'Correct the Intent Program source and compile it again.'
    });
    return;
  }
  if (!compilerOwnedFieldsEqual(document, materialized.document)) {
    add({
      code: 'document.invalid_intent',
      severity: 'error',
      message: 'Stored project output does not exactly match the confirmed Intent Program compilation.',
      path: 'intentProgram',
      fix: 'Recompile the confirmed source; direct intent, profile, scene, texture, material, and animation edits are not permitted.'
    });
  }
};

const validateAuthoringProfile = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const result = readAuthoringProfile(document);
  if (result.ok) return;
  for (const issue of result.issues) {
    add({
      code: 'document.invalid_authoring_profile',
      severity: 'error',
      message: issue.message,
      path:
        issue.path === 'authoringProfile' ||
        issue.path.startsWith('authoringProfile.')
          ? issue.path
          : `authoringProfile.${issue.path}`,
      fix: 'Correct and recompile the confirmed Intent Program source.'
    });
  }
};

const validateMaterializedAuthoringInvariants = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  if (!document.authoringProfile || !document.modeling) return;
  const evaluation = evaluateAuthoringPlan(document);
  const quality = evaluation.assetQuality;
  if (!quality) return;
  const violations = [
    ...quality.symmetryQuality.violations,
    ...quality.supportQuality.violations,
    ...quality.spanQuality.violations,
    ...quality.restPoseQuality.violations,
    ...quality.faceQuality.violations
  ];
  for (const issue of violations) {
    add({
      code: 'document.invalid_authoring_invariant',
      severity: 'error',
      message: issue.message,
      path: issue.path,
      ...(issue.partIds ? { entityIds: issue.partIds } : {}),
      fix: issue.expected
    });
  }
};

const validateSettings = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const { width, height } = document.settings.textureResolution;
  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    add({
      code: 'document.invalid_setting',
      severity: 'error',
      message: 'Texture resolution must use positive integer dimensions.',
      path: 'settings.textureResolution'
    });
  }
  if (!isSurfacePixelDensity(document.settings.surfacePixelDensity)) {
    add({
      code: 'document.invalid_setting',
      severity: 'error',
      message: 'Surface pixel density must be 1, 2, or 4.',
      path: 'settings.surfacePixelDensity'
    });
  }
  const coordinateSystem = document.settings.coordinateSystem;
  if (
    coordinateSystem.up !== 'y' ||
    coordinateSystem.handedness !== 'right' ||
    !['pixel', 'block', 'meter'].includes(coordinateSystem.unit) ||
    coordinateSystem.rotationUnit !== 'degree' ||
    coordinateSystem.rotationOrder !== 'xyz'
  ) {
    add({
      code: 'document.invalid_setting',
      severity: 'error',
      message: 'Projects require right-handed Y-up coordinates, degree XYZ rotations, and pixel, block, or meter units.',
      path: 'settings.coordinateSystem'
    });
  }
};

export const validateDocument = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  if (!isCurrentInternalContractVersion(
    'projectDocument',
    document.schemaVersion
  )) {
    add({
      code: 'document.schema_version',
      severity: 'error',
      message: `Unsupported project schema version "${document.schemaVersion}".`,
      path: 'schemaVersion'
    });
  }
  validateIdentity(document, add);
  validateIntent(document, add);
  validateIntentPrograms(document, add);
  validateCompilerAuthority(document, add);
  validateAuthoringProfile(document, add);
  validateSettings(document, add);
  validateMaterializedAuthoringInvariants(document, add);
};
