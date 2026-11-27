import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

// Runs before every page: keeps the login fresh and sends signed-out people to /login.
export async function proxy(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next();
  // The calendar link and the nightly reminder timer have their own keys and no login.
  if (request.nextUrl.pathname.startsWith("/api/cal/") || request.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();
  // A customer's quote link: no login, the long code in the link is the key.
  if (request.nextUrl.pathname.startsWith("/q/") || request.nextUrl.pathname.startsWith("/i/")) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path.startsWith("/login");
  const isAuthLink = path.startsWith("/auth/");
  if (!user && !isLoginPage && !isAuthLink) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
