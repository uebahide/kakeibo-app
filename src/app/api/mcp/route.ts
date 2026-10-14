import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyToken } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: "kakeibo", version: "1.0.0" },
});

// Every request needs a valid Supabase access token; without one the answer is 401.
const authed = withMcpAuth(mcp, verifyToken, { required: true });

async function handler(request: Request) {
  // In demo mode the records live in the browser, so there is nothing to serve.
  if (!isSupabaseConfigured) return Response.json({ error: "Supabase が設定されていません" }, { status: 503 });
  return authed(request);
}

export { handler as GET, handler as POST, handler as DELETE };
