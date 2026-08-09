import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import { addConstraintIssue, type ConstraintState } from './analysis';

const supportCompatibility =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.supportCompatibility;
const contactRequirements = Object.values(
  supportCompatibility.contactRequirementsByKind
);

const reportInvalidContactKind = (
  state: ConstraintState,
  supportKind: 'feet' | 'base' | 'wheels',
  contact: string,
  moduleKind: string,
  path: string
): void => {
  if (supportKind === 'feet') addConstraintIssue(
    state,
    'intent.invalid_feet_contact',
    `Feet support requires limb contacts; "${contact}" is ${moduleKind}.`,
    path
  );
  else if (supportKind === 'wheels') addConstraintIssue(
    state,
    'intent.invalid_wheel_contact',
    `Wheels support requires wheel contacts; "${contact}" is ${moduleKind}.`,
    path
  );
  else addConstraintIssue(
    state,
    'intent.invalid_base_contact',
    `Base support requires a structural contact; "${contact}" is ${moduleKind}.`,
    path
  );
};

const reportInvalidContactGrowth = (
  state: ConstraintState,
  supportKind: 'feet' | 'wheels',
  contact: string,
  growth: string,
  path: string
): void => addConstraintIssue(
  state,
  supportKind === 'feet'
    ? 'intent.invalid_feet_contact_growth'
    : 'intent.invalid_wheel_contact_growth',
  supportKind === 'feet'
    ? `Feet support requires down-growing limbs; "${contact}" grows ${growth}.`
    : `Wheel support requires down-growing wheels; "${contact}" grows ${growth}.`,
  path
);

const validateContact = (
  state: ConstraintState,
  contact: string,
  index: number
): void => {
  const support = state.ast.model.support;
  if (!support) return;
  state.counters.targetChecks += 1;
  const path = `support.contacts.${index}`;
  const module = supportCompatibility.contactReference.namespace === 'body'
    ? state.moduleById.get(contact)
    : undefined;
  if (!module) {
    addConstraintIssue(
      state,
      'intent.unknown_support_contact',
      `Support names unknown body contact "${contact}".`,
      path
    );
    return;
  }
  const requirement = contactRequirements.find(
    (entry) => entry.supportKind === support.kind
  );
  if (!requirement) return;
  if (!requirement.moduleKinds.some((kind) => kind === module.kind)) {
    reportInvalidContactKind(
      state, requirement.supportKind, contact, module.kind, path
    );
    return;
  }
  if (requirement.requiredGrowth === null) return;
  const growth = 'growth' in module ? module.growth : 'none';
  if (growth !== requirement.requiredGrowth) reportInvalidContactGrowth(
    state, requirement.supportKind, contact, growth, path
  );
};

export const validateIntentProgramSupport = (state: ConstraintState): void => {
  const support = state.ast.model.support;
  if (!support) return;
  const domain = state.ast.metadata.domain;
  if (domain && !supportCompatibility.kindsByDomain[
    domain
  ].some((kind) => kind === support.kind)) addConstraintIssue(
    state,
    'intent.incompatible_domain_support',
    `Domain ${domain} does not support ${support.kind} contact.`,
    'support.kind'
  );
  const count = support.contacts.length;
  const cardinality =
    supportCompatibility.contactCardinalityByKind[support.kind];
  if (count < cardinality.min ||
    (cardinality.max !== null && count > cardinality.max)) {
    const path = cardinality.max !== null && count > cardinality.max
      ? `support.contacts.${cardinality.max}`
      : 'support.contacts';
    addConstraintIssue(
      state,
      'intent.invalid_support_cardinality',
      `Support ${support.kind} has invalid contact count ${count}.`,
      path
    );
  }
  const contacts = new Set<string>();
  support.contacts.forEach((contact, index) => {
    if (supportCompatibility.contactsUnique && contacts.has(contact)) {
      addConstraintIssue(
      state,
      'intent.duplicate_support_contact',
      `Support contact "${contact}" is named more than once.`,
      `support.contacts.${index}`
      );
    }
    contacts.add(contact);
    validateContact(state, contact, index);
  });
  for (const module of state.ast.model.body) {
    const requirement = supportCompatibility.requiredModuleContacts.find(
      (entry) => entry.moduleKind === module.kind
    );
    if (requirement && (support.kind !== requirement.supportKind ||
      !contacts.has(module.id))) addConstraintIssue(
      state,
      'intent.wheel_requires_wheel_support',
      `Wheel module "${module.id}" must belong to canonical wheel support.`,
      `body.${module.id}`
    );
  }
};
