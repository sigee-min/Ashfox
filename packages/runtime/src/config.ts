import { AuthoringCapability, Capabilities, Limits, PreviewCapability } from '@ashfox/contracts/types/internal';
import { FormatDescriptor } from './ports/formats';
import { FormatOverrides, resolveFormatId } from './domain/formats';
import { TEXTURE_WORKFLOW_INSTRUCTIONS } from './shared/tooling/toolInstructions';
import { TOOL_SCHEMA_VERSION as CONTRACT_TOOL_SCHEMA_VERSION } from '@ashfox/contracts/mcpSchemas/policy';

declare const __ASHFOX_PLUGIN_VERSION__: string | undefined;

const resolveInjectedPluginVersion = (): string | undefined => {
  if (typeof __ASHFOX_PLUGIN_VERSION__ !== 'string') return undefined;
  const trimmed = __ASHFOX_PLUGIN_VERSION__.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveEnvPluginVersion = (): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  const raw = process.env?.ASHFOX_PLUGIN_VERSION;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const PLUGIN_ID = 'ashfox';
export const PLUGIN_VERSION = resolveInjectedPluginVersion() ?? resolveEnvPluginVersion() ?? '0.0.0-dev';
export const TOOL_SCHEMA_VERSION = CONTRACT_TOOL_SCHEMA_VERSION;
export const DEFAULT_SERVER_HOST = '0.0.0.0';
export const DEFAULT_SERVER_PORT = 8787;
export const DEFAULT_SERVER_PATH = '/mcp';

const DEFAULT_LIMITS: Limits = {
  maxCubes: 2048,
  maxTextureSize: 2048,
  maxAnimationSeconds: 120
};

const DEFAULT_AUTHORING_CAPABILITY = {
  animations: true
};

const CAPABILITIES_GUIDANCE = {
  toolPathStability: {
    cache: 'no' as const,
    note: 'Tool paths like /ashfox/link_... are session-bound and can change after reconnects. Re-discover tools on Resource not found or when toolRegistry.hash changes (toolSchemaVersion is coarse).'
  },
  mutationPolicy: {
    requiresRevision: true,
    note: 'All mutating tools require ifRevision. Call get_project_state before mutations; the server may auto-retry once on revision mismatch. Prefer ensure_project to reuse active projects.'
  },
  retryPolicy: {
    maxAttempts: 2,
    onErrors: ['resource_not_found', 'invalid_state', 'invalid_state_revision_mismatch', 'tool_registry_empty'],
    steps: ['tools/list', 'refresh_state', 'retry_once']
  },
  rediscovery: {
    refetchTools: true,
    refreshState: true,
    methods: ['tools/list', 'list_capabilities', 'get_project_state']
  },
  textureStrategy: {
    note: TEXTURE_WORKFLOW_INSTRUCTIONS
  },
  pluginModePrerequisite: {
    note: 'Plugin mode requires the Blockbench entity-rig plugin support to be installed and enabled before authoring/export.'
  }
};

const computeAuthoringCapability = (
  formats: FormatDescriptor[],
  overrides?: FormatOverrides
): AuthoringCapability => {
  const resolved = resolveFormatId(formats, overrides);
  const descriptor = resolved ? formats.find((format) => format.id === resolved) : undefined;
  const flags = normalizeFormatFlags(descriptor);
  const animations = resolveAnimations(DEFAULT_AUTHORING_CAPABILITY.animations, descriptor);
  return { animations, enabled: Boolean(resolved), ...(flags ? { flags } : {}) };
};

const normalizeFormatFlags = (
  descriptor?: FormatDescriptor
): AuthoringCapability['flags'] | undefined => {
  if (!descriptor) return undefined;
  const flags = {
    singleTexture: descriptor.singleTexture,
    perTextureUvSize: descriptor.perTextureUvSize,
    boxUv: descriptor.boxUv,
    optionalBoxUv: descriptor.optionalBoxUv,
    uvRotation: descriptor.uvRotation,
    animationMode: descriptor.animationMode,
    boneRig: descriptor.boneRig,
    armatureRig: descriptor.armatureRig
  };
  const hasFlag = Object.values(flags).some((value) => value !== undefined);
  return hasFlag ? flags : undefined;
};

const resolveAnimations = (fallback: boolean, descriptor?: FormatDescriptor): boolean =>
  typeof descriptor?.animationMode === 'boolean' ? descriptor.animationMode : fallback;

export function computeCapabilities(
  blockbenchVersion: string | undefined,
  formats: FormatDescriptor[] = [],
  overrides?: FormatOverrides,
  preview?: PreviewCapability
): Capabilities {
  return {
    pluginVersion: PLUGIN_VERSION,
    toolSchemaVersion: TOOL_SCHEMA_VERSION,
    blockbenchVersion: blockbenchVersion ?? 'unknown',
    authoring: computeAuthoringCapability(formats, overrides),
    limits: DEFAULT_LIMITS,
    preview,
    guidance: CAPABILITIES_GUIDANCE
  };
}
