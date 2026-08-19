/**
 * Geometry of the smiling-olive brand mark, in the 0 0 500 500 viewBox.
 * Single source of truth for every render of the logo:
 * components/OliveMark.tsx (favicon/apple-icon routes) and
 * scripts/generate-icons.mjs (static manifest/push PNGs).
 *
 * Strokes are ~2× the original 12/10/8 widths so the mark stays legible at
 * favicon sizes; the faint highlight line is dropped (invisible when small).
 */
export const OLIVE_STROKES = [
  // Stem branch
  { d: "M225 100C235 150 230 195 205 225", w: 22 },
  // Left leaf
  { d: "M228 145C150 120 135 180 220 180", w: 22 },
  // Right leaf
  { d: "M233 130C310 95 330 155 238 162", w: 22 },
  // Main olive body
  {
    d: "M250 190C315 190, 345 240, 345 315C345 390, 315 420, 250 420C185 420, 155 390, 155 315C155 240, 185 190, 250 190Z",
    w: 22,
  },
];

export const OLIVE_EYES = [
  { cx: 220, cy: 275, r: 16 },
  { cx: 280, cy: 275, r: 16 },
];

// Curved smile
export const OLIVE_SMILE = { d: "M225 315C235 340, 265 340, 275 315", w: 20 };
