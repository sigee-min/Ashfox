/** Closed direction vocabulary shared by texture payloads and schemas. */
export const FILL_SHADE_DIRECTIONS = [
  'tl_br',
  'tr_bl',
  'top_bottom',
  'left_right'
] as const;

export type FillShadeDirection =
  (typeof FILL_SHADE_DIRECTIONS)[number];
