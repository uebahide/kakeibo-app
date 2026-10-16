import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthInfo, ServerContext } from "@modelcontextprotocol/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { z } from "zod";

/**
 * A Supabase client that acts as the user the access token belongs to.
 * Row level security applies, so it only ever sees that user's rows.
 */
export function userClient(token: string) {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Checks the bearer token on each MCP request. Returning undefined makes
 * withMcpAuth answer 401, which tells Claude to sign in first.
 */
export async function verifyToken(_req: Request, token?: string): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const { data, error } = await userClient(token).auth.getClaims(token);
  if (error || !data?.claims) return undefined;
  return {
    token,
    clientId: String(data.claims.client_id ?? ""),
    scopes: [],
    expiresAt: data.claims.exp,
    extra: { userId: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : "" },
  };
}

/** The signed-in user's Supabase client, from the token withMcpAuth checked. */
export function supabaseFor(ctx: ServerContext) {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("ログインしていません / Not signed in");
  return userClient(token);
}

/** Where claude.ai's connectors are managed, to reconnect Kakeibo with another account. */
export const CONNECTORS_URL = "https://claude.ai/settings/connectors";

/** Every tool takes the app's account, which the request filled in by the app names, and checks it with accountMismatch. */
export const accountInput = z
  .string()
  .optional()
  .describe(
    "依頼文にアプリでログイン中のアカウント（メールアドレス）があれば、そのまま渡す。違うアカウントにつながっているとエラーを返すので、その文面をそのまま伝えて作業はしない。" +
      " The account (email) the app is signed in to, if the request names one. If a different account is connected, the tool returns an error: pass it on and stop.",
  );

/**
 * When the app named the account it is signed in to (in the request it filled into claude.ai) and the
 * connector is signed in to another one, a message telling the user to reconnect; otherwise null.
 * The token only ever reads its own account, so this keeps work from quietly using the wrong one.
 */
export function accountMismatch(ctx: ServerContext, account: string | undefined): string | null {
  const connected = String(ctx.http?.authInfo?.extra?.email ?? "");
  if (!account || !connected || account.trim().toLowerCase() === connected.toLowerCase()) return null;
  return (
    `家計簿コネクタは ${connected} でつながっていますが、アプリは ${account} でログインしています。何も読み書きしていません。` +
    `${CONNECTORS_URL} を開き、家計簿の接続を外してつなぎ直して、${account} でログインしてから、もう一度頼んでください。` +
    `ユーザーにはこのリンクを見せてください。` +
    ` / The Kakeibo connector is signed in as ${connected}, but the app is signed in as ${account}. Nothing was read or changed. ` +
    `Open ${CONNECTORS_URL}, disconnect Kakeibo, connect again and sign in as ${account}, then ask again. Show the user this link.`
  );
}
