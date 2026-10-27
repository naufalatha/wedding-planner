import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Planikah",
    short_name: "Planikah",
    description: "Perencana pernikahan untuk berdua.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f8",
    theme_color: "#243089",
    lang: "id",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
