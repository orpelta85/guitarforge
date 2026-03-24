import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guitar Practice",
  description: "Guitar practice management platform for metal/rock guitarists",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Guitar Practice",
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#121214",
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
    <html lang="en" dir="ltr">
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        {children}
        <Script src="/register-sw.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
