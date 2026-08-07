import type { Metadata } from "next";
import { Press_Start_2P, DM_Sans } from "next/font/google";
import "./globals.css";

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
  title: "Man in the Middle",
  description:
    "A pixel-art hacking game about breaking Ale and Brayan's messages, from plaintext to Shor's algorithm.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${pressStart.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
