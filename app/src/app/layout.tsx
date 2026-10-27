import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Young_Serif } from "next/font/google";
import { Providers } from "@/lib/query";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const young = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-young", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Planikah", template: "%s · Planikah" },
  description: "Perencana pernikahan untuk berdua: dana, tugas, vendor, dan tamu di satu tempat.",
  appleWebApp: { capable: true, title: "Planikah", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f2f4f8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} ${young.variable}`}>
      <body className="min-h-dvh"><Providers>{children}</Providers></body>
    </html>
  );
}
