/**
 * lib/bitacora.ts
 *
 * Servicio de auditoría centralizado (RF-QA-12).
 * La bitácora es APPEND-ONLY: nunca se actualiza ni elimina un registro.
 * Todos los módulos deben usar esta función para registrar acciones.
 */
import prisma from "./prisma";

export type AccionBitacora =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FALLIDO"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "DESPACHO"
  | "MERMA"
  | "AJUSTE";

interface BitacoraParams {
  id_usuario: number;
  accion: AccionBitacora;
  entidad: string;
  entidad_id?: string;
  descripcion?: string;
  ip_address?: string;
}

/**
 * Registra una entrada inmutable en la bitácora.
 * Esta función nunca lanza excepciones hacia arriba: si falla, solo registra en consola.
 * Esto evita que un error de auditoría bloquee la operación principal.
 */
export async function registrarBitacora(params: BitacoraParams): Promise<void> {
  try {
    await prisma.bitacora.create({
      data: {
        id_usuario: params.id_usuario,
        accion: params.accion,
        entidad: params.entidad,
        entidad_id: params.entidad_id,
        descripcion: params.descripcion,
        ip_address: params.ip_address,
      },
    });
  } catch (error) {
    // NO relanzar: la auditoría no debe bloquear el flujo principal.
    console.error("[BITÁCORA ERROR]", error);
  }
}
