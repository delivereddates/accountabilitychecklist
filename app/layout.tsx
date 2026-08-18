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

export const metadata: Metadata = {
  title: "Accountability Checklist",
  description: "Shared daily accountability tracker for the whole team.",
  // apple-icons adds <link rel="apple-touch-icon" sizes="180x180"> (from
  // app/apple-icon.tsx); the web-app metas make it install full-screen when
  // added to the iOS home screen instead of opening in a Safari tab.
  appleWebApp: {
    capable: true,
    title: "Accountability",
    statusBarStyle: "default",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
