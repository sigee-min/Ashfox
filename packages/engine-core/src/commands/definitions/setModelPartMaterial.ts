import { defineCommand } from '../definition';
import { modelPartsMaterialSchema } from './modelPartSchemas';
import {
  applySetModelPartMaterial
} from './modelParts/materialApplication';

export const setModelPartMaterialCommand = defineCommand({
  name: 'model.parts.material',
  label: 'Set part material',
  purpose:
    'Assign one canonical material ID and base color to complete generated parts.',
  inputSchema: modelPartsMaterialSchema,
  apply: applySetModelPartMaterial
});
