// The two public Supabase settings. They come from Vercel (Settings > Environment Variables)
// or, on a developer's computer, from the .env.local file.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
