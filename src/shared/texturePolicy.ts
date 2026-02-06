export const UV_PAINT_SCOPES = ['faces', 'rects', 'bounds'] as const;
export const UV_PAINT_MAPPINGS = ['stretch', 'tile'] as const;

export type UvPaintScope = typeof UV_PAINT_SCOPES[number];
export type UvPaintMapping = typeof UV_PAINT_MAPPINGS[number];

export const UV_PAINT_SCOPE_SET = new Set<string>(UV_PAINT_SCOPES);
export const UV_PAINT_MAPPING_SET = new Set<string>(UV_PAINT_MAPPINGS);
