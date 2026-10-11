import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wedding Planner",
    short_name: "Wedding",
    description: "Perencana pernikahan sederhana untuk berdua.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f6f1",
    theme_color: "#f8f6f1",
    lang: "id",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
