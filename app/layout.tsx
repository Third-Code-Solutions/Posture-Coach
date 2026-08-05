import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Form / Local — Privacy-first posture coaching",
  description: "A browser-local posture coach for desk alignment and movement practice.",
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
