import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight edge gate: bounces unauthenticated users away from the app shell
 * and authenticated users away from the auth pages. This is a UX redirect only —
 * every API route and server component still enforces auth/roles independently
 * (the cookie is not verified here, just checked for presence).
 */
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "framelink_session";

const PROTECTED = [/^\/dashboard/, /^\/events/, /^\/account/];
const AUTH_PAGES = [/^\/login$/, /^\/register$/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (PROTECTED.some((re) => re.test(pathname)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.some((re) => re.test(pathname)) && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/events/:path*", "/account/:path*", "/login", "/register"],
};
