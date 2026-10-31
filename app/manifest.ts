import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Olives",
    short_name: "Olives",
    description: "Your todos, calendar, and notes.",
    start_url: "/calendar",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#16a34a",
    icons: [
      // Static PNGs in public/. 192 "any" + 512 "maskable" is the pair
      // Android/Chrome require for installability; /apple-icon covers iOS
      // via <link rel="apple-touch-icon">.
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
