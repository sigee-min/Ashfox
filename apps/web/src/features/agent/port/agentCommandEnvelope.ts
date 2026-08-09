import {
  isAgentRequestId
} from '../agentRequestId';

export type AgentCommandMethod =
  | 'inspect'
  | 'run'
  | 'present'
  | 'capture';

export interface AgentCommandEnvelope {
  requestId: string;
  method: AgentCommandMethod;
  payload?: unknown;
}

const ENVELOPE_KEYS = new Set([
  'requestId',
  'method',
  'payload'
]);

const METHODS = new Set<unknown>([
  'inspect',
  'run',
  'present',
  'capture'
]);

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

const parseAgentCommandEnvelope = (
  value: unknown
): AgentCommandEnvelope | null => {
  if (
    !isRecord(value) ||
    !isAgentRequestId(value.requestId) ||
    !METHODS.has(value.method) ||
    Object.keys(value).some((key) => !ENVELOPE_KEYS.has(key))
  ) {
    return null;
  }
  return {
    requestId: value.requestId,
    method: value.method as AgentCommandMethod,
    payload: value.payload
  };
};

export const parseSerializedAgentCommandEnvelope = (
  serialized: string
): AgentCommandEnvelope | null => {
  try {
    return parseAgentCommandEnvelope(JSON.parse(serialized));
  } catch {
    return null;
  }
};
