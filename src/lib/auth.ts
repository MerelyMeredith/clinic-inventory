/**
 * lib/auth.ts
 *
 * Utilidades de autenticación:
 *  - hashPassword / verifyPassword  (bcrypt)
 *  - createSessionToken / verifySessionToken (JWT via jose - Edge Runtime compatible)
 *  - getSessionFromCookies (extrae sesión del Request)
 *
 * RF-QA-01: Sesiones manejadas exclusivamente con cookies HTTP-only.
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface SessionPayload extends JWTPayload {
  userId: number;       // id_usuario
  empleadoId: number;   // id_empleado
  nombre: string;
  rol: Rol;
}

export type Rol = "administrador" | "docente" | "almacenista" | "estudiante";

// ─── Configuración ──────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "CAMBIAR_EN_PRODUCCION_MIN_32_CHARS!!"
);
const SESSION_DURATION = "8h"; // Duración de sesión de trabajo
export const COOKIE_NAME = "session_token";

// ─── Funciones de contraseña ────────────────────────────────────────────────

/**
 * Genera un hash bcrypt (factor 12) de la contraseña en texto plano.
 * Usar exclusivamente en: registro/cambio de contraseña.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/**
 * Compara una contraseña en texto plano contra un hash bcrypt.
 * Devuelve true si coinciden.
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT ────────────────────────────────────────────────────────────────────

/**
 * Crea un JWT firmado con HS256 y lo retorna como string.
 * Este token se almacenará en una cookie HTTP-only.
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET);
}

/**
 * Verifica y decodifica un JWT.
 * Lanza error si el token es inválido o expiró.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as SessionPayload;
}

// ─── Helpers de cookie ───────────────────────────────────────────────────────

/**
 * Construye los atributos estándar para la cookie de sesión.
 * httpOnly + Secure + SameSite=Lax previenen XSS y CSRF.
 */
export function getSessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
