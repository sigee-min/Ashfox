export {
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
  type ProjectDocument,
  type ProjectForwardDirection,
  type SceneNode,
  type SurfacePixelDensity,
  type TextureAsset,
  type Transform,
  type TransformChannel,
  type Vec3
} from './model';

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
  normalizeProjectIntent,
  readProjectIntent
} from './project/projectIntent';
export {
  evaluateProjectIntentRequirements,
  projectGroundingCorrection
} from './project/projectIntentEvaluation';

export {
  commandAllowedForSource,
  createProjectFromInput,
  executeCommandBatch,
  getAgentCommandDefinition,
  getCommandDefinition,
  listAgentCommandDefinitions,
  listCommandDefinitions,
  type AnimationTriggerInput,
  type BoneCreateInput,
  type CommandBatch,
  type CommandBatchResult,
  type CommandEffects,
  type CommandError,
  type CommandReceipt,
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
  EYE_ANATOMY_POLICY,
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
  normalizePartRecipe,
  readPartRecipe
} from './modeling/partRecipe';
export {
  partTranslation
} from './modeling/partPrimitiveAdapter';
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
  paintDirectionalSurfacePixel,
  paintSurfacePixel
} from './textures/pixelSurfacePattern';
export {
  DEFAULT_PIXEL_SHADE_STYLE,
  shadePixelRect,
  type RgbColor
} from './textures/pixelRectShade';
export { paintEyeMotifPixel } from './textures/eyeMotif';
export {
  composeTextureRaster,
  staleGeneratedTextureIds,
  type TextureComposition,
  type TextureCompositionRegion
} from './textures/textureRecipe';

export {
  BlobResolutionError,
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
