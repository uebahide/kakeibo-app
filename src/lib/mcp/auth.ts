import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthInfo, ServerContext } from "@modelcontextprotocol/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

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
    extra: { userId: data.claims.sub },
  };
}

/** The signed-in user's Supabase client, from the token withMcpAuth checked. */
export function supabaseFor(ctx: ServerContext) {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("ログインしていません / Not signed in");
  return userClient(token);
}
