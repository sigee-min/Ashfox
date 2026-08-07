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
  type ProjectReferenceKind,
  type ProjectReferenceObservation,
  type SceneNode,
  type SurfacePixelDensity,
  type TextureAsset,
  type Transform,
  type TransformChannel,
  type Vec3
} from './model';

export {
  ARCHETYPE_IDS,
  ATTACHMENT_PORT_TYPES,
  AUTHORING_CAPABILITIES,
  AUTHORING_CONTACTS,
  AUTHORING_EYE_CONFIGURATIONS,
  AUTHORING_FACETS,
  AUTHORING_FACE_COMPONENTS,
  AUTHORING_FACE_FORMS,
  AUTHORING_FACE_MODES,
  AUTHORING_MOUTH_STATES,
  AUTHORING_PART_KINDS,
  AUTHORING_PROFILE_SCHEMA_VERSION,
  AUTHORING_QUALITY_STAGES,
  AUTHORING_REVIEW_CAMERAS,
  AUTHORING_REVIEW_ISSUES,
  AUTHORING_ROUTING_CONTRACT_VERSION,
  AUTHORING_SPATIAL_RELATIONS,
  AUTHORING_STRUCTURAL_ROLES,
  AUTHORING_TRACKS,
  SPECIALIST_IDS,
  type AppliedAuthoringReviewCheck,
  type ArchetypeDefinition,
  type ArchetypeId,
  type ArchetypeReference,
  type AttachmentPortDefinition,
  type AttachmentPortType,
  type AttachmentRequirement,
  type AuthoringAttachmentBinding,
  type AuthoringAuthorityClaim,
  type AuthoringAuthorityId,
  type AuthoringAuthorityReference,
  type AuthoringBinding,
  type AuthoringCapability,
  type AuthoringClaimBasis,
  type AuthoringContact,
  type AuthoringCompatibilityIssue,
  type AuthoringCompatibilityResult,
  type AuthoringFacet,
  type AuthoringEyeConfiguration,
  type AuthoringFaceComponent,
  type AuthoringFaceComponentDeclaration,
  type AuthoringFaceContract,
  type AuthoringFaceException,
  type AuthoringFaceForm,
  type AuthoringFaceMode,
  type AuthoringFeatureCoverage,
  type AuthoringMotionBinding,
  type AuthoringMotionRole,
  type AuthoringMouthState,
  type AuthoringPartKind,
  type AuthoringProfile,
  type AuthoringQualityStage,
  type AuthoringRecipe,
  type AuthoringRecipeSummary,
  type AuthoringReviewCamera,
  type AuthoringReviewCheck,
  type AuthoringReviewIssue,
  type AuthoringRoutingSnapshot,
  type AuthoringSelectionInput,
  type AuthoringSlotAssignment,
  type AuthoringSpatialRelation,
  type AuthoringStructuralRole,
  type AuthoringTrack,
  type CompatibilityClause,
  type ComposedAuthoringSlotDefinition,
  type EvidenceCriterionDefinition,
  type StructuralRolePolicyDefinition,
  type SpecialistBindingRequirement,
  type SpecialistContributionDefinition,
  type SpecialistDefinition,
  type SpecialistId,
  type SpecialistReference
} from './authoring/authoringTypes';
export {
  authoringAuthorityLabel,
  authoringReviewChecks,
  getArchetype,
  getSpecialist,
  listArchetypes,
  listSpecialists,
  resolveArchetypeReference,
  resolveSpecialistReference
} from './authoring/authoringRegistry';
export {
  AUTHORING_PROFILE_LIMITS,
  createAuthoringProfile,
  normalizeAuthoringProfile,
  readAuthoringProfile,
  type AuthoringProfileIssue,
  type NormalizeAuthoringProfileResult,
  type ReadAuthoringProfileResult
} from './authoring/authoringProfile';
export {
  composeAuthoringSlots,
  evaluateAuthoringPlan,
  type AuthoringPlanEvaluation,
  type AuthoringPlanIssue,
  type AuthoringSlotState,
  type AuthoringSlotStatus
} from './authoring/authoringPlan';
export {
  AUTHORING_COVERAGE_ASPECTS,
  evaluateIntentCoverage,
  type AuthoringCoverageAspect,
  type IntentCoverageEvaluation,
  type IntentCoverageStageStatus,
  type IntentFeatureCoverageStatus
} from './authoring/intentCoverage';
export {
  evaluateFaceQuality,
  type FaceComponentQualityStatus,
  type FaceQualityEvaluation
} from './authoring/faceQuality';
export {
  evaluateStructuralQuality,
  STRUCTURAL_QUALITY_STAGE_ORDER,
  type StructuralQualityEvaluation,
  type StructuralQualityGate,
  type StructuralQualityGateState
} from './authoring/structuralQuality';
export {
  evaluateAuthoringCompatibility,
  validateAuthoringCatalog,
  type AuthoringCatalogIssue
} from './authoring/compatibilityEvaluator';
export {
  getAuthoringRecipe,
  listAuthoringRecipes
} from './authoring/authoringRecipes';

