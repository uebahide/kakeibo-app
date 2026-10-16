"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * A new claude.ai chat with `prompt` filled in, for work Claude does through the kakeibo connector (MCP).
 * `accountNote` names the account the app is signed in to, so the connector can refuse when it is signed in to another.
 */
export const claudeUrl = (prompt: string, accountNote: string) => "https://claude.ai/new?q=" + encodeURIComponent(prompt + accountNote);

/** Email of the account the app is signed in to (null in demo mode or until it is known). */
export function useAccount(signedIn: boolean): string | null {
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void createClient()
      .auth.getUser()
      .then(({ data }) => live && setAccount(data.user?.email ?? null));
    return () => {
      live = false;
    };
  }, [signedIn]);
  return account;
}
