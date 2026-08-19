import { ImageResponse } from "next/og";
import { OliveMark } from "@/components/OliveMark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Full-bleed square favicon (browser tab); no transparency.
export default function Icon() {
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
        <OliveMark height={26} />
      </div>
    ),
    { ...size },
  );
}
