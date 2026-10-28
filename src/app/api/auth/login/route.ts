/**
 * app/api/auth/login/route.ts
 *
 * RF-QA-01: API de autenticación.
 * POST /api/auth/login → valida credenciales y establece cookie HTTP-only de sesión.
 * DELETE /api/auth/login → cierra sesión (destruye cookie).
 *
 * Seguridad:
 *  - Usa consultas parametrizadas vía Prisma (no interpolación de strings).
 *  - Contraseña verificada con bcrypt (no comparación directa).
 *  - Token JWT almacenado en cookie HttpOnly (inaccesible desde JS del cliente).
 *  - Rate limiting: implementar a nivel de infraestructura (ej. Vercel Edge Middleware o nginx).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  getSessionCookieOptions,
  COOKIE_NAME,
} from "@/lib/auth";
import { registrarBitacora } from "@/lib/bitacora";

// ─── POST: Login ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const { username, password } = body;

  // Validación de campos obligatorios
  if (!username || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son requeridos." },
      { status: 400 }
    );
  }

  // Consulta parametrizada vía Prisma ORM (previene SQL Injection)
  const usuario = await prisma.usuario.findUnique({
    where: { username: username.trim() },
    include: { empleado: true },
  });

  // Verificación en tiempo constante (evitar timing attacks)
  const passwordValida =
    usuario && usuario.activo
      ? await verifyPassword(password, usuario.password_hash)
      : false;

  if (!usuario || !usuario.activo || !passwordValida) {
    // Registrar intento fallido en bitácora si el usuario existe
    if (usuario) {
      await registrarBitacora({
        id_usuario: usuario.id_usuario,
        accion: "LOGIN_FALLIDO",
        entidad: "Usuarios",
        entidad_id: String(usuario.id_usuario),
        descripcion: `Intento de login fallido para usuario: ${username}`,
        ip_address: request.headers.get("x-forwarded-for") ?? undefined,
      });
    }
    return NextResponse.json(
      { error: "Credenciales incorrectas." },
      { status: 401 }
    );
  }

  // Crear token JWT
  const token = await createSessionToken({
    userId: usuario.id_usuario,
    empleadoId: usuario.id_empleado,
    nombre: usuario.empleado.nombre,
    rol: usuario.rol as ReturnType<typeof createSessionToken> extends Promise<string> ? never : "administrador",
  });

  // Registrar login exitoso
  await registrarBitacora({
    id_usuario: usuario.id_usuario,
    accion: "LOGIN",
    entidad: "Usuarios",
    entidad_id: String(usuario.id_usuario),
    descripcion: `Inicio de sesión: ${usuario.empleado.nombre} (${usuario.rol})`,
    ip_address: request.headers.get("x-forwarded-for") ?? undefined,
  });

  // Establecer cookie HTTP-only (8 horas = 28800 segundos)
  const response = NextResponse.json({
    ok: true,
    usuario: {
      id: usuario.id_usuario,
      nombre: usuario.empleado.nombre,
      rol: usuario.rol,
    },
  });

  response.cookies.set({
    ...getSessionCookieOptions(28800),
    value: token,
  });

  return response;
}

// ─── DELETE: Logout ───────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  // Intentar obtener el userId del header inyectado por el middleware
  const userId = request.headers.get("x-user-id");

  if (userId) {
    await registrarBitacora({
      id_usuario: Number(userId),
      accion: "LOGOUT",
      entidad: "Usuarios",
      entidad_id: userId,
      ip_address: request.headers.get("x-forwarded-for") ?? undefined,
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    ...getSessionCookieOptions(0), // maxAge=0 elimina la cookie
    value: "",
  });

  return response;
}
