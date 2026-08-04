/**
 * Map a completion percentage to a color.
 *  - null (no data / everything exempt) → neutral gray
 *  - 0%   → neutral gray (nothing checked yet)
 *  - 1–99 → light → medium green ramp
 *  - 100% → dark rich green
 * Used by the Month calendar and the Year concentric-rings heatmap.
 */
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function percentColor(pct: number | null): string {
  if (pct == null || pct <= 0) return "#e5e7eb"; // gray-200
  const t = Math.max(0, Math.min(1, pct));
  // #bbf7d0 (green-200) → #15803d (green-700)
  const r = lerp(0xbb, 0x15, t);
  const g = lerp(0xf7, 0x80, t);
  const b = lerp(0xd0, 0x3d, t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Very light background tint for a cell, by percentage. */
export function percentTint(pct: number | null): string {
  if (pct == null || pct <= 0) return "transparent";
  const t = Math.max(0, Math.min(1, pct));
  // #f0fdf4 (green-50) → #bbf7d0 (green-200)
  const r = lerp(0xf0, 0xbb, t);
  const g = lerp(0xfd, 0xf7, t);
  const b = lerp(0xf4, 0xd0, t);
  return `rgb(${r}, ${g}, ${b})`;
}
