import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yenly — JPY & EUR converter",
  description:
    "A simple JPY and EUR currency converter with live reference rates and offline support.",
  applicationName: "Yenly",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yenly",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f5ff",
  viewportFit: "cover",
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
