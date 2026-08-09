import {
  addSlot,
  attachment,
  centeredOrAsymmetric,
  localPoint,
  localRadii,
  sideRelation,
  sideSymmetry,
  type BuildState
} from './state';

/** Lowers a compiler-owned four-contact neutral stance. Every contact is a
 * complete semantic foot, rather than treating fore and aft contacts as
 * digits of one foot. This keeps the support contract's sole → toe → claw
 * direction proof local to the physical contact it describes. */
export const addFootSupports = (
  state: BuildState,
  rootPartId: string,
  rootSlotId: string
): void => {
  if (state.program.rest.kind !== 'feet') return;
  // The stance is owned by the structural core, not by the furthest facial
  // ornament or span. Letting decorative geometry extend the contact range
  // makes feet drift away and can exceed the canonical form bounds.
  const contacts = [{
    id: 'rear',
    forward: -6
  }, {
    id: 'front',
    forward: 6
  }] as const;
  for (const contact of contacts) {
    const rootForward = contact.id === 'rear' ? -2 : 2;
    for (const side of ['left', 'right'] as const) {
      const lateral = side === 'left' ? 2 : -2;
      const prefix = `foot.${contact.id}.${side}`;
      const root = `${prefix}.root`;
      const shin = `${prefix}.shin`;
      const sole = `${prefix}.sole`;
      const toe = `${prefix}.toe`;
      const claw = `${prefix}.claw`;
      state.parts.push(
        {
          partId: root, parentPartId: rootPartId, materialId: 'mat.base', joint: { kind: 'ball' },
          attachment: attachment(localPoint(state.intent, lateral, 6, rootForward)), kind: 'segment',
          points: [
            localPoint(state.intent, lateral, 6, rootForward),
            localPoint(state.intent, lateral, 2, rootForward)
          ],
          radii: [[1, 1, 1], [1, 1, 1]], profile: 'balanced'
        },
        {
          partId: shin, parentPartId: root, materialId: 'mat.base', joint: { kind: 'ball' },
          attachment: attachment(localPoint(state.intent, lateral, 3, rootForward)), kind: 'segment',
          points: [
            localPoint(state.intent, lateral, 3, rootForward),
            localPoint(state.intent, lateral, 3, contact.forward)
          ],
          radii: [[1, 1, 1], [1, 1, 1]], profile: 'balanced'
        },
        {
          partId: sole, parentPartId: shin, materialId: 'mat.base', joint: { kind: 'fixed' },
          attachment: attachment(localPoint(state.intent, lateral, 1, contact.forward)), kind: 'mass',
          center: localPoint(state.intent, lateral, 1, contact.forward), radii: localRadii(state.intent, 1, 1, 2), profile: 'block'
        },
        {
          partId: toe, parentPartId: sole, materialId: 'mat.base', joint: { kind: 'fixed' },
          attachment: attachment(localPoint(state.intent, lateral, 1, contact.forward + 3)), kind: 'segment',
          points: [
            localPoint(state.intent, lateral, 1, contact.forward + 3),
            localPoint(state.intent, lateral, 1, contact.forward + 5)
          ],
          radii: [[1, 1, 1], [1, 1, 1]], profile: 'balanced'
        },
        {
          partId: claw, parentPartId: toe, materialId: 'mat.dark', joint: { kind: 'fixed' },
          attachment: attachment(localPoint(state.intent, lateral, 1, contact.forward + 5)), kind: 'segment',
          points: [
            localPoint(state.intent, lateral, 1, contact.forward + 5),
            localPoint(state.intent, lateral, 1, contact.forward + 6)
          ],
          radii: [[1, 1, 1], [1, 1, 1]], profile: 'hard'
        }
      );
      addSlot(state, {
        slotId: `slot.foot.${contact.id}.${side}`,
        structuralRole: 'articulated', qualityStage: 'structure',
        partIds: [root, shin, sole, toe, claw], parentSlotIds: [rootSlotId],
        spatialRelations: sideRelation(side), facing: 'forward',
        symmetry: sideSymmetry(`pair.feet.${contact.id}`),
        support: {
          kind: 'foot', contact: 'grounded', rootPartId: root,
          solePartIds: [sole],
          digits: [{
            digitId: 'digit.primary', toePartIds: [toe], clawPartIds: [claw]
          }]
        },
        span: { kind: 'none' }
      });
    }
  }
};

/** Lowers a connected plinth that contacts the core and owns the ground plane. */
export const addBaseSupport = (
  state: BuildState,
  rootPartId: string,
  rootSlotId: string
): void => {
  if (state.program.rest.kind !== 'base') return;
  const stemId = 'support.base.stem';
  const partId = 'support.base';
  state.parts.push({
    partId: stemId, parentPartId: rootPartId, materialId: 'mat.dark',
    joint: { kind: 'fixed' },
    attachment: attachment(localPoint(state.intent, 0, 4, 0)),
    kind: 'segment',
    points: [
      localPoint(state.intent, 0, 4, 0),
      localPoint(state.intent, 0, 2, 0)
    ],
    radii: [[1, 1, 1], [1, 1, 1]],
    profile: 'hard'
  });
  state.parts.push({
    partId, parentPartId: stemId, materialId: 'mat.dark', joint: { kind: 'fixed' },
    attachment: attachment(localPoint(state.intent, 0, 1, 0)), kind: 'mass',
    center: localPoint(state.intent, 0, 1, 0), radii: [4, 1, 4], profile: 'block'
  });
  const stemSlotId = 'slot.support.base.stem';
  addSlot(state, {
    slotId: stemSlotId, structuralRole: 'axis', qualityStage: 'structure', partIds: [stemId],
    parentSlotIds: [rootSlotId], spatialRelations: ['below'], facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' }, span: { kind: 'none' }
  });
  addSlot(state, {
    slotId: 'slot.support.base', structuralRole: 'core', qualityStage: 'structure', partIds: [partId],
    parentSlotIds: [stemSlotId], spatialRelations: ['below'], facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'base', contact: 'grounded', supportPartIds: [partId] },
    span: { kind: 'none' }
  });
};
