import type { Metadata, Viewport } from "next";
import { Press_Start_2P, DM_Sans } from "next/font/google";

import { PwaBootstrap } from "@/components/PwaBootstrap";
import { SplashScreen } from "@/components/SplashScreen";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quantum Playground",
  description:
    "Learn quantum computing through playable stories, from your first quantum coin to breaking toy RSA.",
  applicationName: "Quantum Playground",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quantum Playground",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1f26",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pressStart.variable} ${dmSans.variable}`} data-boot="1">
      <body suppressHydrationWarning>
        {/*
          Opaque cover in the first HTML paint so the title cannot flash
          before SplashScreen hydrates. Hidden via html[data-boot=done] —
          do not remove this node from the DOM; React owns it.
        */}
        <div
          id="mitm-boot"
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99,
            background: "#0b1f26",
          }}
        />
        <LanguageProvider><PwaBootstrap />
        <SplashScreen />
        {children}</LanguageProvider>
      </body>
    </html>
  );
}
