/**
 * Regenerates public/icon-192.png and public/icon-512.png from the same
 * olive-mark geometry the favicon/apple-icon routes use — one source of
 * truth for every icon flavor.
 *
 *   node scripts/generate-icons.mjs
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og.js";
import {
  OLIVE_EYES,
  OLIVE_SMILE,
  OLIVE_STROKES,
} from "../components/olive-mark-data.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** Render one green-square icon PNG at the given size. */
async function renderPng(px) {
  const png = new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          background: "#16a34a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        children: [oliveSvg(Math.round(px * 0.78))],
      },
    },
    { width: px, height: px },
  );
  return Buffer.from(await png.arrayBuffer());
}

/** Wrap PNG buffers into a Vista+ multi-size .ico (PNG-embedded entries). */
function pngsToIco(entries /* [size, Buffer][] */) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dirSize = 16 * entries.length;
  let offset = 6 + dirSize;
  const dirs = [];
  const blobs = [];
  for (const [size, buf] of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0);
    dir.writeUInt8(size >= 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2); // colors
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bpp
    dir.writeUInt32LE(buf.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    blobs.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...dirs, ...blobs]);
}

/** Plain-object SVG (satori-safe, same shape as components/OliveMark.tsx). */
function oliveSvg(height) {
  return {
    type: "svg",
    props: {
      width: height,
      height: height,
      viewBox: "0 0 500 500",
      fill: "none",
      stroke: "white",
      "stroke-width": 22,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      children: [
        ...OLIVE_STROKES.map((s) => ({
          type: "path",
          props: { d: s.d, "stroke-width": s.w },
        })),
        ...OLIVE_EYES.map((e) => ({
          type: "circle",
          props: { cx: e.cx, cy: e.cy, r: e.r, fill: "white", stroke: "none" },
        })),
        { type: "path", props: { d: OLIVE_SMILE.d, "stroke-width": OLIVE_SMILE.w } },
      ],
    },
  };
}

for (const px of [192, 512]) {
  const buf = await renderPng(px);
  await writeFile(join(here, "..", "public", `icon-${px}.png`), buf);
  console.log(`wrote public/icon-${px}.png (${buf.length} bytes)`);
}

// Multi-size favicon.ico (browsers hitting /favicon.ico directly get the
// olive, not a stale default).
{
  const entries = [];
  for (const px of [16, 32, 48]) entries.push([px, await renderPng(px)]);
  const ico = pngsToIco(entries);
  await writeFile(join(here, "..", "app", "favicon.ico"), ico);
  console.log(`wrote app/favicon.ico (${ico.length} bytes)`);
}
