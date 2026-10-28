/**
 * middleware.ts  (raíz del proyecto Next.js)
 *
 * RF-QA-02: Middleware de Autorización por Roles.
 *
 * Protege rutas según la matriz de permisos:
 *   /dashboard/*      → Todos los roles autenticados
 *   /inventario/*     → administrador | almacenista
 *   /despacho/*       → administrador | almacenista | docente
 *   /kardex/*         → administrador | almacenista | docente
 *   /admin/*          → administrador únicamente
 *   /api/inventario/* → administrador | almacenista
 *   /api/despacho/*   → administrador | almacenista | docente
 *   /api/merma/*      → administrador | almacenista
 *   /api/kardex/*     → administrador | almacenista | docente
 *   /api/admin/*      → administrador
 *
 * Ejecuta en el Edge Runtime (no usa Node.js APIs).
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/auth";
import { COOKIE_NAME } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "CAMBIAR_EN_PRODUCCION_MIN_32_CHARS!!"
);

// ─── Matriz de permisos ───────────────────────────────────────────────────────
type Rol = SessionPayload["rol"];

const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; roles: Rol[] }> = [
  {
    pattern: /^\/(api\/)?admin/,
    roles: ["administrador"],
  },
  {
    pattern: /^\/(api\/)?inventario/,
    roles: ["administrador", "almacenista"],
  },
  {
    pattern: /^\/(api\/)?merma/,
    roles: ["administrador", "almacenista"],
  },
  {
    pattern: /^\/(api\/)?despacho/,
    roles: ["administrador", "almacenista", "docente"],
  },
  {
    pattern: /^\/(api\/)?kardex/,
    roles: ["administrador", "almacenista", "docente"],
  },
  {
    pattern: /^\/(api\/)?reportes/,
    roles: ["administrador", "almacenista", "docente"],
  },
  {
    pattern: /^\/dashboard/,
    roles: ["administrador", "almacenista", "docente", "estudiante"],
  },
];

// Rutas públicas que no requieren autenticación
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Omitir archivos estáticos y rutas internas de Next.js
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ─── Verificar sesión ────────────────────────────────────────────────────
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  let session: SessionPayload;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    session = payload as SessionPayload;
  } catch {
    // Token inválido o expirado
    const response = redirectToLogin(request);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // ─── Verificar permisos de rol ───────────────────────────────────────────
  const matchedRoute = ROUTE_PERMISSIONS.find(({ pattern }) =>
    pattern.test(pathname)
  );

  if (matchedRoute) {
    const hasPermission = matchedRoute.roles.includes(session.rol);
    if (!hasPermission) {
      // Acceso denegado: redirigir a página de error o dashboard
      const forbidden = request.nextUrl.clone();
      forbidden.pathname = "/forbidden";
      return NextResponse.redirect(forbidden);
    }
  }

  // Inyectar datos de sesión en headers para Server Components
  const response = NextResponse.next();
  response.headers.set("x-user-id", String(session.userId));
  response.headers.set("x-user-rol", session.rol);
  response.headers.set("x-empleado-id", String(session.empleadoId));

  return response;
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Aplica el middleware a todas las rutas excepto las de Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
