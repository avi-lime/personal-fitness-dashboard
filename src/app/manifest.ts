import type { MetadataRoute } from "next";

/** Installable on a phone: "Add to Home Screen" gives a standalone window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Dashboard",
    short_name: "Life",
    description: "Goals, food, training, time, plans and money — in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#141210",
    theme_color: "#141210",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
