import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Tells MCP clients (claude.ai) that /api/mcp is signed in through Supabase Auth's OAuth server.
 * Served at the root and at /.well-known/oauth-protected-resource/api/mcp, the two places clients look.
 */
const handler = protectedResourceHandler({ authServerUrls: [`${supabaseUrl}/auth/v1`] });

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
