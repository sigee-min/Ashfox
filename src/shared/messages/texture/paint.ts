export const TEXTURE_COVERAGE_LOW_MESSAGE = (label: string, ratio: number) =>
  `Texture coverage too low for "${label}" (${ratio}% opaque).`;
export const TEXTURE_COVERAGE_LOW_FIX =
  'Fill a larger opaque area, use an opaque background, or set per-face UVs to the painted bounds.';
export const TEXTURE_COVERAGE_LOW_HINT = 'Low opaque coverage + full-face UVs yields transparent results.';

export const TEXTURE_SIZE_MISMATCH_MESSAGE = (
  name: string,
  expectedWidth: number,
  expectedHeight: number,
  actualWidth: number,
  actualHeight: number
) => `Texture size mismatch for "${name}": expected ${expectedWidth}x${expectedHeight}, got ${actualWidth}x${actualHeight}.`;
export const TEXTURE_SIZE_MISMATCH_FIX =
  'Adjust the project texture resolution to match the target size, then recreate the texture.';

export const TEXTURE_SPECS_REQUIRED = 'textures array is required';
export const TEXTURE_SPEC_MODE_UNSUPPORTED = (mode: string, label: string) =>
  `unsupported texture mode ${mode} (${label})`;
export const TEXTURE_MODE_UNSUPPORTED = (mode: string) => `unsupported texture mode: ${mode}`;
export const TEXTURE_SPEC_NAME_REQUIRED = (label: string) => `texture name is required (${label})`;
export const TEXTURE_SPEC_TARGET_REQUIRED = (label: string) => `targetId or targetName is required (${label})`;
export const TEXTURE_SPEC_DETECT_NO_CHANGE_UPDATE_ONLY = (label: string) =>
  `detectNoChange is only supported for update mode (${label})`;
export const TEXTURE_DIMENSION_POSITIVE = (axis: string, label: string) => `texture ${axis} must be > 0 (${label})`;
export const TEXTURE_SIZE_EXCEEDS_MAX = (maxSize: number, label: string) =>
  `texture size exceeds max ${maxSize} (${label})`;
export const TEXTURE_OPS_TOO_MANY = (maxOps: number, label: string) =>
  `too many texture ops (>${maxOps}) (${label})`;
export const TEXTURE_OP_INVALID = (label: string) => `invalid texture op (${label})`;
export const TEXTURE_DETECT_NO_CHANGE_REQUIRES_EXISTING = (label: string) =>
  `detectNoChange requires useExisting=true (${label})`;

export const TEXTURE_PAINT_MODE_INVALID = (mode: string) => `texture paint mode invalid (${mode})`;
export const TEXTURE_PAINT_NAME_REQUIRED = 'texture name is required for paint_texture';
export const TEXTURE_PAINT_TARGET_REQUIRED = 'paint_texture requires targetId or targetName for update';
export const TEXTURE_PAINT_UV_USAGE_REQUIRED = 'uvUsageId is required when uvPaint is provided';
export const TEXTURE_PAINT_SIZE_EXCEEDS_MAX = (maxSize: number) =>
  `texture paint size exceeds max ${maxSize}`;
export const TEXTURE_PAINT_SIZE_EXCEEDS_MAX_FIX = (maxSize: number) =>
  `Use width/height <= ${maxSize}.`;
export const TEXTURE_OP_COLOR_INVALID = (label: string) => `invalid texture op color (${label})`;
export const TEXTURE_OP_LINEWIDTH_INVALID = (label: string) => `invalid texture op lineWidth (${label})`;
export const TEXTURE_RENDERER_UNAVAILABLE = 'texture renderer unavailable';
export const TEXTURE_RENDERER_NO_IMAGE = 'texture renderer did not return an image';
export const TEXTURE_FACES_TARGET_REQUIRED = 'paint_faces requires a target object.';
export const TEXTURE_FACES_TARGET_SELECTOR_REQUIRED = 'paint_faces target must include cubeId or cubeName.';
export const TEXTURE_FACES_FACE_REQUIRED = 'paint_faces target.face is required.';
export const TEXTURE_FACES_TEXTURE_REQUIRED =
  'paint_faces requires textureName or textureId when project name is unavailable.';
export const TEXTURE_FACES_SIZE_REQUIRED =
  'paint_faces requires width/height when texture size is unavailable.';
export const TEXTURE_FACES_OP_REQUIRED = 'paint_faces requires a single op object.';
export const TEXTURE_FACES_COORD_SPACE_INVALID =
  'paint_faces coordSpace must be "face" or "texture".';
export const TEXTURE_FACES_TEXTURE_COORDS_SIZE_REQUIRED =
  'paint_faces with coordSpace="texture" requires width and height.';
export const TEXTURE_FACES_TEXTURE_COORDS_SIZE_MISMATCH = (
  expectedWidth: number,
  expectedHeight: number,
  width: number,
  height: number
) =>
  `paint_faces coordSpace="texture" requires width/height to match texture size (${expectedWidth}x${expectedHeight}); got ${width}x${height}.`;
