import { hashTextToHex } from '../shared/hash';
import { JsonSchema, McpToolDefinition } from './types';
import { toolSchemas } from './toolSchemas';

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_capabilities',
    title: 'List Capabilities',
    description: 'Returns plugin capabilities and limits. Tool schemas are strict (extra fields are rejected).',
    inputSchema: toolSchemas.list_capabilities
  },
  {
    name: 'ensure_project',
    title: 'Ensure Project',
    description:
      'Ensures a usable project. Reuses the active project by default and can create a new one when missing or on mismatch (per options). Use match/onMismatch/onMissing to control behavior.',
    inputSchema: toolSchemas.ensure_project
  },
  {
    name: 'get_project_state',
    title: 'Get Project State',
    description:
      'Returns the current project state (summary by default). Summary includes texture metadata and textureResolution. Full detail includes textureUsage (per-face mappings) when available.',
    inputSchema: toolSchemas.get_project_state
  },
  {
    name: 'read_texture',
    title: 'Read Texture',
    description:
      'Reads a texture image (PNG) by id or name. Returns MCP image content plus structured metadata. Set saveToTmp=true to write a snapshot into .bbmcp/tmp for manual upload fallback. See bbmcp://guide/vision-fallback via resources/read. Requires an active project.',
    inputSchema: toolSchemas.read_texture
  },
  {
    name: 'texture_pipeline',
    title: 'Texture Pipeline',
    description:
      'Macro: runs the standard texture workflow in one call and returns nextActions for follow-ups when needed.',
    inputSchema: toolSchemas.texture_pipeline
  },
  {
    name: 'render_preview',
    title: 'Render Preview',
    description:
      'Renders a preview image. fixed -> single (optional angle). turntable -> sequence. Returns MCP image content blocks (base64 PNG) plus structured metadata without dataUri. Set saveToTmp=true to write snapshots into .bbmcp/tmp for manual upload fallback. See bbmcp://guide/vision-fallback via resources/read. Single returns result.image; sequence returns result.frames[]. Example(single): {"mode":"fixed","output":"single","angle":[30,45,0]} Example(sequence): {"mode":"turntable","output":"sequence","durationSeconds":2,"fps":12}',
    inputSchema: toolSchemas.render_preview
  },
  {
    name: 'validate',
    title: 'Validate',
    description: 'Validates the current project.',
    inputSchema: toolSchemas.validate
  },
];

const MCP_TOOL_MAP = new Map<string, McpToolDefinition>(MCP_TOOLS.map((tool) => [tool.name, tool]));

const toolRegistrySignature = () =>
  JSON.stringify(MCP_TOOLS.map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema })));

export const TOOL_REGISTRY_HASH = hashTextToHex(toolRegistrySignature());
export const TOOL_REGISTRY_COUNT = MCP_TOOLS.length;

export const getToolSchema = (name: string): JsonSchema | null => MCP_TOOL_MAP.get(name)?.inputSchema ?? null;

export const isKnownTool = (name: string) => MCP_TOOL_MAP.has(name);

