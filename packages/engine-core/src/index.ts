export {
  hasExactContractKeys,
  INTERNAL_CONTRACT_VERSIONS,
  isCanonicalIsoDate,
  isClosedContractRecord,
  isCurrentInternalContractVersion,
  isNonEmptyContractText,
  isUniqueContractTextArray,
  type InternalContractName,
  type InternalContractVersion,
  type InternalContractVersions
} from '@ashfox/internal-contracts';

export {
  ASHFOX_GENERIC_FORMAT_VERSION,
  CUBE_FACE_DIRECTIONS,
  IDENTITY_TRANSFORM,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  SURFACE_PIXEL_DENSITIES,
  type AnimationClip,
  type AnimationEffectValue,
  type AnimationLoopMode,
  type AnimationTriggerTrack,
  type BlobRef,
  type BoneNode,
  type CubeFace,
  type CubeFaces,
  type CubeNode,
  type ModelEyeGlyph,
  type ModelFeatureGlyph,
  type ModelFeatureMotif,
  type ModelMouthGlyph,
  type ModelNoseGlyph,
  type ProjectDocument,
  type ProjectForwardDirection,
  type ProjectIntent,
  type CompilationReceipt,
  type IntentProgramSource,
  type IntentProgramSourceV1,
  type ProjectCanonicalSupport,
  type ProjectReferenceKind,
  type ProjectReferenceObservation,
  type ProjectSemanticContract,
  type ProjectSemanticFace,
  type ProjectSubjectDomain,
  type ProjectSupportedSurfaceAnchor,
  type ProjectSupportedSurfaceGrowth,
  type ProjectSupportedSurfaceObligation,
  type ProjectSupportedSurfaceRole,
  type ProjectSymmetry,
  type SceneNode,
  type SurfacePixelDensity,
  type TextureAsset,
  type Transform,
  type TransformChannel,
  type Vec3
} from './model';
export * from './project/appearance/contract';
export * from './authoring';

export { canonicalJsonString } from './canonicalJson';
export {
  createCompilationReceipt,
  createIntentProgramSourceV1,
  INTENT_PROGRAM_COMPILER_VERSION,
  INTENT_PROGRAM_DIGEST_LENGTH,
  INTENT_PROGRAM_DIGEST_PATTERN_SOURCE,
  INTENT_PROGRAM_SOURCE_VERSION,
  INTENT_PROGRAM_SPECIFICATION_VERSION,
  intentProgramOutputDigest, intentProgramOutputProjection,
  intentProgramRasterProjection, intentProgramReviewDigest,
  intentProgramSourceReader,
  isIntentProgramDigest,
  readIntentProgramSource,
  sha256ByteDigest, sha256Digest,
  validateIntentProgramReceipt,
  type IntentProgramProvenanceIssue, type IntentProgramRasterProjection,
  type IntentProgramReceiptExpectation,
  type IntentProgramSourceReader,
  type ReadIntentProgramSourceResult
} from './provenance/program';
export {
  ASHFOX_PROJECT_FILE_CONTENT_TYPE,
  ASHFOX_PROJECT_FILE_EXTENSION,
  openProjectFile,
  serializeProjectFile,
  type OpenProjectFileInput,
  type OpenProjectFileResult,
  type ProjectFileIdentitySeed,
  type ProjectFileSerializationError,
  type ProjectFileSerializationErrorCode,
  type SerializeProjectFileResult
} from './projectFile';
export {
  effectivelyVisibleSceneNodeIds,
  isSceneNodeEffectivelyVisible
} from './sceneVisibility';

