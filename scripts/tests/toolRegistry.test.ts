import assert from 'node:assert/strict';

import { TOOL_SCHEMA_VERSION } from '../../src/config';
import { MCP_TOOLS, TOOL_REGISTRY_COUNT, TOOL_REGISTRY_HASH } from '../../src/mcp/tools';

assert.equal(TOOL_SCHEMA_VERSION, '2025-04-06');
assert.equal(TOOL_REGISTRY_COUNT, MCP_TOOLS.length);

// Contract test: tool registry signature must be stable unless intentionally changed.
assert.equal(TOOL_REGISTRY_HASH, 'b7cff372');
