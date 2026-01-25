import assert from 'node:assert/strict';
import { MCP_TOOLS } from '../../src/mcp/tools';
import { toolSchemas } from '../../src/mcp/toolSchemas';

const schemaKeys = Object.keys(toolSchemas);
assert.equal(schemaKeys.length, MCP_TOOLS.length, 'toolSchemas size should match MCP_TOOLS length');

const schemaKeySet = new Set(schemaKeys);
for (const tool of MCP_TOOLS) {
  assert.ok(schemaKeySet.has(tool.name), `Missing schema for tool: ${tool.name}`);
}
