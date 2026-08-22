import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newspaper Composer Prototype",
  description: "Day 1 newspaper article box composition prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
