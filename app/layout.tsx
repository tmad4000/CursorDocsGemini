import type { Metadata } from "next";
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

const basePath =
  process.env.STATIC_EXPORT === "true" ? "/CursorDocsGemini" : "";

export const metadata: Metadata = {
  title: "AI Docs Studio",
  description:
    "Cursor-style AI document editor with track changes and review mode.",
  icons: {
    icon: [
      {
        url: `${basePath}/icon.svg`,
        type: "image/svg+xml",
      },
    ],
    shortcut: `${basePath}/favicon.ico`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
