import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peptocopeia",
  description: "Source-backed peptide reference with citation review, vendor context, and moderator workflow."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
