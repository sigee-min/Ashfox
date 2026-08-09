'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  AGENT_CAPABILITIES,
  AGENT_DECISION_EVIDENCE,
  COMMIT_TYPES,
  ENGINEERING_ENFORCERS,
  ENGINEERING_PRINCIPLE_IDS,
  fail,
  FORBIDDEN_HUMAN_AUTHORING,
  HUMAN_CAPABILITIES,
  MANIFEST_KEYS,
  STATEFUL_TEST_PATHS,
  SYNCHRONIZED_PRODUCT_VERSION_FILES
} = require('./contract');
const {
  assertClosedOrderedRecord,
  assertExactTextArray,
  assertExactValue,
  assertExistingFile,
  assertSortedUniqueTextArray,
  isDenseContractArray,
  isNonEmptyContractText
} = require('./reader');

const validateProductExperience = (value) => {
  const product = assertClosedOrderedRecord(
    value,
    'productExperience',
    MANIFEST_KEYS.productExperience
  );
  assertExactValue(
    product.interactionModel,
    'ai-authored-ai-compiled-human-observed',
    'productExperience.interactionModel'
  );
  assertExactValue(
    product.canonicalAuthority,
    'intent-program-v1',
    'productExperience.canonicalAuthority'
  );
  const projectFile = assertClosedOrderedRecord(
    product.projectFile,
    'productExperience.projectFile',
    MANIFEST_KEYS.projectFile
  );
  assertExactValue(
    projectFile.extension,
    '.ashfox',
    'productExperience.projectFile.extension'
  );
  assertExactValue(
    projectFile.mediaType,
    'text/x-ashfox;charset=utf-8',
    'productExperience.projectFile.mediaType'
  );
  assertExactValue(
    projectFile.encoding,
    'utf-8',
    'productExperience.projectFile.encoding'
  );
  assertExactValue(
    projectFile.bom,
    'forbidden',
    'productExperience.projectFile.bom'
  );
  assertExactValue(
    projectFile.authority,
    'intent-program-source-only',
    'productExperience.projectFile.authority'
  );
  assertExactValue(
    projectFile.loadMode,
    'parse-compile-atomic',
    'productExperience.projectFile.loadMode'
  );
  assertExactValue(
    projectFile.compiledState,
    'ephemeral-cache-only',
    'productExperience.projectFile.compiledState'
  );
  assertExactTextArray(
    product.humanCapabilities,
    HUMAN_CAPABILITIES,
    'productExperience.humanCapabilities'
  );
  assertExactTextArray(
    product.agentCapabilities,
    AGENT_CAPABILITIES,
    'productExperience.agentCapabilities'
  );
  assertExactTextArray(
    product.forbiddenHumanAuthoring,
    FORBIDDEN_HUMAN_AUTHORING,
    'productExperience.forbiddenHumanAuthoring'
  );
  const decision = assertClosedOrderedRecord(
    product.agentDecision,
    'productExperience.agentDecision',
    MANIFEST_KEYS.agentDecision
  );
  assertExactValue(
    decision.compilationAuthority,
    'agent',
    'productExperience.agentDecision.compilationAuthority'
  );
  assertExactValue(
    decision.confirmationRequired,
    false,
    'productExperience.agentDecision.confirmationRequired'
  );
  assertExactTextArray(
    decision.requiredEvidence,
    AGENT_DECISION_EVIDENCE,
    'productExperience.agentDecision.requiredEvidence'
  );
  assertExactValue(
    product.deliveryAuthority,
    'human',
    'productExperience.deliveryAuthority'
  );
};

const validateEngineeringStyle = (value) => {
  const style = assertClosedOrderedRecord(
    value,
    'engineering.style',
    MANIFEST_KEYS.engineeringStyle
  );
  assertExactValue(style.typescriptStrict, true, 'engineering.style.typescriptStrict');
  assertExactValue(style.indentSpaces, 2, 'engineering.style.indentSpaces');
  assertExactValue(style.quotes, 'single', 'engineering.style.quotes');
  assertExactValue(style.semicolons, 'required', 'engineering.style.semicolons');
  assertExactValue(
    style.readonlyPublicContracts,
    true,
    'engineering.style.readonlyPublicContracts'
  );
  assertExactValue(
    style.mutableDraftsPrivate,
    true,
    'engineering.style.mutableDraftsPrivate'
  );
};

