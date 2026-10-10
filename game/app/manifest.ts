import type { MetadataRoute } from "next";
import { GAME_NAME, GAME_TITLE } from "@/content/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: GAME_TITLE,
    short_name: GAME_NAME,
    description:
      "Learn quantum computing through playable stories, from a quantum coin to breaking toy RSA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b1f26",
    theme_color: "#0b1f26",
    categories: ["games", "education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
