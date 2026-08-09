import type { Vec3 } from '../../../model';

export const multiplyVec3 = (
  value: Vec3,
  scale: number
): [number, number, number] => [
  value[0] * scale,
  value[1] * scale,
  value[2] * scale
];

export const subtractVec3 = (
  left: Vec3,
  right: Vec3
): [number, number, number] => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2]
];

export const addVec3 = (
  left: Vec3,
  right: Vec3
): [number, number, number] => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2]
];

export const quaternionFromEuler = (
  rotation: Vec3
): [number, number, number, number] => {
  const x = (rotation[0] * Math.PI) / 360;
  const y = (rotation[1] * Math.PI) / 360;
  const z = (rotation[2] * Math.PI) / 360;
  const sx = Math.sin(x);
  const cx = Math.cos(x);
  const sy = Math.sin(y);
  const cy = Math.cos(y);
  const sz = Math.sin(z);
  const cz = Math.cos(z);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
};

export const rotateVec3ByQuaternion = (
  value: Vec3,
  quaternion: readonly [number, number, number, number]
): [number, number, number] => {
  const [x, y, z, w] = quaternion;
  const crossX = y * value[2] - z * value[1];
  const crossY = z * value[0] - x * value[2];
  const crossZ = x * value[1] - y * value[0];
  const secondX = y * crossZ - z * crossY;
  const secondY = z * crossX - x * crossZ;
  const secondZ = x * crossY - y * crossX;
  return [
    value[0] + 2 * (w * crossX + secondX),
    value[1] + 2 * (w * crossY + secondY),
    value[2] + 2 * (w * crossZ + secondZ)
  ];
};

export const isIdentityRotation = (rotation: Vec3): boolean =>
  rotation.every((value) => Math.abs(value) <= 0.000001);

export const isIdentityScale = (scale: Vec3): boolean =>
  scale.every((value) => Math.abs(value - 1) <= 0.000001);
