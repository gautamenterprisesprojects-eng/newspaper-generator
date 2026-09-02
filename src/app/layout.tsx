import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newspaper Composer Prototype",
  description: "Day 1 newspaper article box composition prototype",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PageMint" },
};

// The portal opens this editor inside the same WebView shell, so it needs the
// same rules: paint under the notch (viewportFit) and no pinch zoom. The
// canvas does its own zooming -- see the pinch handler in EditorCanvas -- and
// browser zoom on top of that fights the user for control of the page.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#047857",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-shell">{children}</body>
    </html>
  );
}
