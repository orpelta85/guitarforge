import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuitarForge",
  description: "Guitar practice management platform for metal/rock guitarists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
