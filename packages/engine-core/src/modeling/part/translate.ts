import type { PartSpec } from './index';
import type { LatticePoint } from '../contract';

/** Resolves the engine-owned attachment pair into project-space translation. */
export const partTranslation = (spec: PartSpec): LatticePoint => {
  const attachment = spec.attachment;
  if (!attachment) return { x: 0, y: 0, z: 0 };
  return {
    x: attachment.parentAnchor[0] - attachment.partAnchor[0],
    y: attachment.parentAnchor[1] - attachment.partAnchor[1],
    z: attachment.parentAnchor[2] - attachment.partAnchor[2]
  };
};
