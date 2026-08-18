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
      // Static PNGs in public/ (the dashed icon-*.tsx route filenames were
      // never registered as routes by this Next version). 192 "any" + 512
      // "maskable" is the pair Android/Chrome require for installability;
      // /apple-icon covers iOS via <link rel="apple-touch-icon">.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
