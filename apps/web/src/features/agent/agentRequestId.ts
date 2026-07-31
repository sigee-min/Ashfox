export const AGENT_REQUEST_ID_EXPECTED =
  '1-128 letters, digits, dots, underscores, colons, or hyphens';

export const isAgentRequestId = (
  value: unknown
): value is string =>
  typeof value === 'string' &&
  /^[A-Za-z0-9._:-]{1,128}$/.test(value);
