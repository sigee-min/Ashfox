import type {
  InspectFailure,
  InspectSuccess
} from './types';

const jsonBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export const boundedSuccess = (
  revision: string,
  data: unknown,
  maxBytes: number
): InspectSuccess | InspectFailure => {
  const result: InspectSuccess = {
    ok: true,
    revision,
    data
  };
  if (jsonBytes(result) <= maxBytes) return result;
  return {
    ok: false,
    revision,
    error: {
      code: 'response_too_large',
      expected: `response <= ${maxBytes} bytes`
    }
  };
};
