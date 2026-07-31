import { defineCommand } from '../definition';
import { modelPartsUpsertSchema } from './modelPartSchemas';
import { applyUpsertModelParts } from './modelParts/upsertApplication';

export const upsertModelPartsCommand = defineCommand({
  name: 'model.parts.upsert',
  label: 'Upsert model parts',
  purpose:
    'Compile project-space semantic parts with derived joints, shared-face pivots, shallow seam snapping, single-owner geometry, UVs, and generated texture surfaces.',
  inputSchema: modelPartsUpsertSchema,
  apply: applyUpsertModelParts
});
