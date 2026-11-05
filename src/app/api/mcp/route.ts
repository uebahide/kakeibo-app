import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { DICTS } from "@/lib/i18n/dict";
import { requestLanguage } from "@/lib/i18n/server";
import { verifyToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Every tool answers in a few seconds, so a minute is plenty. Without this the
// platform default (300s) applies, and any connection left open is billed for
// the whole five minutes.
export const maxDuration = 60;

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "kakeibo", version: "1.0.0" },
  // The server is stateless and never pushes notifications, so refuse
  // `subscriptions/listen` instead of holding an SSE stream open until timeout.
  maxSubscriptions: 0,
});

// Every request needs a valid Supabase access token; without one the answer is 401.
// Point clients at metadata whose resource is this exact URL (RFC 9728 path form).
const authed = withMcpAuth(mcp, verifyToken, { required: true, resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp" });

async function handler(request: Request) {
  // In demo mode the records live in the browser, so there is nothing to serve.
  if (!isSupabaseConfigured) return Response.json({ error: DICTS[requestLanguage(request)].server.supabaseMissing }, { status: 503 });
  return authed(request);
}

// Only POST is served. GET (a standing SSE stream) and DELETE (ending a session)
// belong to stateful servers; answer them at once, before any auth or setup work.
function methodNotAllowed() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export { handler as POST, methodNotAllowed as GET, methodNotAllowed as DELETE };
