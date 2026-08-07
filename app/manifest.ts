import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Third Code Posture",
    short_name: "Posture",
    description: "Private, browser-local posture and movement coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaff",
    theme_color: "#7052d9",
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
    ],
  };
}
