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
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
