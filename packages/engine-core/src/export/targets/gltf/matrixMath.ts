import type { Vec3 } from '../../../model';

export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export const IDENTITY_MAT4: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];

export const multiplyMat4 = (left: Mat4, right: Mat4): Mat4 => {
  const result = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        result[column * 4 + row] +=
          left[inner * 4 + row] * right[column * 4 + inner];
      }
    }
  }
  return [
    result[0], result[1], result[2], result[3],
    result[4], result[5], result[6], result[7],
    result[8], result[9], result[10], result[11],
    result[12], result[13], result[14], result[15]
  ];
};

export const composeMat4 = (
  translation: Vec3,
  rotation: readonly [number, number, number, number],
  scale: Vec3
): Mat4 => {
  const [x, y, z, w] = rotation;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - yy - zz) * scale[0],
    (xy + wz) * scale[0],
    (xz - wy) * scale[0],
    0,
    (xy - wz) * scale[1],
    (1 - xx - zz) * scale[1],
    (yz + wx) * scale[1],
    0,
    (xz + wy) * scale[2],
    (yz - wx) * scale[2],
    (1 - xx - yy) * scale[2],
    0,
    translation[0],
    translation[1],
    translation[2],
    1
  ];
};

export const invertAffineMat4 = (matrix: Mat4): Mat4 | null => {
  const [a00, a10, a20] = matrix;
  const a01 = matrix[4];
  const a11 = matrix[5];
  const a21 = matrix[6];
  const a02 = matrix[8];
  const a12 = matrix[9];
  const a22 = matrix[10];
  const determinant =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-12) {
    return null;
  }
  const reciprocal = 1 / determinant;
  const i00 = (a11 * a22 - a12 * a21) * reciprocal;
  const i01 = (a02 * a21 - a01 * a22) * reciprocal;
  const i02 = (a01 * a12 - a02 * a11) * reciprocal;
  const i10 = (a12 * a20 - a10 * a22) * reciprocal;
  const i11 = (a00 * a22 - a02 * a20) * reciprocal;
  const i12 = (a02 * a10 - a00 * a12) * reciprocal;
  const i20 = (a10 * a21 - a11 * a20) * reciprocal;
  const i21 = (a01 * a20 - a00 * a21) * reciprocal;
  const i22 = (a00 * a11 - a01 * a10) * reciprocal;
  const [tx, ty, tz] = [matrix[12], matrix[13], matrix[14]];
  return [
    i00, i10, i20, 0,
    i01, i11, i21, 0,
    i02, i12, i22, 0,
    -(i00 * tx + i01 * ty + i02 * tz),
    -(i10 * tx + i11 * ty + i12 * tz),
    -(i20 * tx + i21 * ty + i22 * tz),
    1
  ];
};

export const transformPointMat4 = (
  matrix: Mat4,
  point: Vec3
): [number, number, number] => [
  matrix[0] * point[0] + matrix[4] * point[1] +
    matrix[8] * point[2] + matrix[12],
  matrix[1] * point[0] + matrix[5] * point[1] +
    matrix[9] * point[2] + matrix[13],
  matrix[2] * point[0] + matrix[6] * point[1] +
    matrix[10] * point[2] + matrix[14]
];

export const transformNormalMat4 = (
  matrix: Mat4,
  normal: Vec3
): [number, number, number] | null => {
  const inverse = invertAffineMat4(matrix);
  if (!inverse) return null;
  const transformed: [number, number, number] = [
    inverse[0] * normal[0] + inverse[1] * normal[1] + inverse[2] * normal[2],
    inverse[4] * normal[0] + inverse[5] * normal[1] + inverse[6] * normal[2],
    inverse[8] * normal[0] + inverse[9] * normal[1] + inverse[10] * normal[2]
  ];
  const length = Math.hypot(...transformed);
  return length <= 1e-12
    ? null
    : transformed.map((value) => value / length) as [number, number, number];
};
