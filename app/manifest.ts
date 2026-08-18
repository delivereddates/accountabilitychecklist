import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accountability Checklist",
    short_name: "Accountability",
    description: "Shared daily accountability tracker.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#16a34a",
    icons: [
      // 192 "any" + 512 "maskable" — the pair Android/Chrome require for
      // installability; /apple-icon covers iOS via <link rel="apple-touch-icon">.
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
