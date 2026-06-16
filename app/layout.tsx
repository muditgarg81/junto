import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import Script from "next/script";
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
        {children}
        <Script id="travelpayouts-drive" strategy="afterInteractive">
          {`
            (function () {
              var script = document.createElement("script");
              script.async = 1;
              script.src = 'https://emrldtp.cc/NTQwMzI5.js?t=540329';
              document.head.appendChild(script);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
