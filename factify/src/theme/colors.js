// src/theme/colors.js — Pentachromal OKLCH color engine
// Single source of truth: every component imports from here.

// ─── Scheme parameters ─────────────────────────────
// 5 hues at 72° equidistant, uniform lightness & chroma.
const SCHEME_L = 0.58;
const SCHEME_C = 0.10;
const DARK_SCHEME_L = 0.72; // boosted lightness for dark backgrounds

// ─── Raw OKLCH definitions ─────────────────────────
// Hues: 25 → 97 → 169 → 241 → 313  (Δ72°)
const RAW_OKLCH = {
  structure: { L: SCHEME_L, C: SCHEME_C, h: 97  }, // gold / amber
  relevance: { L: SCHEME_L, C: SCHEME_C, h: 241 }, // blue
  evidence:  { L: SCHEME_L, C: SCHEME_C, h: 169 }, // teal
  framing:   { L: SCHEME_L, C: SCHEME_C, h: 313 }, // magenta
  language:  { L: SCHEME_L, C: SCHEME_C, h: 25  }, // warm coral
  factcheck: { L: SCHEME_L, C: SCHEME_C, h: 313 }, // alias → framing
};


// ═══════════════════════════════════════════════════
//  Forward pipeline: OKLCH → OKLab → linear sRGB → sRGB
// ═══════════════════════════════════════════════════

export function oklchToOklab({ L, C, h }) {
  const hr = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(hr), b: C * Math.sin(hr) };
}

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
  x = Math.max(0.0, Math.min(1.0, x));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}


// ═══════════════════════════════════════════════════
//  Inverse pipeline: sRGB → linear sRGB → OKLab
// ═══════════════════════════════════════════════════

function srgbToLinearChannel(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function linearSrgbToOklab({ r, g, b }) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/** Convert 0-255 sRGB to OKLab. */
export function srgbToOklab(r, g, b) {
  return linearSrgbToOklab({
    r: srgbToLinearChannel(r),
    g: srgbToLinearChannel(g),
    b: srgbToLinearChannel(b),
  });
}

/** Convert OKLab {L, a, b} back to 0-255 sRGB. */
export function oklabToSrgb({ L, a, b }) {
  const lin = oklabToLinearSRGB({ L, a, b });
  return {
    r: Math.round(255 * linearToSRGBChannel(lin.r)),
    g: Math.round(255 * linearToSRGBChannel(lin.g)),
    b: Math.round(255 * linearToSRGBChannel(lin.b)),
  };
}


// ═══════════════════════════════════════════════════
//  Gamut mapping (reduce chroma until in sRGB)
// ═══════════════════════════════════════════════════

function isInGamut({ r, g, b }) {
  return r >= -0.0001 && r <= 1.0001 && g >= -0.0001 && g <= 1.0001 && b >= -0.0001 && b <= 1.0001;
}

function gamutMapOklch({ L, C, h }) {
  let c = C;
  while (c > 0) {
    const lab = oklchToOklab({ L, C: c, h });
    const lin = oklabToLinearSRGB(lab);
    if (isInGamut(lin)) return { L, C: c, h };
    c = Math.round((c - 0.001) * 1000) / 1000;
  }
  return { L, C: 0, h };
}


// ═══════════════════════════════════════════════════
//  Derived constants — everything flows from OKLCH
// ═══════════════════════════════════════════════════

/** Gamut-safe OKLCH values. */
export const TYPE_OKLCH = Object.fromEntries(
  Object.entries(RAW_OKLCH).map(([k, v]) => [k, gamutMapOklch(v)])
);

/** OKLCH → 0-255 sRGB. */
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
  return `rgb(${r} ${g} ${b})`;
}

function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** { structure: { r, g, b }, ... } */
export const TYPE_RGB = Object.fromEntries(
  Object.entries(TYPE_OKLCH).map(([k, v]) => [k, oklchToRgb(v)])
);

/** { structure: "#xxxxxx", ... } */
export const TYPE_HEX = Object.fromEntries(
  Object.entries(TYPE_RGB).map(([k, v]) => [k, rgbToHex(v)])
);

/** { structure: "rgb(r g b)", ... } */
export const TYPE_SOLID = Object.fromEntries(
  Object.entries(TYPE_RGB).map(([k, v]) => [k, rgbCss(v)])
);

/** OKLab coordinates for each type — used by OKLab-space blending. */
export const TYPE_OKLAB = Object.fromEntries(
  Object.entries(TYPE_OKLCH).map(([k, v]) => [k, oklchToOklab(v)])
);

// ═══════════════════════════════════════════════════
//  Dark-mode category colors (L boosted to 0.72)
// ═══════════════════════════════════════════════════

const RAW_OKLCH_DARK = Object.fromEntries(
  Object.entries(RAW_OKLCH).map(([k, { C, h }]) => [k, { L: DARK_SCHEME_L, C, h }])
);

const TYPE_OKLCH_DARK = Object.fromEntries(
  Object.entries(RAW_OKLCH_DARK).map(([k, v]) => [k, gamutMapOklch(v)])
);

export const TYPE_RGB_DARK = Object.fromEntries(
  Object.entries(TYPE_OKLCH_DARK).map(([k, v]) => [k, oklchToRgb(v)])
);

export const TYPE_HEX_DARK = Object.fromEntries(
  Object.entries(TYPE_RGB_DARK).map(([k, v]) => [k, rgbToHex(v)])
);

export const TYPE_OKLAB_DARK = Object.fromEntries(
  Object.entries(TYPE_OKLCH_DARK).map(([k, v]) => [k, oklchToOklab(v)])
);


// ═══════════════════════════════════════════════════
//  Category metadata — for UI iteration
// ═══════════════════════════════════════════════════

export const CATEGORIES = [
  { key: "structure", label: "Structure" },
  { key: "relevance", label: "Relevance" },
  { key: "evidence",  label: "Evidence"  },
  { key: "framing",   label: "Framing"   },
  { key: "language",  label: "Language"   },
];


// ═══════════════════════════════════════════════════
//  CSS variable injection
// ═══════════════════════════════════════════════════

export function applyThemeVars(root = document.documentElement, theme = 'light') {
  const rgbMap = theme === 'dark' ? TYPE_RGB_DARK : TYPE_RGB;
  const hexMap = theme === 'dark' ? TYPE_HEX_DARK : TYPE_HEX;

  for (const [k, rgb] of Object.entries(rgbMap)) {
    root.style.setProperty(`--type-${k}`, `${rgb.r} ${rgb.g} ${rgb.b}`);
    root.style.setProperty(`--color-${k}`, rgbToHex(rgb));
  }

  const brand = rgbMap.language;
  root.style.setProperty("--brand", `${brand.r} ${brand.g} ${brand.b}`);
}
