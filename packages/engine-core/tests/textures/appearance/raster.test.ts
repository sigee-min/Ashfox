import assert from 'node:assert/strict';

import { sha256ByteDigest } from '../../../src/provenance/program/digest';
import type { ProjectDocument } from '../../../src/model';
import { createProjectDocument } from '../../../src/project/create';
import {
  SURFACE_APPEARANCE_VERSION,
  SURFACE_SYNTHESIS_VERSION,
  buildGeneratedSurfaceToneField,
  createSurfaceAppearanceCompiler,
  generatedSurfaceTonePalette,
  generatedSurfaceToneRole,
  type SurfaceAppearanceV1
} from '../../../src/textures/appearance';
import { createTextureAsset } from '../../../src/textures/createTextureAsset';
import { ensureGeneratedTexture } from '../../../src/textures/generatedMaterial';
import { generatedSurfacePixel } from '../../../src/textures/appearance/pixel';
import {
  buildSurfacePatternComponents,
  type SurfacePatternComponent
} from '../../../src/textures/appearance/components';
import type { TextureCompositionRegion } from '../../../src/textures/textureRecipe/types';
import {
  compileTextureSurfaceAuthority
} from '../../../src/textures/textureRecipe/surfaceMetrics';
import { validateProjectDocument } from '../../../src/validation';
import { createSceneProject } from '../../helpers';

const component = (): SurfacePatternComponent => {
  const components = buildSurfacePatternComponents([{
    id: 'face',
    ownerKey: 'body',
    groupKey: 'body:south',
    x: 0,
    y: 0,
    width: 32,
    height: 32
  }]);
  const value = components.get('face');
  if (!value) throw new Error('Missing appearance test component.');
  return value;
};

const appearance = (
  contrast: SurfaceAppearanceV1['texture']['contrast'] = 'subtle'
): SurfaceAppearanceV1 => ({
  version: SURFACE_APPEARANCE_VERSION,
  seed: { kind: 'explicit', value: 'raster-seed' },
  semanticOwnerKey: 'body',
  domain: 'organism',
  texture: {
    kind: 'mottle',
    scale: 'broad',
    density: 'balanced',
    contrast
  },
  decoration: 'body',
  geometry: 'mass',
  faceDirection: 'south',
  faceAspect: 'anterior',
  plane: 16,
  attachmentPoints: [],
  protectedRegions: [],
  frame: {
    forward: [0, 0, 1],
    left: [1, 0, 0],
    up: [0, 1, 0],
    lateralRange: { minimum: 0, maximum: 32 },
    upRange: { minimum: -32, maximum: 0 },
    forwardRange: { minimum: 0, maximum: 32 }
  },
  tonePolicy: 'regular'
});

const regionFor = (
  color: string,
  field = buildGeneratedSurfaceToneField(component(), appearance())
): TextureCompositionRegion => ({
  nodeId: 'body-cube',
  face: 'south',
  tonePolicy: 'regular',
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  color,
  pattern: {
    seedKey: 'body:south',
    tonePolicy: 'regular',
    toneField: field,
    origin: [0, 0],
    bounds: field.bounds
  }
});

const field = buildGeneratedSurfaceToneField(component(), appearance());
const ocean = regionFor('#2f7f91', field);
const ember = regionFor('#bd633e', field);
const oceanPalette = generatedSurfaceTonePalette(
  { r: 47, g: 127, b: 145 },
  'south',
  'subtle'
);
let baseCount = 0;
let paletteDifferenceCount = 0;
for (let y = 0; y < 32; y += 1) {
  for (let x = 0; x < 32; x += 1) {
    const role = generatedSurfaceToneRole(field, x, y);
    const oceanPixel = generatedSurfacePixel(ocean, x, y);
    assert.deepEqual(oceanPixel, oceanPalette[role]);
    baseCount += Number(role === 'base');
    paletteDifferenceCount += Number(
      JSON.stringify(oceanPixel) !== JSON.stringify(
        generatedSurfacePixel(ember, x, y)
      )
    );
  }
}
assert.ok(baseCount / (32 * 32) >= 0.78);
assert.equal(paletteDifferenceCount, 32 * 32);
const goldenRgba = new Uint8Array(32 * 32 * 4);
for (let index = 0; index < 32 * 32; index += 1) {
  const pixel = generatedSurfacePixel(
    ocean,
    index % 32,
    Math.floor(index / 32)
  );
  goldenRgba.set([pixel.r, pixel.g, pixel.b, 255], index * 4);
}
assert.equal(
  sha256ByteDigest(goldenRgba),
  'sha256:1e35c2d4f68968b7f0b3cd555a2315a1ca0cab3562192f191187ed2ac8aa531a',
  'Surface Synthesis 1 must not change representative raw RGBA bytes'
);

