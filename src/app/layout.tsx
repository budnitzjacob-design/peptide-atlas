import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "peptocopeia",
  description: "peptocopeia is a source-backed peptide reference with citation review, vendor context, and moderator workflow.",
  icons: {
    icon: "/favicon.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
