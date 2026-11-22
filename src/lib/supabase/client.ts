import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

// Supabase connection for code that runs in the phone's browser.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
