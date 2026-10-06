import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SOCRATIVA — Ruang untuk berpikir",
  description:
    "Temukan pemahaman yang lebih dalam melalui dialog, alasan, dan refleksi.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
