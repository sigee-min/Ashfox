import assert from 'node:assert/strict';

import { toCallToolResult } from '../../src/mcp/routerUtils';
import type { ToolResponse } from '../../src/types';

{
  const okWithContent: ToolResponse<unknown> = {
    ok: true,
    data: { ignored: true },
    content: [{ type: 'text', text: 'hello' }],
    structuredContent: { a: 1 }
  };
  assert.deepEqual(toCallToolResult(okWithContent), {
    content: [{ type: 'text', text: 'hello' }],
    structuredContent: { a: 1 }
  });
}

{
  const okNoContent: ToolResponse<unknown> = {
    ok: true,
    data: { a: 1 }
  };
  assert.deepEqual(toCallToolResult(okNoContent), {
    content: [{ type: 'text', text: JSON.stringify({ a: 1 }) }],
    structuredContent: { a: 1 }
  });
}

{
  const errWithContent: ToolResponse<unknown> = {
    ok: false,
    error: { code: 'invalid_payload', message: 'bad input' },
    content: [{ type: 'text', text: 'bad input' }],
    structuredContent: { custom: true }
  };
  assert.deepEqual(toCallToolResult(errWithContent), {
    isError: true,
    content: [{ type: 'text', text: 'bad input' }],
    structuredContent: { custom: true }
  });
}

{
  const errNoContent: ToolResponse<unknown> = {
    ok: false,
    error: { code: 'unknown', message: 'boom' }
  };
  assert.deepEqual(toCallToolResult(errNoContent), {
    isError: true,
    content: [{ type: 'text', text: 'boom' }],
    structuredContent: { code: 'unknown', message: 'boom' }
  });
}
