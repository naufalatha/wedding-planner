import type { Metadata, Viewport } from "next";
import { Providers } from "@/lib/query";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wedding Planner",
  description: "Perencana pernikahan sederhana untuk berdua.",
  appleWebApp: { capable: true, title: "Wedding Planner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="min-h-dvh"><Providers>{children}</Providers></body>
    </html>
  );
}
