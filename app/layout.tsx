import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CursorDocsGemini",
  description: "AI-assisted document editing in your browser.",
  openGraph: { title: "CursorDocsGemini", siteName: "CursorDocsGemini", description: "AI-assisted document editing in your browser." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><meta name="color-scheme" content="light dark" /></head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Script src="https://worldissuetracker.com/widget/wit-feedback.js" strategy="afterInteractive" data-tracker-slug="cursordocsgemini-feedback" data-app="CursorDocsGemini" data-mode="feedback" data-trigger="none" data-label="Send feedback" />
      </body>
    </html>
  );
}
