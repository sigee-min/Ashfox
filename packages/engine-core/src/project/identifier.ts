/** Single identifier authority for source-owned semantic handles. */
export const PROJECT_SEMANTIC_IDENTIFIER_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const isProjectSemanticIdentifier = (
  value: unknown
): value is string => typeof value === 'string' &&
  PROJECT_SEMANTIC_IDENTIFIER_PATTERN.test(value);
