import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yenly — JPY & EUR Converter",
    short_name: "Yenly",
    description: "A simple, installable JPY and EUR currency converter.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5ff",
    theme_color: "#f8f5ff",
    icons: [
      {
        src: "/icon1",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
