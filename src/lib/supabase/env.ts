export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Without Supabase settings the app runs in demo mode (browser storage, no login). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
