import {
  IDENTITY_TRANSFORM,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type CubeFace,
  type CubeFaces,
  type ProjectDocument,
  type TextureAsset
} from '@ashfox/engine-core';

export const WORKBENCH_PROJECT_ID = 'project-copper-fox';

const face = (textureId: string): CubeFace => ({
  enabled: true,
  textureId,
  uv: [0, 0, 32, 32],
  rotation: 0
});

const faces = (textureId: string): CubeFaces => ({
  north: face(textureId),
  south: face(textureId),
  east: face(textureId),
  west: face(textureId),
  up: face(textureId),
  down: face(textureId)
});

const texture = (
  id: string,
  name: string,
  color: string
): TextureAsset => ({
  id,
  name,
  width: 32,
  height: 32,
  source: {
    bucket: 'textures',
    key: `workbench/${id}.png`,
    contentType: 'image/png',
    contentHash: `sha256:preview-${id}`
  },
  visible: true,
  sampling: 'nearest',
  colorSpace: 'srgb',
  renderMode: 'default',
  renderSides: 'double',
  pbrChannel: 'color',
  metadata: {
    previewColor: color
  }
});

export const createWorkbenchProject = (): ProjectDocument => ({
  schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
  id: WORKBENCH_PROJECT_ID,
  name: 'Copper Fox',
  revision: 'local-0001',
  formatProfile: {
    id: 'gltf.2',
    version: '2.0',
    container: 'glb',
    imageStorage: 'embedded',
    modelPath: 'copper_fox'
  },
  settings: {
    textureResolution: {
      width: 32,
      height: 32
    },
    uvPixelsPerUnit: 2,
    coordinateSystem: {
      up: 'y',
      handedness: 'right',
      unit: 'pixel',
      rotationUnit: 'degree',
      rotationOrder: 'xyz'
    }
  },
  scene: {
    roots: ['bone-root'],
    nodes: {
      'bone-root': {
        id: 'bone-root',
        kind: 'bone',
        name: 'Root',
        parentId: null,
        transform: {
          ...IDENTITY_TRANSFORM,
          pivot: [0, 0, 0]
        },
        visible: true
      },
      'cube-body': {
        id: 'cube-body',
        kind: 'cube',
        name: 'Body',
        parentId: 'bone-root',
        transform: {
          ...IDENTITY_TRANSFORM,
          pivot: [0, 6, 0]
        },
        visible: true,
        bounds: {
          from: [-4, 1, -3],
          to: [4, 11, 3]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: faces('texture-copper')
      },
      'bone-head': {
        id: 'bone-head',
        kind: 'bone',
        name: 'Head',
        parentId: 'bone-root',
        transform: {
          ...IDENTITY_TRANSFORM,
          pivot: [0, 12, 0]
        },
        visible: true
      },
      'cube-head': {
        id: 'cube-head',
        kind: 'cube',
        name: 'Head shell',
        parentId: 'bone-head',
        transform: {
          ...IDENTITY_TRANSFORM,
          pivot: [0, 12, 0]
        },
        visible: true,
        bounds: {
          from: [-4.5, 9, -4],
          to: [4.5, 16, 4]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: faces('texture-copper')
      },
      'cube-muzzle': {
        id: 'cube-muzzle',
        kind: 'cube',
        name: 'Muzzle',
        parentId: 'bone-head',
        transform: {
          ...IDENTITY_TRANSFORM,
          pivot: [0, 12, 0]
        },
        visible: true,
        bounds: {
          from: [-3, 9.25, -6],
          to: [3, 13, -3.5]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: faces('texture-cream')
      },
      'cube-ear-left': {
        id: 'cube-ear-left',
        kind: 'cube',
        name: 'Ear L',
        parentId: 'bone-head',
        transform: {
          ...IDENTITY_TRANSFORM,
          rotation: [0, 0, -8],
          pivot: [-2.75, 16, 0]
        },
        visible: true,
        bounds: {
          from: [-4.5, 15, -2],
          to: [-1, 20, 2]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: faces('texture-copper')
      },
      'cube-ear-right': {
        id: 'cube-ear-right',
        kind: 'cube',
        name: 'Ear R',
        parentId: 'bone-head',
        transform: {
          ...IDENTITY_TRANSFORM,
          rotation: [0, 0, 8],
          pivot: [2.75, 16, 0]
        },
        visible: true,
        bounds: {
          from: [1, 15, -2],
          to: [4.5, 20, 2]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: faces('texture-copper')
      },
      'bone-tail': {
        id: 'bone-tail',
        kind: 'bone',
        name: 'Tail',
        parentId: 'bone-root',
        transform: {
          ...IDENTITY_TRANSFORM,
          rotation: [18, 0, -22],
          pivot: [0, 5, 3]
        },
        visible: true
      },
      'cube-tail': {
        id: 'cube-tail',
        kind: 'cube',
        name: 'Tail tip',
        parentId: 'bone-tail',
        transform: {
          ...IDENTITY_TRANSFORM,
          pivot: [0, 5, 3]
        },
        visible: true,
        bounds: {
          from: [-2, 3, 3],
          to: [2, 8, 12]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: faces('texture-cream')
      }
    }
  },
  textures: {
    'texture-copper': texture('texture-copper', 'Copper fur', '#bd663f'),
    'texture-cream': texture('texture-cream', 'Cream details', '#e7cda4')
  },
  animations: {
    'clip-idle': {
      id: 'clip-idle',
      name: 'Idle',
      durationSeconds: 2,
      fps: 24,
      loop: 'loop',
      channels: {
        'channel-head': {
          id: 'channel-head',
          targetNodeId: 'bone-head',
          property: 'rotation',
          keys: [
            {
              id: 'head-0',
              timeSeconds: 0,
              value: [0, -7, 0],
              interpolation: 'linear'
            },
            {
              id: 'head-1',
              timeSeconds: 1,
              value: [0, 7, 0],
              interpolation: 'linear'
            },
            {
              id: 'head-2',
              timeSeconds: 2,
              value: [0, -7, 0],
              interpolation: 'linear'
            }
          ]
        },
        'channel-tail': {
          id: 'channel-tail',
          targetNodeId: 'bone-tail',
          property: 'rotation',
          keys: [
            {
              id: 'tail-0',
              timeSeconds: 0,
              value: [18, 0, -28],
              interpolation: 'linear'
            },
            {
              id: 'tail-1',
              timeSeconds: 0.5,
              value: [18, 0, 2],
              interpolation: 'linear'
            },
            {
              id: 'tail-2',
              timeSeconds: 1,
              value: [18, 0, -28],
              interpolation: 'linear'
            },
            {
              id: 'tail-3',
              timeSeconds: 1.5,
              value: [18, 0, 2],
              interpolation: 'linear'
            },
            {
              id: 'tail-4',
              timeSeconds: 2,
              value: [18, 0, -28],
              interpolation: 'linear'
            }
          ]
        }
      },
      triggers: {}
    }
  },
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z'
});