export { createProjectDocument } from './project/create';
export {
  PROJECT_REFERENCE_ID_PATTERN_SOURCE,
  normalizeProjectIntent,
  projectIntentReader,
  readProjectIntent,
  type ProjectIntentReader
} from './project/intent';
export {
  collectIntentProgramConstraintIssues,
  parseIntentProgram,
  resolveIntentProgramConstraints,
  resolveIntentProgramSourceSpan,
  type IntentProgramConstraintInspection,
  type IntentProgramConstraintIssue,
  type IntentProgramConstraintMetrics,
  type IntentProgramConstraintReporter,
  type IntentProgramAst,
  type IntentProgramAstField,
  type IntentProgramAttachedModule,
  type IntentProgramAnimation,
  type IntentProgramAppearance,
  type IntentProgramAttachmentAnchor,
  type IntentProgramAttachmentLane,
  type IntentProgramAbsentFace,
  type IntentProgramCardinality,
  type IntentProgramCoreModule,
  type IntentProgramDiagnostic,
  type IntentProgramDomain,
  type IntentProgramEyeConfiguration,
  type IntentProgramFace,
  type IntentProgramForwardDirection,
  type IntentProgramFullFace,
  type IntentProgramGaze,
  type IntentProgramFocal,
  type IntentProgramGrowthDirection,
  type IntentProgramIdleAnimation,
  type IntentProgramIdleMode,
  type IntentProgramIr,
  type IntentProgramModule,
  type IntentProgramModuleKind,
  type IntentProgramPalette,
  type IntentProgramParseResult,
  type IntentProgramRootBlock,
  type IntentProgramSemanticAst,
  type IntentProgramSourceMap,
  type IntentProgramSpan,
  type IntentProgramSupport,
  type IntentProgramSupportKind,
  type IntentProgramSurface,
  type IntentProgramSurfaceAxis,
  type IntentProgramSurfaceChord,
  type IntentProgramSurfaceEdge,
  type IntentProgramSurfaceOffset,
  type IntentProgramSurfaceShape,
  type IntentProgramSurfaceSpan,
  type IntentProgramSurfaceTip
} from './project/program';
export {
  INTENT_PROGRAM_IDENTIFIER_PATTERN,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
  INTENT_PROGRAM_LANGUAGE_VERSION, INTENT_PROGRAM_SOURCE_MAX_LENGTH,
  type IntentLanguageSpecification
} from './project/program/language';
export {
  compileIntentProgram, diagnoseIntentProgramSource,
  previewIntentProgram,
  type CompileIntentProgramResult, type IntentProgramDiagnosticReport,
  type IntentProgramCompilationPlan, type IntentProgramCompilerPlan,
  type IntentProgramGraphNode, type IntentProgramLoweringInput,
  type IntentProgramPlannedSurface,
  type IntentProgramPreviewDiagnostic, type IntentProgramPreviewView,
  type IntentProgramResolvedSurfaceShape,
  type IntentProgramSurfaceMembrane,
  type IntentProgramSurfacePoint,
  type IntentProgramSurfaceStation,
  type PreviewIntentProgramResult,
  type IntentProgramStructuralGraph
} from './compiler/program';
export {
  PROJECT_SYMMETRY_MAX_PLANE_TWICE,
  projectCellLateralSide,
  projectPairPlaneTwice,
  projectPointLateralSide,
  projectSpatialFrame,
  reflectProjectCell,
  reflectProjectPoint,
  type ProjectLateralAxis,
  type ProjectLateralSide,
  type ProjectLateralSign,
  type ProjectSpatialFrame
} from './project/frame';
export {
  evaluateProjectIntentRequirements,
  projectGroundingCorrection
} from './project/intent/evaluate';

export {
  AGENT_ACCESSIBLE_COMMAND_NAMES, COMMAND_RECEIPT_SCHEMA_VERSION,
  commandAllowedForSource,
  createProjectFromInput,
  executeAgentCommandBatch,
  executeSystemCommandBatch,
  executeWebCommandBatch,
  getAgentCommandDefinition,
  isValidCommandReceipt,
  isValidCommandReceiptLedger,
  listAgentCommandDefinitions,
  type CommandBatch,
  type CommandBatchResult,
  type CommandEffects,
  type CommandError,
  type CommandReceipt,
  type CommandReceiptLedgerOptions,
  type CommandSource,
  type ProjectCommandOperation,
  type ProjectCreateInput,
  type IntentProgramCompileInput,
  type IntentProgramProposalInput
} from './commands';

export {
  ProjectInvariantError,
  assertProjectDocument,
  validateProjectDocument,
  type InvariantFinding,
  type ValidationReport
} from './validation';
export {
  CANONICAL_IDLE_CLIP_ID,
  evaluateProductionReadiness,
  isProductionIdleClipName,
  type ProductionReadinessCode,
  type ProductionReadinessCounts,
  type ProductionReadinessFinding,
  type ProductionReadinessReport
} from './readiness';

