import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client factory for Server Components, Server Actions,
 * and Route Handlers.
 * Awaits `cookies()` from `next/headers` and handles cookie persistence according
 * to `@supabase/ssr` guidelines.
 */
export async function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL: Please define NEXT_PUBLIC_SUPABASE_URL in your environment variables.'
    );
  }
  if (!supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY: Please define NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // If called from a Server Component (where cookie mutation is disallowed),
          // next/headers throws a specific error.
          // In Server Actions or Route Handlers, cookie mutation works.
          // In Server Components, session refresh is handled by proxy.ts/middleware.
          // We gracefully catch only read-only Server Component errors without suppressing other failures.
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isReadOnlyContext =
            errorMessage.includes('Cookies can only be modified in a Server Action or Route Handler') ||
            errorMessage.includes('Cookies cannot be set') ||
            errorMessage.includes('READONLY_COOKIES') ||
            (error as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE';

          if (!isReadOnlyContext && process.env.NODE_ENV !== 'production') {
            console.warn('Supabase SSR cookie set error:', error);
          }
        }
      },
    },
  });
}
