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
      suppressHydrationWarning
    >
      {/* Apply saved theme before first paint to avoid flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{var t=localStorage.getItem('junto_theme')||
          (window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
          document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
        `}} />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-sans">
        <NativeInit />
        {children}
      </body>
    </html>
  );
}
