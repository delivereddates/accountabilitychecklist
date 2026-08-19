import {
  OLIVE_EYES,
  OLIVE_SMILE,
  OLIVE_STROKES,
} from "./olive-mark-data.mjs";

/**
 * The smiling-olive brand mark (white stroke) shared by the icon routes
 * (favicon + apple-icon) and scripts/generate-icons.mjs. Kept in a plain
 * component file because metadata routes only permit specific named exports.
 *
 * Flattened (no <g>, attributes on every element) and with thickened strokes
 * so the mark stays legible at favicon sizes — satori supports only a subset
 * of SVG and this is the shape it's known to render correctly.
 */
export function OliveMark({ height = 26 }: { height?: number }) {
  return (
    <svg
      width={height}
      height={height}
      viewBox="0 0 500 500"
      fill="none"
      stroke="white"
      strokeWidth={22}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {OLIVE_STROKES.map((s) => (
        <path key={s.d} d={s.d} strokeWidth={s.w} />
      ))}
      {OLIVE_EYES.map((e) => (
        <circle
          key={`${e.cx},${e.cy}`}
          cx={e.cx}
          cy={e.cy}
          r={e.r}
          fill="white"
          stroke="none"
        />
      ))}
      <path d={OLIVE_SMILE.d} strokeWidth={OLIVE_SMILE.w} />
    </svg>
  );
}
