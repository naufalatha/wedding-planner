import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon);

let client: SupabaseClient | null = null;
/** Hanya kunci anon publik; tidak ada service-role key di aplikasi. */
export function supabase(): SupabaseClient {
  if (!isConfigured) throw new Error("Supabase belum dikonfigurasi (lihat README).");
  client ??= createBrowserClient(url as string, anon as string);
  return client;
}
