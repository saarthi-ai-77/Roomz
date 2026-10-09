import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client singleton factory.
 * Uses public anon key and URL from environment variables.
 */
export function getSupabaseBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.');
    }
  }

  return createBrowserClient(
    supabaseUrl ?? '',
    supabaseAnonKey ?? ''
  );
}

export const supabase = getSupabaseBrowser();
