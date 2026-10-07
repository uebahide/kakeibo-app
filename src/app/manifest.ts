import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "家計簿ノート",
    short_name: "家計簿",
    description: "スマホで素早く記入できる自分専用の家計簿",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f7",
    theme_color: "#2a4e8f",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