export {
  AnimationExportCapabilityError,
  analyzeAnimationPreview,
  analyzeProjectAnimationCapabilities,
  animationPreviewIssues,
  blockingCanonicalAnimationPreviewIssues,
  blockingAnimationPreviewIssues,
  type AnimationPreviewIssue
} from './animation/capability';
export {
  sampleComposedNumericTransformChannel,
  sampleNumericTransformChannel,
  type NumericAnimationVec3
} from './animation/numericChannel';

export {
  completePartAuthoringSpec,
  projectSpacePartAuthoringSpec
} from './modeling/part/authoring';
export {
  derivePartAttachments
} from './modeling/attachment/derive';
export {
  normalizePartSpecs
} from './modeling/part';
export type {
  PartAuthoringSpec,
  PartSpec
} from './modeling/part';
export type { CellKey } from './modeling/contract';
export { readCompiledParts } from './modeling/invariants';
export {
  canonicalizePartOccupancies
} from './modeling/occupancy';
export {
  auditEyeAnatomy,
  type EyeAnatomyAuditOptions,
  type EyeAnatomyIssue,
  type EyeAnatomyIssueCode
} from './modeling/eye/anatomy';
export {
  auditEyeVisibility,
  EYE_VISIBILITY_POLICY,
  type EyeVisibilityIssue,
  type EyeVisibilityIssueCode
} from './modeling/eye/visibility';
export {
  attachmentContactMetrics,
  orthographicContributionMetrics
} from './modeling/part/quality';
export {
  measureDocumentFormComposition,
  measureFormComposition,
  type FormComposition,
  type FormPartComposition
} from './modeling/form/composition';
export {
  normalizePartRecipe,
  readPartRecipe
} from './modeling/recipe';
export {
  partTranslation
} from './modeling/part/translate';
export {
  worldCubeBounds,
  worldBoundsOverlap,
  type WorldAxisAlignedBounds
} from './modeling/world/bounds';
export { measureStaticSupport } from './modeling/support/metric';

export {
  cubeFaceDimensions,
  faceTexelSize,
  packUvAtlas,
  packUvAtlasWithGutter,
  reduceAtlasPixelsPerBlock
} from './textures/uvAtlas';
export {
  deterministicPixelNoise,
  stableTextureSeed
} from './textures/deterministicPixel';
export {
  DEFAULT_PIXEL_SHADE_STYLE,
  pixelTonePalette,
  shadePixelRect,
  type PixelTonePalette,
  type PixelToneRole,
  type RgbColor
} from './textures/pixelRectShade';
export { generatedSurfaceTonePalette } from './textures/appearance';
export { paintEyeMotifPixel } from './textures/eyeMotif';
export { paintFeatureMotifPixel } from './textures/featureMotif';
export { generatedSurfacePixel } from './textures/appearance/pixel';
export {
  composeTextureRaster, rasterizeTexture, staleGeneratedTextureIds,
  type CanonicalRgbaBytes, type CanonicalTextureRaster,
  type TextureComposition,
  type TextureCompositionRegion
} from './textures/textureRecipe';

export {
  BlobResolutionError,
  EXPORT_BUNDLE_SCHEMA_VERSION,
  ExportMaterializationRequiredError,
  type ExportAdaptationReceipt,
  type ExportBundle,
  type ExportFile,
  type JsonExportFile,
  type ResolvedBlob
} from './export/contract';
export {
  EXPORT_COMPATIBILITY_REGISTRY,
  EXPORT_PRESETS,
  MINECRAFT_GAME_VERSIONS,
  exportCompatibilityFor,
  exportCompatibilityOptions,
  isExportModelPathValid,
  isExportNamespaceValid,
  normalizeExportModelPath,
  type ExportCompatibilityOption,
  type ExportPreset,
  type MinecraftGameVersion
} from './export/compatibility';
export {
  ProductionExportError,
  exportProductionProject,
  exportProductionProjectResolved
} from './export/project';
export {
  adaptProjectForExport,
  resolveExportAdapter,
  type ExportAdaptedDocument,
  type ExportAdapterInput,
  type ExportTextureAsset,
  type ResolvedExportAdapter
} from './export/adapter';
export type {
  ExportFormatProfile
} from './export/adapter/contract';
