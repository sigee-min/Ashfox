export const deepFreezeAuthoringValue = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreezeAuthoringValue(nested);
  }
  return value;
};

export const uniqueSortedAuthoringValues = <T extends string>(
  values: readonly T[]
): readonly T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));
