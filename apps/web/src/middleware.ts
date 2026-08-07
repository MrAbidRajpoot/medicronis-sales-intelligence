import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const auth = request.cookies.get("medicronis-auth");

  if (pathname === "/") {
    return NextResponse.redirect(new URL(auth?.value ? "/dashboard" : "/login", request.url));
  }

  if (!auth?.value && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (auth?.value && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