const boldField = buildGeneratedSurfaceToneField(component(), appearance('bold'));
assert.deepEqual(boldField.shadowKeys, field.shadowKeys);
assert.deepEqual(boldField.lightKeys, field.lightKeys);
const bold = regionFor('#2f7f91', boldField);
assert.ok(Array.from({ length: 32 * 32 }, (_, index) => {
  const x = index % 32;
  const y = Math.floor(index / 32);
  return JSON.stringify(generatedSurfacePixel(ocean, x, y)) !==
    JSON.stringify(generatedSurfacePixel(bold, x, y));
}).some(Boolean), 'contrast must alter tone distance without altering the mask');
for (const extreme of [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 }
]) {
  assert.deepEqual(
    generatedSurfaceTonePalette(extreme, 'up', 'subtle').base,
    generatedSurfaceTonePalette(extreme, 'up', 'bold').base,
    'contrast must preserve the base projection even at gamut edges'
  );
}

const flatRegion: TextureCompositionRegion = {
  nodeId: 'legacy-face',
  face: 'south',
  tonePolicy: 'regular',
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  color: '#2f7f91'
};
const flatPixels = new Set(Array.from({ length: 32 * 32 }, (_, index) =>
  JSON.stringify(generatedSurfacePixel(
    flatRegion,
    index % 32,
    Math.floor(index / 32)
  ))
));
assert.equal(
  flatPixels.size,
  1,
  'a missing appearance plan must fall back to base, never legacy 50:50 paint'
);

const seedDocument = createProjectDocument({
  id: 'appearance-seed',
  name: 'Appearance seed',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
});
const recoloredDocument: ProjectDocument = {
  ...seedDocument,
  id: 'appearance-seed-copy',
  name: 'Renamed display asset',
  revision: 'revision-9',
  textures: {
    palette: createTextureAsset(seedDocument, {
      id: 'palette',
      name: 'Palette',
      background: '#ff00ff'
    })
  }
};
const bounds = {
  min: { x: -4, y: 0, z: -4 },
  max: { x: 4, y: 8, z: 4 }
};
const firstCompiler = createSurfaceAppearanceCompiler(seedDocument, bounds);
const recoloredCompiler = createSurfaceAppearanceCompiler(
  recoloredDocument,
  bounds
);
assert.deepEqual(
  firstCompiler.appearanceFor('body', 'mass', 'south', 4, 'regular').seed,
  recoloredCompiler.appearanceFor('body', 'mass', 'south', 4, 'regular').seed,
  'automatic seed projection must exclude palette and document identity fields'
);
const sceneOrderedCompiler = createSurfaceAppearanceCompiler(
  createSceneProject(),
  bounds
);
assert.deepEqual(
  firstCompiler.appearanceFor('body', 'mass', 'south', 4, 'regular').seed,
  sceneOrderedCompiler.appearanceFor('body', 'mass', 'south', 4, 'regular').seed,
  'automatic seed projection must exclude atlas and generated node ordering'
);
const textureControls = {
  kind: 'mottle',
  scale: 'broad',
  density: 'balanced'
} as const;
const subtleSeed = createSurfaceAppearanceCompiler(seedDocument, bounds, {
  texture: { ...textureControls, contrast: 'subtle' }
}).appearanceFor('body', 'mass', 'south', 4, 'regular').seed;
const boldSeed = createSurfaceAppearanceCompiler(seedDocument, bounds, {
  texture: { ...textureControls, contrast: 'bold' }
}).appearanceFor('body', 'mass', 'south', 4, 'regular').seed;
assert.deepEqual(
  subtleSeed,
  boldSeed,
  'automatic seed projection must exclude contrast'
);

