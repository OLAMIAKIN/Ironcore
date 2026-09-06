import type { Metadata, Viewport } from "next";
import { Bebas_Neue, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "IronCore Gym",
  description: "Memberships, day passes and door access for your gym.",
};

export const viewport: Viewport = {
  themeColor: "#0F1112",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-chalk font-body text-ink">{children}</body>
    </html>
  );
}
