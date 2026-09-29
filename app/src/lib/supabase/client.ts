import { createBrowserClient } from '@supabase/ssr';

const LS_PREFIX = 'sb-auth:';

function safeLocal(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${encodeURIComponent(name)}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

function writeCookie(name: string, value: string, options: any) {
  if (typeof document === 'undefined') return;
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  const maxAge = options?.maxAge ?? 60 * 60 * 24 * 400; // 400 days
  parts.push(`Max-Age=${maxAge}`);
  parts.push(`Path=${options?.path ?? '/'}`);
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`SameSite=${options?.sameSite ?? 'Lax'}`);
  if (options?.secure ?? location.protocol === 'https:') parts.push('Secure');
  document.cookie = parts.join('; ');
}

function deleteCookie(name: string, options: any) {
  writeCookie(name, '', { ...options, maxAge: 0 });
}

export function createClient() {
  // Hydrate cookies from localStorage BEFORE the client reads them
  // (iOS PWA can drop cookies between launches; localStorage survives).
  if (typeof window !== 'undefined') {
    const ls = safeLocal();
    if (ls) {
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (!key || !key.startsWith(LS_PREFIX)) continue;
        const cookieName = key.slice(LS_PREFIX.length);
        if (!readCookie(cookieName)) {
          const value = ls.getItem(key);
          if (value) writeCookie(cookieName, value, {});
        }
      }
    }
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [];
          return document.cookie
            .split('; ')
            .filter(Boolean)
            .map((c) => {
              const [name, ...rest] = c.split('=');
              return {
                name: decodeURIComponent(name),
                value: decodeURIComponent(rest.join('=')),
              };
            });
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          const ls = safeLocal();
          for (const { name, value, options } of cookiesToSet) {
            if (value) {
              writeCookie(name, value, options);
              if (ls) {
                try {
                  ls.setItem(LS_PREFIX + name, value);
                } catch {}
              }
            } else {
              deleteCookie(name, options);
              if (ls) {
                try {
                  ls.removeItem(LS_PREFIX + name);
                } catch {}
              }
            }
          }
        },
      },
    }
  );
}
