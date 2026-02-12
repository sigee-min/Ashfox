import type {
  CanonicalAnimation,
  CanonicalAnimationTriggerTrack,
  CanonicalChannelKey,
  CanonicalExportModel,
  CodecEncodeResult,
  ExportCodecStrategy
} from './types';

const GEO_FORMAT_VERSION = '1.12.0';
const GECKO_ANIMATION_FORMAT_VERSION = 2;

const sanitizeNumber = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
};

const sanitizeVec3 = (value: [number, number, number]): [number, number, number] => [
  sanitizeNumber(value[0]),
  sanitizeNumber(value[1]),
  sanitizeNumber(value[2])
];

const channelName = (channel: 'rot' | 'pos' | 'scale'): 'rotation' | 'position' | 'scale' => {
  if (channel === 'pos') return 'position';
  if (channel === 'scale') return 'scale';
  return 'rotation';
};

const sanitizeIdentifier = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'model';

const normalizeTimeKey = (time: number): string => {
  const normalized = sanitizeNumber(time);
  if (Number.isInteger(normalized)) return String(normalized);
  const fixed = normalized.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return fixed.length > 0 ? fixed : '0';
};

const withOptionalField = <T extends Record<string, unknown>>(
  base: T,
  key: string,
  value: unknown
) : T => {
  if (value === undefined || value === null) return base;
  return {
    ...base,
    [key]: value
  } as T;
};

const serializeChannelKeyValue = (key: CanonicalChannelKey): unknown => {
  const vector = sanitizeVec3(key.vector);
  const easing = key.easing ?? key.interp;
  const hasObjectForm =
    key.pre !== undefined ||
    key.post !== undefined ||
    easing !== undefined ||
    (Array.isArray(key.easingArgs) && key.easingArgs.length > 0) ||
    key.bezier !== undefined;
  if (!hasObjectForm) return vector;
  const payload: Record<string, unknown> = {};
  if (key.pre) payload.pre = sanitizeVec3(key.pre);
  if (key.post) payload.post = sanitizeVec3(key.post);
  if (!key.pre && !key.post) payload.vector = vector;
  if (easing) payload.easing = easing;
  if (Array.isArray(key.easingArgs) && key.easingArgs.length > 0) {
    payload.easingArgs = key.easingArgs;
  }
  if (key.bezier && typeof key.bezier === 'object') {
    payload.bezier = key.bezier;
  }
  return payload;
};

const serializeTriggers = (
  triggers: CanonicalAnimationTriggerTrack[]
): Partial<Record<'sound_effects' | 'particle_effects' | 'timeline', unknown>> => {
  const sound: Record<string, unknown> = {};
  const particle: Record<string, unknown> = {};
  const timeline: Record<string, unknown> = {};
  triggers.forEach((track) => {
    const target =
      track.type === 'sound'
        ? sound
        : track.type === 'particle'
          ? particle
          : timeline;
    track.keys.forEach((key) => {
      target[normalizeTimeKey(key.time)] = key.value;
    });
  });
  const entries: Partial<Record<'sound_effects' | 'particle_effects' | 'timeline', unknown>> = {};
  if (Object.keys(sound).length > 0) entries.sound_effects = sound;
  if (Object.keys(particle).length > 0) entries.particle_effects = particle;
  if (Object.keys(timeline).length > 0) entries.timeline = timeline;
  return entries;
};

const buildAnimationClip = (animation: CanonicalAnimation): Record<string, unknown> => {
  const bones: Record<string, Record<string, unknown>> = {};
  animation.channels.forEach((track) => {
    const target = (bones[track.bone] ?? {}) as Record<string, unknown>;
    const keys: Record<string, unknown> = {};
    track.keys.forEach((key) => {
      keys[normalizeTimeKey(key.time)] = serializeChannelKeyValue(key);
    });
    target[channelName(track.channel)] = keys;
    bones[track.bone] = target;
  });
  const triggerEntries = serializeTriggers(animation.triggers);
  let clip: Record<string, unknown> = {
    loop: animation.loop ? 'loop' : 'once',
    animation_length: sanitizeNumber(animation.length),
    bones
  };
  clip = withOptionalField(clip, 'sound_effects', triggerEntries.sound_effects);
  clip = withOptionalField(clip, 'particle_effects', triggerEntries.particle_effects);
  clip = withOptionalField(clip, 'timeline', triggerEntries.timeline);
  return clip;
};

const buildGeoArtifact = (model: CanonicalExportModel): Record<string, unknown> => ({
  format_version: GEO_FORMAT_VERSION,
  'minecraft:geometry': [
    {
      description: {
        identifier: `geometry.${sanitizeIdentifier(model.name)}`,
        texture_width: sanitizeNumber(model.texture.width),
        texture_height: sanitizeNumber(model.texture.height)
      },
      bones: model.bones.map((bone) => ({
        name: bone.name,
        ...(bone.parent ? { parent: bone.parent } : {}),
        pivot: sanitizeVec3(bone.pivot),
        ...(bone.rotation ? { rotation: sanitizeVec3(bone.rotation) } : {}),
        ...(bone.scale ? { scale: sanitizeVec3(bone.scale) } : {}),
        ...(bone.cubes.length > 0
          ? {
              cubes: bone.cubes.map((cube) => ({
                origin: sanitizeVec3(cube.from),
                size: [
                  sanitizeNumber(cube.to[0] - cube.from[0]),
                  sanitizeNumber(cube.to[1] - cube.from[1]),
                  sanitizeNumber(cube.to[2] - cube.from[2])
                ],
                ...(cube.uv ? { uv: [sanitizeNumber(cube.uv[0]), sanitizeNumber(cube.uv[1])] } : {}),
                ...(cube.inflate !== undefined ? { inflate: sanitizeNumber(cube.inflate) } : {}),
                ...(cube.mirror !== undefined ? { mirror: Boolean(cube.mirror) } : {})
              }))
            }
          : {})
      }))
    }
  ]
});

const buildAnimationArtifact = (model: CanonicalExportModel): Record<string, unknown> => {
  const clips: Record<string, unknown> = {};
  model.animations.forEach((animation) => {
    clips[animation.name] = buildAnimationClip(animation);
  });
  return {
    geckolib_format_version: GECKO_ANIMATION_FORMAT_VERSION,
    animations: clips
  };
};

export class GeckoGeoAnimCodec implements ExportCodecStrategy {
  readonly format = 'gecko_geo_anim' as const;

  encode(model: CanonicalExportModel): CodecEncodeResult {
    return {
      artifacts: [
        {
          id: 'geo',
          data: buildGeoArtifact(model),
          path: { mode: 'base_suffix', suffix: '.geo.json' },
          primary: true
        },
        {
          id: 'animation',
          data: buildAnimationArtifact(model),
          path: { mode: 'base_suffix', suffix: '.animation.json' }
        }
      ],
      warnings: [],
      lossy: false
    };
  }
}
