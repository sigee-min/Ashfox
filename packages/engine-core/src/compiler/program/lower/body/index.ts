import type {
  IntentProgramAttachedModule
} from '../../../../project/program/types';
import { addAppendageBodyModule } from './appendage';
import type { BodyEmissionPort } from '../context';
import type { IntentProgramModuleHost } from '../contract';
import { addVolumeBodyModule } from './volume';

export { addCore, addRequiredCoreStructure } from './volume';

/** Dispatches one planned body module to its closed emitter family. */
export const addAttachedBodyModule = (
  context: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost | null => {
  if (module.kind === 'limb' || module.kind === 'wheel') {
    addAppendageBodyModule(context, module, parent);
    return null;
  }
  return addVolumeBodyModule(context, module, parent);
};
