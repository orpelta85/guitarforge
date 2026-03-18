import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuitarForge",
  description: "Guitar practice management platform for metal/rock guitarists",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GuitarForge",
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">
        {children}
        <Script src="/register-sw.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
