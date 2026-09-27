import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gobbler Racing — Consumables Tracker",
  description: "Fluid, brake pad, and system usage tracker for the Gobbler Racing CRS car.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
