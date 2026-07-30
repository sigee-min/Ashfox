import {
  IDENTITY_TRANSFORM,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type CubeFace,
  type CubeFaces,
  type ProjectDocument
} from '../src';

const face = (textureId: string): CubeFace => ({
  enabled: true,
  textureId,
  details: [],
  uv: [0, 0, 16, 16],
  rotation: 0
});

const createFaces = (textureId: string): CubeFaces => ({
  north: face(textureId),
  south: face(textureId),
  east: face(textureId),
  west: face(textureId),
  up: face(textureId),
  down: face(textureId)
});

export const createJavaProject = (): ProjectDocument => ({
  schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
  id: 'project-crate',
  name: 'ashfox_crate',
  revision: 'revision-1',
  formatProfile: {
    id: 'minecraft.java_block',
    version: '1.21.11',
    namespace: 'ashfox',
    modelPath: 'ashfox_crate',
    modelKind: 'block',
    ambientOcclusion: false,
    guiLight: 'front'
  },
  settings: {
    textureResolution: { width: 64, height: 64 },
    uvPixelsPerUnit: 4,
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
        name: 'root',
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
        name: 'body',
        parentId: 'bone-root',
        transform: {
          ...IDENTITY_TRANSFORM,
          rotation: [0, 45, 0],
          pivot: [0, 4, 0]
        },
        visible: true,
        bounds: {
          from: [-4, 0, -4],
          to: [4, 8, 4]
        },
        inflate: 0,
        mirror: false,
        boxUv: false,
        faces: createFaces('texture-base')
      }
    }
  },
  textures: {
    'texture-base': {
      id: 'texture-base',
      name: 'ashfox_crate',
      width: 64,
      height: 64,
      source: {
        bucket: 'textures',
        key: 'project-crate/ashfox_crate.png',
        contentType: 'image/png',
        contentHash: 'sha256:crate',
        byteLength: 256
      },
      visible: true,
      sampling: 'nearest',
      colorSpace: 'srgb',
      renderMode: 'default',
      renderSides: 'front',
      atlasMode: 'preserve',
      minecraft: {
        key: 'base',
        resource: {
          namespace: 'ashfox',
          path: 'block/ashfox_crate'
        },
        extension: 'png',
        particle: true
      }
    }
  },
  animations: {},
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z'
});

export const createBedrockProject = (): ProjectDocument => {
  const javaProject = createJavaProject();
  return {
    ...javaProject,
    formatProfile: {
      id: 'minecraft.bedrock',
      version: '1.21.0',
      animationFormatVersion: '1.8.0',
      namespace: 'ashfox',
      modelPath: 'ashfox_crate',
      animationPath: 'ashfox_crate',
      geometryKind: 'block',
      geometryIdentifier: 'geometry.ashfox_crate',
      visibleBounds: {
        width: 1,
        height: 1,
        offset: [0, 0.5, 0]
      }
    },
    scene: {
      ...javaProject.scene,
      nodes: {
        ...javaProject.scene.nodes,
        'cube-body': {
          ...javaProject.scene.nodes['cube-body'],
          kind: 'cube',
          boxUv: true,
          uvOffset: [0, 0]
        }
      }
    }
  } as ProjectDocument;
};

export const createAnimatedBedrockProject = (): ProjectDocument => {
  const project = createBedrockProject();
  return {
    ...project,
    scene: {
      ...project.scene,
      nodes: {
        ...project.scene.nodes,
        'locator-effect': {
          id: 'locator-effect',
          kind: 'locator',
          name: 'effect',
          parentId: 'bone-root',
          transform: {
            ...IDENTITY_TRANSFORM,
            position: [0, 8, 0]
          },
          visible: true
        }
      }
    },
    animations: {
      'clip-idle': {
        id: 'clip-idle',
        name: 'animation.ashfox_crate.idle',
        durationSeconds: 1,
        fps: 20,
        loop: 'loop',
        channels: {
          'channel-root-rotation': {
            id: 'channel-root-rotation',
            targetNodeId: 'bone-root',
            property: 'rotation',
            keys: [
              {
                id: 'key-root-start',
                timeSeconds: 0,
                value: [0, 0, 0],
                interpolation: 'linear'
              },
              {
                id: 'key-root-end',
                timeSeconds: 1,
                value: [0, 30, 0],
                interpolation: 'linear'
              }
            ]
          }
        },
        triggers: {
          'trigger-particle': {
            id: 'trigger-particle',
            type: 'particle',
            keys: [
              {
                id: 'key-particle',
                timeSeconds: 0.5,
                value: {
                  effect: 'ashfox:crate_spark',
                  locatorId: 'locator-effect',
                  bindToActor: true
                }
              }
            ]
          },
          'trigger-timeline': {
            id: 'trigger-timeline',
            type: 'timeline',
            keys: [
              {
                id: 'key-timeline',
                timeSeconds: 0.75,
                value: 'variable.phase = 1.0;'
              }
            ]
          }
        }
      }
    }
  };
};

export const createGeckoLib5Project = (): ProjectDocument => {
  const project = createAnimatedBedrockProject();
  return {
    ...project,
    formatProfile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '1.21.11',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      namespace: 'ashfox',
      assetKind: 'block',
      modelPath: 'ashfox_crate',
      animationPath: 'ashfox_crate',
      geometryIdentifier: 'geometry.ashfox_crate',
      visibleBounds: {
        width: 1,
        height: 1,
        offset: [0, 0.5, 0]
      }
    }
  };
};

export const createGltfProject = (
  container: 'gltf' | 'glb' = 'gltf',
  imageStorage: 'external' | 'embedded' = 'external'
): ProjectDocument => {
  const project = createAnimatedBedrockProject();
  const clip = project.animations['clip-idle'];
  return {
    ...project,
    formatProfile: {
      id: 'gltf.2',
      version: '2.0',
      container,
      imageStorage,
      modelPath: 'ashfox_crate'
    },
    animations: {
      'clip-idle': {
        ...clip,
        name: 'Idle',
        triggers: {}
      }
    }
  };
};
