import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import NativeInit from "@/components/NativeInit";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Junto — The Living Trip Plan",
  description: "Turn your messy group travel chats into one always-current shared plan.",
  other: {
    // viewport-fit=cover lets the app draw under the notch/home indicator
    // so safe-area-inset-* env vars are available in CSS
    viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  },
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hankenGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-sans">
        <NativeInit />
        {children}
      </body>
    </html>
  );
}
