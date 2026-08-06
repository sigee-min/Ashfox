import { defineCommand } from '../definition';
import { modelPartsUpsertSchema } from './modelPartSchemas';
import { applyUpsertModelParts } from './modelParts/upsertApplication';

export const upsertModelPartsCommand = defineCommand({
  name: 'model.parts.upsert',
  label: 'Upsert model parts',
  purpose:
    'Compile project-space semantic parts through the iconic cuboid grammar. Agent-authored parts must be predeclared by the current reference-routed authoring plan; trusted import and system paths retain low-level compiler access.',
  inputSchema: modelPartsUpsertSchema,
  apply: applyUpsertModelParts
});
