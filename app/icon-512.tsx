import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Maskable icon: Android crops this to a squircle/circle, so the logo is kept
// inside the safe zone — the middle 80% circle (~410px of the 512px canvas) —
// by scaling it to 260px (≈51% of the canvas). Fully opaque background.
export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#16a34a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={260}
          height={260}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 19 12 4 21 19" />
          <path d="M8 14h8" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
