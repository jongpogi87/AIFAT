import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIFAT Registration | The Signal School",
  description: "Official registration portal for The Signal School's Artificial Intelligence Fundamentals and Applications In-House Training.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
