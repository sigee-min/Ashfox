import type { CubeFaceDirection } from './shared';

export type TextureUsageCube = {
  readonly id?: string;
  readonly name: string;
  readonly faces: readonly {
    readonly face: CubeFaceDirection;
    readonly uv?: readonly [number, number, number, number];
  }[];
};

export type TextureUsageEntry = {
  readonly id?: string;
  readonly name: string;
  readonly width?: number;
  readonly height?: number;
  readonly cubeCount: number;
  readonly faceCount: number;
  readonly cubes: readonly TextureUsageCube[];
};

export type TextureUsageUnresolved = {
  readonly textureRef: string;
  readonly cubeId?: string;
  readonly cubeName: string;
  readonly face: CubeFaceDirection;
};

export type TextureUsageResult = {
  readonly textures: readonly TextureUsageEntry[];
  readonly unresolved?: readonly TextureUsageUnresolved[];
};

export type TextureUsageQuery = {
  readonly textureId?: string;
  readonly textureName?: string;
};
