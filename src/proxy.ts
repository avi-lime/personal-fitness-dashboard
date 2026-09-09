import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Next.js proxy (formerly `middleware`). Gates every page behind the session cookie. The cookie's signature is verified
 * again on the server for each request that touches data; this check only keeps
 * unauthenticated browsers away from the UI.
 *
 * `/api/mcp` is deliberately excluded: it authenticates with a bearer token.
 */
export default function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target && target !== "/") loginUrl.searchParams.set("next", target);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Everything except: the login page, the MCP endpoint (bearer auth),
     * Next internals and static assets.
     */
    "/((?!login|api/mcp|api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
