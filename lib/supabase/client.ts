import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client. The anon key is safe to expose here —
 * Row Level Security, not key secrecy, is what protects user data. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