export { canonicalJsonString } from './canonicalJson';
export {
  ProjectFileError,
  parseProjectDocument
} from './projectFile';
export {
  effectivelyVisibleSceneNodeIds,
  isSceneNodeEffectivelyVisible
} from './sceneVisibility';

export { createProjectDocument } from './project/createProjectDocument';
export {
  PROJECT_REFERENCE_ID_PATTERN_SOURCE,
  normalizeProjectIntent,
  readProjectIntent
} from './project/projectIntent';
export {
  evaluateProjectIntentRequirements,
  projectGroundingCorrection
} from './project/projectIntentEvaluation';

export {
  COMMAND_RECEIPT_SCHEMA_VERSION,
  commandAllowedForSource,
  createProjectFromInput,
  executeAgentCommandBatch,
  executeImportCommandBatch,
  executeSystemCommandBatch,
  executeWebCommandBatch,
  getAgentCommandDefinition,
  getCommandDefinition,
  isValidCommandReceipt,
  isValidCommandReceiptLedger,
  listAgentCommandDefinitions,
  listCommandDefinitions,
  type AnimationTriggerInput,
  type BoneCreateInput,
  type CommandBatch,
  type CommandBatchResult,
  type CommandEffects,
  type CommandError,
  type CommandReceipt,
  type CommandReceiptLedgerOptions,
  type CommandSource,
  type CubeCreateInput,
  type ProjectCommandOperation,
  type ProjectCreateInput,
  type ProjectIntentInput,
  type TransformChannelInput
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
  type ProductionReadinessFinding,
  type ProductionReadinessReport
} from './productionReadiness';

export {
  AnimationExportCapabilityError,
  analyzeAnimationPreview,
  analyzeProjectAnimationCapabilities,
  animationPreviewIssues,
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
} from './modeling/partAuthoring';
export {
  derivePartAttachments
} from './modeling/partAttachmentDerivation';
export {
  normalizePartSpecs
} from './modeling/partContract';
export type {
  PartAuthoringSpec,
  PartSpec
} from './modeling/partContract';
export type { CellKey } from './modeling/types';
export { readCompiledParts } from './modeling/partInvariants';
export {
  canonicalizePartOccupancies
} from './modeling/partOccupancyCanonicalization';
export {
  auditEyeAnatomy,
  type EyeAnatomyAuditOptions,
  type EyeAnatomyIssue,
  type EyeAnatomyIssueCode
} from './modeling/eyeAnatomy';
export {
  auditEyeVisibility,
  EYE_VISIBILITY_POLICY,
  type EyeVisibilityIssue,
  type EyeVisibilityIssueCode
} from './modeling/eyeVisibility';
export {
  attachmentContactMetrics,
  orthographicContributionMetrics
} from './modeling/partQualityMetrics';
export {
  measureDocumentFormComposition,
  measureFormComposition,
  type FormComposition,
  type FormPartComposition
} from './modeling/formComposition';
export {
  normalizePartRecipe,
  readPartRecipe
} from './modeling/partRecipe';
export {
  partTranslation
} from './modeling/partTranslation';
export {
  worldCubeBounds,
  worldBoundsOverlap,
  type WorldAxisAlignedBounds
} from './modeling/worldCubeBounds';
export { measureStaticSupport } from './modeling/staticSupportMetric';

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
  FOCAL_PIXEL_SHADE_STYLE,
  paintDirectionalFocalSurfacePixel,
  paintDirectionalSurfacePixel,
  paintFocalSurfacePixel,
  paintSurfacePixel
} from './textures/pixelSurfacePattern';
export {
  DEFAULT_PIXEL_SHADE_STYLE,
  shadePixelRect,
  type RgbColor
} from './textures/pixelRectShade';
export { paintEyeMotifPixel } from './textures/eyeMotif';
export { paintFeatureMotifPixel } from './textures/featureMotif';
export {
  composeTextureRaster,
  staleGeneratedTextureIds,
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
} from './export/types';
export {
  EXPORT_COMPATIBILITY_REGISTRY,
  EXPORT_PRESETS,
  MINECRAFT_GAME_VERSIONS,
  animationSupportForFormatProfile,
  formatProfileSupportsAnimation,
  exportCompatibilityFor,
  exportCompatibilityOptions,
  exportPresetForFormatProfile,
  formatProfileForExport,
  gameVersionForFormatProfile,
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
} from './export/exportProject';

export {
  buildMinecraftJavaModel,
  type MinecraftJavaModel
} from './export/targets/javaBlock/exporter';
export {
  buildMinecraftJavaBlockState,
  buildMinecraftJavaPackMetadata
} from './export/targets/javaBlock/resourcePack';
export {
  buildMinecraftBedrockAnimations,
  buildMinecraftBedrockGeometry
} from './export/targets/bedrock/exporter';
export {
  buildGeckoLib5Animations,
  buildGeckoLib5Geometry
} from './export/targets/geckolib5/exporter';
export {
  buildGltf,
  type CompiledGltf
} from './export/targets/gltf/exporter';
