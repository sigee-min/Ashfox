import assert from 'node:assert/strict';
import { MCP_TOOLS_ALL } from '../../src/mcp/tools';
import { toolSchemas } from '../../src/mcp/toolSchemas';

const schemaKeys = Object.keys(toolSchemas);
assert.equal(schemaKeys.length, MCP_TOOLS_ALL.length, 'toolSchemas size should match MCP_TOOLS_ALL length');

const schemaKeySet = new Set(schemaKeys);
for (const tool of MCP_TOOLS_ALL) {
  assert.ok(schemaKeySet.has(tool.name), `Missing schema for tool: ${tool.name}`);
}
