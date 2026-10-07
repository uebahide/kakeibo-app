import type { Metadata, Viewport } from "next";
import { Barlow, Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";

const body = Zen_Kaku_Gothic_New({
  variable: "--font-body",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const mincho = Zen_Old_Mincho({
  variable: "--font-mincho",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "家計簿ノート",
  description: "スマホで素早く記入でき、予算・貯金目標・グラフ・AI分析までそろった自分専用の家計簿",
  appleWebApp: { capable: true, title: "家計簿ノート", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e131d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${body.variable} ${mincho.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
