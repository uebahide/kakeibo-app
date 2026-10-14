import type { Metadata, Viewport } from "next";
import { Barlow, Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import { LANGUAGE_SCRIPT } from "@/lib/i18n/script";
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

// The page title follows the display language; LanguageProvider renders it.
export const metadata: Metadata = {
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
    // The inline script sets lang (and may hide the page) before React hydrates, hence suppressHydrationWarning.
    <html lang="ja" suppressHydrationWarning className={`${body.variable} ${mincho.variable} ${barlow.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans text-[15px] leading-relaxed">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
