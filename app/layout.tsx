import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Third Code Posture — Local posture coaching",
  description: "A privacy-first posture coach that runs in your browser.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
