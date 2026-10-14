import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { DICTS } from "@/lib/i18n/dict";
import { requestLanguage } from "@/lib/i18n/server";
import { verifyToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "kakeibo", version: "1.0.0" },
});

// Every request needs a valid Supabase access token; without one the answer is 401.
// Point clients at metadata whose resource is this exact URL (RFC 9728 path form).
const authed = withMcpAuth(mcp, verifyToken, { required: true, resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp" });

async function handler(request: Request) {
  // In demo mode the records live in the browser, so there is nothing to serve.
  if (!isSupabaseConfigured) return Response.json({ error: DICTS[requestLanguage(request)].server.supabaseMissing }, { status: 503 });
  return authed(request);
}

export { handler as GET, handler as POST, handler as DELETE };
