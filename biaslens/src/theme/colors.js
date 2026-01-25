// src/theme/colors.js
export const TYPE_OKLCH = {
  bias: { L: 0.72, C: 0.14, h: 340 },
  fallacy: { L: 0.74, C: 0.13, h: 75 },
  tactic: { L: 0.74, C: 0.12, h: 210 },
  factcheck: { L: 0.72, C: 0.13, h: 280 },
};

// --- OKLCH -> OKLab
export function oklchToOklab({ L, C, h }) {
  const hr = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(hr), b: C * Math.sin(hr) };
}

// --- OKLab -> linear sRGB
export function oklabToLinearSRGB({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

function linearToSRGBChannel(x) {
  x = Math.min(1.0, Math.max(0.0, x));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

export function oklchToRgb({ L, C, h }) {
  const lab = oklchToOklab({ L, C, h });
  const lin = oklabToLinearSRGB(lab);
  return {
    r: Math.round(255 * linearToSRGBChannel(lin.r)),
    g: Math.round(255 * linearToSRGBChannel(lin.g)),
    b: Math.round(255 * linearToSRGBChannel(lin.b)),
  };
}

export function rgbCss({ r, g, b }) {
  return `rgb(${r} ${g} ${b})`; // space form supports alpha: rgb(r g b / a)
}

export const TYPE_RGB = Object.fromEntries(
  Object.entries(TYPE_OKLCH).map(([k, v]) => [k, oklchToRgb(v)])
);

export const TYPE_SOLID = Object.fromEntries(
  Object.entries(TYPE_RGB).map(([k, rgb]) => [k, rgbCss(rgb)])
);

// Optional: CSS variable payload, so components can just use var(--type-bias)
export function applyThemeVars(root = document.documentElement) {
  for (const [k, rgb] of Object.entries(TYPE_RGB)) {
    root.style.setProperty(`--type-${k}`, `${rgb.r} ${rgb.g} ${rgb.b}`); // "r g b"
  }
  // If you want a single “brand” accent across UI:
  root.style.setProperty(`--brand`, root.style.getPropertyValue(`--type-factcheck`));
}