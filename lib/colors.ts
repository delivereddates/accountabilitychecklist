/**
 * Map a completion percentage to a color on a red -> yellow -> green ramp:
 *   null        -> gray   (no data / nothing graded)
 *   0%          -> red
 *   50%         -> yellow
 *   100%        -> green
 * Used by the Month calendar and the Year concentric-rings heatmap.
 */
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

function ramp(t: number, stops: [number, [number, number, number]][]): string {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (x >= t0 && x <= t1) {
      const f = (x - t0) / (t1 - t0 || 1);
      return `rgb(${lerp(c0[0], c1[0], f)}, ${lerp(c0[1], c1[1], f)}, ${lerp(
        c0[2],
        c1[2],
        f,
      )})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

// red(#ef4444) -> yellow(#eab308) -> green(#16a34a)
const FILLED: [number, [number, number, number]][] = [
  [0, [0xef, 0x44, 0x44]],
  [0.5, [0xea, 0xb3, 0x08]],
  [1, [0x16, 0xa3, 0x4a]],
];

// light tints: red-100 -> yellow-100 -> green-100
const TINTS: [number, [number, number, number]][] = [
  [0, [0xfe, 0xe2, 0xe2]],
  [0.5, [0xfe, 0xf9, 0xc3]],
  [1, [0xdc, 0xfc, 0xe7]],
];

export function percentColor(pct: number | null): string {
  if (pct == null) return "#e5e7eb"; // gray-200 = no data
  return ramp(pct, FILLED);
}

/** Very light background tint for a cell, by percentage. */
export function percentTint(pct: number | null): string {
  if (pct == null) return "transparent";
  return ramp(pct, TINTS);
}