export const TEXTURE_FACES_OP_OUTSIDE_SOURCE = (
  coordSpace: 'face' | 'texture',
  width: number,
  height: number
) =>
  `paint_faces op is outside the ${coordSpace} source bounds (${width}x${height}); adjust op coordinates or source size.`;
export const TEXTURE_FACES_OP_OUTSIDE_TARGET =
  'paint_faces op does not overlap the target face UV bounds in texture coordinate space.';

export const UV_PAINT_USAGE_MISSING = (label: string) =>
  `No UV usage found for texture "${label}". Assign the texture and retry after UV refresh.`;
export const UV_PAINT_TARGET_CUBES_NOT_FOUND = (label: string) =>
  `uvPaint target cubes not found for texture "${label}".`;
export const UV_PAINT_TARGET_FACES_NOT_FOUND = (label: string) =>
  `uvPaint target faces not found for texture "${label}".`;
export const UV_PAINT_NO_RECTS = (label: string) =>
  `No UV rects found for texture "${label}". Assign the texture and retry after UV refresh.`;
export const UV_PAINT_NO_BOUNDS = (label: string) => `No UV bounds found for texture "${label}".`;
export const UV_PAINT_MAPPING_REQUIRED =
  'UV mapping is required before painting. Assign the texture and retry after UV refresh.';
export const UV_PAINT_OBJECT_REQUIRED = (label: string) => `uvPaint must be an object (${label})`;
export const UV_PAINT_SCOPE_INVALID = (label: string) => `uvPaint scope invalid (${label})`;
export const UV_PAINT_MAPPING_INVALID = (label: string) => `uvPaint mapping invalid (${label})`;
export const UV_PAINT_PADDING_INVALID = (label: string) => `uvPaint padding invalid (${label})`;
export const UV_PAINT_ANCHOR_FORMAT = (label: string) => `uvPaint anchor must be [x,y] (${label})`;
export const UV_PAINT_ANCHOR_NUMBERS = (label: string) => `uvPaint anchor must be numbers (${label})`;
export const UV_PAINT_SOURCE_OBJECT = (label: string) => `uvPaint source must be an object (${label})`;
export const UV_PAINT_SOURCE_REQUIRED = (label: string) => `uvPaint source width/height required (${label})`;
export const UV_PAINT_SOURCE_POSITIVE = (label: string) =>
  `uvPaint source width/height must be positive integers (${label})`;
export const UV_PAINT_SOURCE_EXCEEDS_MAX = (maxSize: number, label: string) =>
  `uvPaint source size exceeds max ${maxSize} (${label})`;
export const UV_PAINT_SOURCE_AXIS_POSITIVE = (axis: string, label: string) =>
  `uvPaint source ${axis} must be > 0 (${label})`;
export const UV_PAINT_SOURCE_AXIS_INTEGER = (axis: string, label: string) =>
  `uvPaint source ${axis} must be an integer (${label})`;
export const UV_PAINT_TARGET_OBJECT = (label: string) => `uvPaint target must be an object (${label})`;
export const UV_PAINT_TARGET_CUBE_IDS_REQUIRED = (label: string) =>
  `uvPaint target cubeIds must be a non-empty array (${label})`;
export const UV_PAINT_TARGET_CUBE_IDS_STRING = (label: string) => `uvPaint target cubeIds must be strings (${label})`;
export const UV_PAINT_TARGET_CUBE_NAMES_REQUIRED = (label: string) =>
  `uvPaint target cubeNames must be a non-empty array (${label})`;
export const UV_PAINT_TARGET_CUBE_NAMES_STRING = (label: string) =>
  `uvPaint target cubeNames must be strings (${label})`;
export const UV_PAINT_TARGET_FACES_REQUIRED = (label: string) =>
  `uvPaint target faces must be a non-empty array (${label})`;
export const UV_PAINT_TARGET_FACES_INVALID = (label: string) => `uvPaint target faces invalid (${label})`;
export const UV_PAINT_RECTS_REQUIRED = (label: string) => `uvPaint requires at least one rect (${label})`;
export const UV_PAINT_SOURCE_TARGET_POSITIVE = (label: string) =>
  `uvPaint requires positive source/target sizes (${label})`;
export const UV_PAINT_SOURCE_DATA_MISMATCH = (label: string) => `uvPaint source data size mismatch (${label})`;
export const UV_PAINT_RECT_INVALID = (label: string) => `uvPaint rect is invalid (${label})`;
export const UV_PAINT_PADDING_EXCEEDS_RECT = (label: string) => `uvPaint padding exceeds rect size (${label})`;
export const UV_PAINT_RECT_OUTSIDE_BOUNDS = (label: string) =>
  `uvPaint rect is outside texture bounds (${label})`;
export const UV_PAINT_PATTERN_UNAVAILABLE = (label: string) => `uvPaint pattern unavailable (${label})`;