const validateEngineeringPrinciples = (principles) => {
  if (!isDenseContractArray(principles) ||
      principles.length !== ENGINEERING_PRINCIPLE_IDS.length) {
    fail(
      'engineering.principles',
      `must define exactly: ${ENGINEERING_PRINCIPLE_IDS.join(', ')}`
    );
  }
  const enforcers = new Set(ENGINEERING_ENFORCERS);
  for (let index = 0; index < ENGINEERING_PRINCIPLE_IDS.length; index += 1) {
    const location = `engineering.principles[${index}]`;
    const principle = assertClosedOrderedRecord(
      principles[index],
      location,
      MANIFEST_KEYS.engineeringPrinciple
    );
    assertExactValue(
      principle.id,
      ENGINEERING_PRINCIPLE_IDS[index],
      `${location}.id`
    );
    if (!isNonEmptyContractText(principle.rule)) {
      fail(`${location}.rule`, 'must be non-empty trimmed text');
    }
    assertSortedUniqueTextArray(
      principle.enforcedBy,
      `${location}.enforcedBy`,
      (entry) => enforcers.has(entry)
    );
  }
};

const validateEngineeringTesting = (value) => {
  const testing = assertClosedOrderedRecord(
    value,
    'engineering.testing',
    MANIFEST_KEYS.engineeringTesting
  );
  assertExactValue(
    testing.behaviorChangeRequiresRegression,
    true,
    'engineering.testing.behaviorChangeRequiresRegression'
  );
  assertExactTextArray(
    testing.statefulPaths,
    STATEFUL_TEST_PATHS,
    'engineering.testing.statefulPaths'
  );
  assertExactValue(
    testing.userVisibleChangeRequiresDocs,
    true,
    'engineering.testing.userVisibleChangeRequiresDocs'
  );
};

const validateEngineering = (value) => {
  const engineering = assertClosedOrderedRecord(
    value,
    'engineering',
    MANIFEST_KEYS.engineering
  );
  validateEngineeringStyle(engineering.style);
  validateEngineeringPrinciples(engineering.principles);
  validateEngineeringTesting(engineering.testing);
  if (!isDenseContractArray(engineering.exceptions) ||
      engineering.exceptions.length !== 0) {
    fail('engineering.exceptions', 'must be empty in schema version 1');
  }
};

const validateWorkflow = (value) => {
  const workflow = assertClosedOrderedRecord(
    value,
    'workflow',
    MANIFEST_KEYS.workflow
  );
  const expected = {
    dirtyWorktree: 'preserve-unrelated',
    changeScope: 'smallest-complete-slice',
    publicContractChange: 'reader-version-contract-test',
    generatedArtifacts: 'edit-source-only'
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    assertExactValue(workflow[key], expectedValue, `workflow.${key}`);
  }

  const commits = assertClosedOrderedRecord(
    workflow.commits,
    'workflow.commits',
    MANIFEST_KEYS.commits
  );
  assertExactValue(commits.format, 'conventional-commits', 'workflow.commits.format');
  assertExactValue(commits.subject, 'imperative', 'workflow.commits.subject');
  assertExactTextArray(commits.types, COMMIT_TYPES, 'workflow.commits.types');
  assertExactValue(commits.atomic, true, 'workflow.commits.atomic');
  assertExactValue(
    commits.breakingChangeRequiresReview,
    true,
    'workflow.commits.breakingChangeRequiresReview'
  );

  const verification = assertClosedOrderedRecord(
    workflow.verification,
    'workflow.verification',
    MANIFEST_KEYS.verification
  );
  assertExactValue(
    verification.duringChange,
    'focused',
    'workflow.verification.duringChange'
  );
  assertExactTextArray(
    verification.beforeHandoff,
    ['git diff --check'],
    'workflow.verification.beforeHandoff'
  );
  assertExactTextArray(
    verification.beforePullRequest,
    ['npm run quality'],
    'workflow.verification.beforePullRequest'
  );
};

