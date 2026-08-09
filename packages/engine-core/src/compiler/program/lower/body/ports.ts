import type { ModelPartSpec, ProjectIntent } from '../../../../model';
import type {
  IntentProgramBodyPort,
  IntentProgramModuleHost
} from '../contract';
import { compilerPartDirectionalReach } from '../spatial';
import type { IntentProgramPlannedAttachment } from '../../contract';

export interface BodyPortResolutionPort {
  readonly intent: ProjectIntent;
  plannedAttachment(moduleId: string): IntentProgramPlannedAttachment | undefined;
  host(moduleId: string): IntentProgramModuleHost | undefined;
  part(partId: string): ModelPartSpec | undefined;
}

/** Resolves a declared lane into a deterministic host-relative body port. */
export const allocateBodyPort = (
  context: BodyPortResolutionPort,
  moduleId: string
): IntentProgramBodyPort => {
  const attachment = context.plannedAttachment(moduleId);
  if (!attachment) {
    throw new Error(`Missing planned attachment for body module "${moduleId}".`);
  }
  const host = context.host(attachment.hostModuleId);
  const hostPart = host ? context.part(host.partId) : undefined;
  const forwardDistance = Math.max(1,
    compilerPartDirectionalReach(context.intent, hostPart, 'forward') - 1
  );
  const verticalDistance = Math.max(1,
    compilerPartDirectionalReach(context.intent, hostPart, 'up') - 1
  );
  const offset = attachment.lane === 'leading'
    ? { up: 0, forward: forwardDistance }
    : attachment.lane === 'trailing'
      ? { up: 0, forward: -forwardDistance }
      : attachment.lane === 'upper'
        ? { up: verticalDistance, forward: 0 }
        : attachment.lane === 'lower'
          ? { up: -verticalDistance, forward: 0 }
          : { up: 0, forward: 0 };
  return {
    anchor: attachment.anchor,
    growth: attachment.growth,
    lane: attachment.lane,
    lateral: 0,
    ...offset
  };
};
