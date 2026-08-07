import type { Metadata, Viewport } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Third Code Posture — Local posture coaching",
  description: "A privacy-first posture coach that runs in your browser.",
  applicationName: "Third Code Posture",
  referrer: "no-referrer",
  appleWebApp: {
    capable: true,
    title: "Third Code Posture",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#7052d9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
