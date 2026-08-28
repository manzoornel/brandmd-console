import { NextResponse } from "next/server";

// Authentication is enforced by the protected app layout. Keep routing middleware
// network-free so a slow auth provider can never block every request at the edge.
export function middleware(request) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
