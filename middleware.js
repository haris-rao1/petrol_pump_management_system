import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";
import { ROLES } from "@/lib/constants";

const AUTH_COOKIE_NAME = "petrol_pump_token";

const protectedPrefixes = ["/dashboard", "/fuel-purchases", "/shift-sales", "/tanks", "/nozzles", "/shifts", "/expenses", "/customers", "/payments", "/employees", "/stock-adjustments", "/reports", "/settings"];

const roleRules = [
  { pattern: /^\/settings/, roles: [ROLES.ADMIN] },
  { pattern: /^\/employees/, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { pattern: /^\/reports/, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { pattern: /^\/users/, roles: [ROLES.ADMIN] },
  { pattern: /^\/api\/users/, roles: [ROLES.ADMIN] },
  { pattern: /^\/api\/employees/, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { pattern: /^\/api\/reports/, roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { pattern: /^\/api\/settings/, roles: [ROLES.ADMIN] },
];

function getRequiredRoles(pathname) {
  const rule = roleRules.find(({ pattern }) => pattern.test(pathname));
  return rule?.roles ?? null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout" || pathname === "/api/auth/me") {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const payload = await verifyAuthToken(token);
    const requiredRoles = getRequiredRoles(pathname);

    if (requiredRoles && !requiredRoles.includes(payload.role)) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = pathname.startsWith("/api")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));

    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/fuel-purchases/:path*", "/shift-sales/:path*", "/tanks/:path*", "/nozzles/:path*", "/shifts/:path*", "/expenses/:path*", "/customers/:path*", "/payments/:path*", "/employees/:path*", "/stock-adjustments/:path*", "/reports/:path*", "/settings/:path*"],
};