const validateVersioning = (value, repoRoot) => {
  const versioning = assertClosedOrderedRecord(
    value,
    'versioning',
    MANIFEST_KEYS.versioning
  );
  const product = assertClosedOrderedRecord(
    versioning.product,
    'versioning.product',
    MANIFEST_KEYS.productVersioning
  );
  const expectedProduct = {
    scheme: 'semver',
    sourceOfTruth: 'package.json',
    automation: 'release-please',
    changeOwner: 'release-pr',
    verification: 'npm run release:validate'
  };
  for (const [key, expectedValue] of Object.entries(expectedProduct)) {
    assertExactValue(product[key], expectedValue, `versioning.product.${key}`);
  }
  assertExactTextArray(
    product.synchronizedFiles,
    SYNCHRONIZED_PRODUCT_VERSION_FILES,
    'versioning.product.synchronizedFiles'
  );
  assertExistingFile(repoRoot, product.sourceOfTruth, 'versioning.product.sourceOfTruth');
  for (let index = 0; index < product.synchronizedFiles.length; index += 1) {
    assertExistingFile(
      repoRoot,
      product.synchronizedFiles[index],
      `versioning.product.synchronizedFiles[${index}]`
    );
  }

  const intentProgram = assertClosedOrderedRecord(
    versioning.intentProgram,
    'versioning.intentProgram',
    MANIFEST_KEYS.intentProgramVersioning
  );
  assertExactValue(intentProgram.version, 1, 'versioning.intentProgram.version');
  assertExactValue(
    intentProgram.compatibility,
    'current-version-only',
    'versioning.intentProgram.compatibility'
  );
  assertExactValue(
    intentProgram.authority,
    'packages/engine-core/src/project/program/language.ts',
    'versioning.intentProgram.authority'
  );
  assertExactValue(
    intentProgram.breakingChangeRequiresVersion,
    true,
    'versioning.intentProgram.breakingChangeRequiresVersion'
  );
  assertExistingFile(
    repoRoot,
    intentProgram.authority,
    'versioning.intentProgram.authority'
  );

  const surfaceSynthesis = assertClosedOrderedRecord(
    versioning.surfaceSynthesis,
    'versioning.surfaceSynthesis',
    MANIFEST_KEYS.surfaceSynthesisVersioning
  );
  const expectedSynthesis = {
    version: 1,
    authority: 'packages/engine-core/src/textures/appearance/contract.ts',
    rasterAuthority:
      'packages/engine-core/src/textures/textureRecipe/raster.ts',
    receiptAuthority:
      'packages/engine-core/src/provenance/program/receipt.ts',
    breakingChangeRequiresVersion: true
  };
  for (const [key, expectedValue] of Object.entries(expectedSynthesis)) {
    assertExactValue(
      surfaceSynthesis[key],
      expectedValue,
      `versioning.surfaceSynthesis.${key}`
    );
  }
  for (const key of ['authority', 'rasterAuthority', 'receiptAuthority']) {
    assertExistingFile(
      repoRoot,
      surfaceSynthesis[key],
      `versioning.surfaceSynthesis.${key}`
    );
  }
  const synthesisAuthority = fs.readFileSync(
    path.join(repoRoot, surfaceSynthesis.authority),
    'utf8'
  );
  if (!new RegExp(
    `SURFACE_SYNTHESIS_VERSION\\s*=\\s*${surfaceSynthesis.version}\\s+as const`
  ).test(synthesisAuthority)) {
    fail(
      'versioning.surfaceSynthesis.version',
      'must match SURFACE_SYNTHESIS_VERSION in its authority'
    );
  }
  const receiptAuthority = fs.readFileSync(
    path.join(repoRoot, surfaceSynthesis.receiptAuthority),
    'utf8'
  );
  if (!receiptAuthority.includes('intentProgramRasterProjection') ||
      !receiptAuthority.includes('rgbaDigest')) {
    fail(
      'versioning.surfaceSynthesis.receiptAuthority',
      'must bind the canonical RGBA digest into output provenance'
    );
  }

  const deliveryTargets = assertClosedOrderedRecord(
    versioning.deliveryTargets,
    'versioning.deliveryTargets',
    MANIFEST_KEYS.deliveryTargetVersioning
  );
  assertExactValue(
    deliveryTargets.scope,
    'transient-export-input',
    'versioning.deliveryTargets.scope'
  );
  assertExactValue(
    deliveryTargets.canonicalMutation,
    false,
    'versioning.deliveryTargets.canonicalMutation'
  );
};

module.exports = {
  validateEngineering,
  validateProductExperience,
  validateVersioning,
  validateWorkflow
};