const scaled = createSurfaceAppearanceCompiler(seedDocument, bounds, {
  coordinateScale: 16,
  seed: { kind: 'explicit', value: 'scaled' }
}).appearanceFor(
  'body',
  'mass',
  'south',
  4,
  'focal',
  [{ x: 1, y: 2, width: 3, height: 4 }]
);
assert.equal(scaled.plane, 64);
assert.deepEqual(scaled.frame.lateralRange, { minimum: -64, maximum: 64 });
assert.deepEqual(scaled.frame.upRange, { minimum: 0, maximum: 128 });
assert.deepEqual(
  scaled.protectedRegions,
  [{ x: 16, y: 32, width: 48, height: 64 }]
);
assert.throws(() => createSurfaceAppearanceCompiler(seedDocument, bounds, {
  coordinateScale: 0
}), /coordinate scale must be positive/);
assert.ok(Object.isFrozen(firstCompiler.frame.forward));

const projectAtUnit = (
  unit: 'pixel' | 'block',
  scale: number
): ProjectDocument => {
  const project = createSceneProject();
  const cube = project.scene.nodes['cube-body'];
  if (!cube || cube.kind !== 'cube') throw new Error('Missing fixture cube.');
  return {
    ...project,
    settings: {
      ...project.settings,
      coordinateSystem: { ...project.settings.coordinateSystem, unit }
    },
    scene: {
      ...project.scene,
      nodes: {
        ...project.scene.nodes,
        [cube.id]: {
          ...cube,
          bounds: {
            from: cube.bounds.from.map((value) => value * scale) as
              [number, number, number],
            to: cube.bounds.to.map((value) => value * scale) as
              [number, number, number]
          },
          generation: {
            authority: 'ashfox.part-compiler',
            role: 'geometry',
            partId: 'body',
            parentPartId: null,
            materialId: 'material.body',
            primitive: 'mass',
            joint: { kind: 'fixed' }
          }
        }
      }
    }
  };
};
const blockAuthority = compileTextureSurfaceAuthority(
  projectAtUnit('block', 1)
);
const pixelAuthority = compileTextureSurfaceAuthority(
  projectAtUnit('pixel', 16)
);
const blockFace = blockAuthority.faces.get('cube-body:south')?.pattern;
const pixelFace = pixelAuthority.faces.get('cube-body:south')?.pattern;
assert.ok(blockFace && pixelFace);
assert.deepEqual(
  blockFace.toneField,
  pixelFace.toneField,
  'equivalent pixel and block documents must sample one object-space mask'
);
assert.deepEqual(blockFace.origin, pixelFace.origin);
assert.deepEqual(blockFace.bounds, pixelFace.bounds);

assert.equal(SURFACE_APPEARANCE_VERSION, 1);
assert.equal(SURFACE_SYNTHESIS_VERSION, 1);
const generatedTexture = createTextureAsset(seedDocument, {
  id: 'generated',
  name: 'Generated'
});
assert.equal(
  generatedTexture.metadata?.surfaceSynthesisVersion,
  SURFACE_SYNTHESIS_VERSION
);
assert.equal(createTextureAsset(seedDocument, {
  id: 'preserved',
  name: 'Preserved',
  atlasMode: 'preserve'
}).metadata?.surfaceSynthesisVersion, undefined);
const texturedDocument: ProjectDocument = {
  ...seedDocument,
  textures: { generated: generatedTexture }
};
assert.equal(
  validateProjectDocument(texturedDocument).findings.some((finding) =>
    finding.code === 'texture.invalid_surface_synthesis_version'
  ),
  false
);

for (const version of [undefined, 2] as const) {
  const invalid = {
    ...texturedDocument,
    textures: {
      generated: {
        ...generatedTexture,
        metadata: version === undefined
          ? { previewColor: '#8e98a3' }
          : {
              previewColor: '#8e98a3',
              surfaceSynthesisVersion: version
            }
      }
    }
  };
  assert.ok(validateProjectDocument(invalid).findings.some((finding) =>
    finding.path === 'textures.generated.metadata.surfaceSynthesisVersion' &&
    finding.message.includes('must equal 1')
  ));
}

const staleDocument = {
  ...texturedDocument,
  textures: {
    generated: {
      ...generatedTexture,
      metadata: { previewColor: '#8e98a3' }
    }
  }
} as ProjectDocument;
const upgraded = ensureGeneratedTexture(staleDocument);
assert.equal(upgraded.createdTextureId, null);
assert.equal(
  upgraded.document.textures.generated?.metadata?.surfaceSynthesisVersion,
  SURFACE_SYNTHESIS_VERSION
);
