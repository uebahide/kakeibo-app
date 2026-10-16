import { AppShell } from "@/components/AppShell";
import { KakeiboProvider } from "@/components/KakeiboProvider";

export default function Home() {
  return (
    // Read when the page is built; the in-app receipt reading needs the same key as the AI analysis.
    <KakeiboProvider canReadReceipts={Boolean(process.env.ANTHROPIC_API_KEY)}>
      <AppShell />
    </KakeiboProvider>
  );
}
