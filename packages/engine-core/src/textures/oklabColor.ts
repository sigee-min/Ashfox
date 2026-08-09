export interface OklabColor {
  l: number;
  a: number;
  b: number;
}

interface UnitRgbColor {
  r: number;
  g: number;
  b: number;
}

const clampUnit = (value: number): number =>
  Math.min(1, Math.max(0, value));

const srgbToLinear = (value: number): number => {
  const channel = clampUnit(value / 255);
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (value: number): number => {
  const channel = clampUnit(value);
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
};

export const rgbToOklab = (
  color: { r: number; g: number; b: number }
): OklabColor => {
  const red = srgbToLinear(color.r);
  const green = srgbToLinear(color.g);
  const blue = srgbToLinear(color.b);
  const l = 0.4122214708 * red +
    0.5363325363 * green +
    0.0514459929 * blue;
  const m = 0.2119034982 * red +
    0.6806995451 * green +
    0.1073969566 * blue;
  const s = 0.0883024619 * red +
    0.2817188376 * green +
    0.6299787005 * blue;
  const rootL = Math.cbrt(l);
  const rootM = Math.cbrt(m);
  const rootS = Math.cbrt(s);
  return {
    l: 0.2104542553 * rootL +
      0.793617785 * rootM -
      0.0040720468 * rootS,
    a: 1.9779984951 * rootL -
      2.428592205 * rootM +
      0.4505937099 * rootS,
    b: 0.0259040371 * rootL +
      0.7827717662 * rootM -
      0.808675766 * rootS
  };
};

const oklabToLinearRgb = (color: OklabColor): UnitRgbColor => {
  const rootL = color.l + 0.3963377774 * color.a + 0.2158037573 * color.b;
  const rootM = color.l - 0.1055613458 * color.a - 0.0638541728 * color.b;
  const rootS = color.l - 0.0894841775 * color.a - 1.291485548 * color.b;
  const l = rootL ** 3;
  const m = rootM ** 3;
  const s = rootS ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  };
};

const inSrgbGamut = (color: UnitRgbColor): boolean =>
  color.r >= 0 && color.r <= 1 &&
  color.g >= 0 && color.g <= 1 &&
  color.b >= 0 && color.b <= 1;

const gamutMappedLinearRgb = (color: OklabColor): UnitRgbColor => {
  const direct = oklabToLinearRgb(color);
  if (inSrgbGamut(direct)) return direct;
  let minimum = 0;
  let maximum = 1;
  let mapped = oklabToLinearRgb({ l: color.l, a: 0, b: 0 });
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const retention = (minimum + maximum) / 2;
    const candidate = oklabToLinearRgb({
      l: color.l,
      a: color.a * retention,
      b: color.b * retention
    });
    if (inSrgbGamut(candidate)) {
      minimum = retention;
      mapped = candidate;
    } else {
      maximum = retention;
    }
  }
  return mapped;
};

export const gamutMappedOklabToRgb = (
  color: OklabColor
): { r: number; g: number; b: number } => {
  const linear = gamutMappedLinearRgb({
    l: clampUnit(color.l),
    a: color.a,
    b: color.b
  });
  return {
    r: Math.round(linearToSrgb(linear.r) * 255),
    g: Math.round(linearToSrgb(linear.g) * 255),
    b: Math.round(linearToSrgb(linear.b) * 255)
  };
};
