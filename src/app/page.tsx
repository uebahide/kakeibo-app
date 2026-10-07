import { AppShell } from "@/components/AppShell";
import { KakeiboProvider } from "@/components/KakeiboProvider";

export default function Home() {
  return (
    <KakeiboProvider>
      <AppShell />
    </KakeiboProvider>
  );
}
