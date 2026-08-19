import { ImageResponse } from "next/og";
import { OliveMark } from "@/components/OliveMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon: 180×180, FULLY OPAQUE green background (transparent
// pixels render as black on iOS). iOS applies its own corner mask.
export default function AppleIcon() {
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
        <OliveMark height={148} />
      </div>
    ),
    { ...size },
  );
}
