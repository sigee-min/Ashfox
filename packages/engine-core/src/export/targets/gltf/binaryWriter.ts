import type { GltfAccessor, GltfBufferView } from './types';

export interface GltfBinaryState {
  bufferViews: GltfBufferView[];
  accessors: GltfAccessor[];
}

const align4 = (value: number): number => (value + 3) & ~3;

export class GltfBinaryWriter {
  private bytes: number[] = [];
  readonly state: GltfBinaryState = {
    bufferViews: [],
    accessors: []
  };

  get byteLength(): number {
    return this.bytes.length;
  }

  addFloatAccessor(
    values: readonly number[],
    componentCount: 1 | 2 | 3 | 4,
    includeBounds: boolean,
    target?: 34962
  ): number {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    values.forEach((value, index) => {
      view.setFloat32(index * 4, value, true);
    });
    const bufferView = this.append(bytes, target);
    const count = values.length / componentCount;
    const accessor: GltfAccessor = {
      bufferView,
      componentType: 5126,
      count,
      type:
        componentCount === 1
          ? 'SCALAR'
          : componentCount === 2
            ? 'VEC2'
            : componentCount === 3
              ? 'VEC3'
              : 'VEC4'
    };
    if (includeBounds && count > 0) {
      const min = new Array<number>(componentCount).fill(Number.POSITIVE_INFINITY);
      const max = new Array<number>(componentCount).fill(Number.NEGATIVE_INFINITY);
      for (let index = 0; index < values.length; index += componentCount) {
        for (let component = 0; component < componentCount; component += 1) {
          const value = values[index + component];
          min[component] = Math.min(min[component], value);
          max[component] = Math.max(max[component], value);
        }
      }
      accessor.min = min;
      accessor.max = max;
    }
    this.state.accessors.push(accessor);
    return this.state.accessors.length - 1;
  }

  addIndexAccessor(values: readonly number[], target: 34963 = 34963): number {
    const useUint32 = values.some((value) => value > 65535);
    const bytes = new Uint8Array(values.length * (useUint32 ? 4 : 2));
    const view = new DataView(bytes.buffer);
    values.forEach((value, index) => {
      if (useUint32) {
        view.setUint32(index * 4, value, true);
      } else {
        view.setUint16(index * 2, value, true);
      }
    });
    const bufferView = this.append(bytes, target);
    this.state.accessors.push({
      bufferView,
      componentType: useUint32 ? 5125 : 5123,
      count: values.length,
      type: 'SCALAR',
      ...(values.length > 0
        ? {
            min: [Math.min(...values)],
            max: [Math.max(...values)]
          }
        : {})
    });
    return this.state.accessors.length - 1;
  }

  addBufferView(bytes: Uint8Array): number {
    return this.append(bytes);
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  private append(bytes: Uint8Array, target?: 34962 | 34963): number {
    const alignedOffset = align4(this.bytes.length);
    while (this.bytes.length < alignedOffset) this.bytes.push(0);
    const byteOffset = this.bytes.length;
    this.bytes.push(...bytes);
    this.state.bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: bytes.byteLength,
      ...(target ? { target } : {})
    });
    return this.state.bufferViews.length - 1;
  }
}
