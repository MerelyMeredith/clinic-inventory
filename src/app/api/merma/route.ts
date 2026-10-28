/**
 * app/api/merma/route.ts
 *
 * RF-QA-06 / RF-QA-07: API de Mermas y Ajustes de Inventario.
 *
 * GET  /api/merma → Lista todas las mermas
 * POST /api/merma → Registra una merma o ajuste de inventario
 *
 * REGLAS CRÍTICAS:
 *  - RF-QA-06: Todo registro incluye usuario, fecha/hora y motivo (TC-02).
 *  - RF-QA-07: No se permite que la merma genere stock negativo (TC-01).
 *  - La operación es ATÓMICA: validación + inserción en una transacción.
 *
 * Acceso: administrador | almacenista (controlado por middleware)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora } from "@/lib/bitacora";
import { z } from "zod";

// Tipos de ajuste permitidos
const TIPOS_AJUSTE = [
  "ROTURA",
  "VENCIMIENTO",
  "CONTAMINACION",
  "AJUSTE_INVENTARIO",
  "PERDIDA",
] as const;

// ─── Esquema de validación ────────────────────────────────────────────────────

const MermaInputSchema = z.object({
  id_lote: z.number().int().positive("id_lote debe ser un entero positivo"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero"),
  ajuste: z.enum(TIPOS_AJUSTE, {
    errorMap: () => ({
      message: `El tipo de ajuste debe ser uno de: ${TIPOS_AJUSTE.join(", ")}`,
    }),
  }),
  // RF-QA-06 / TC-02: Motivo/justificación OBLIGATORIO
  motivo: z
    .string()
    .min(10, "El motivo debe tener al menos 10 caracteres.")
    .max(1000),
});

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const loteId = searchParams.get("lote_id");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const mermas = await prisma.merma.findMany({
    where: {
      ...(loteId ? { id_lote: Number(loteId) } : {}),
      ...(desde || hasta
        ? {
            fecha_hora: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(hasta ? { lte: new Date(hasta) } : {}),
            },
          }
        : {}),
    },
    include: {
      lote: {
        include: { insumo: { select: { nombre: true, unidad_medida: true } } },
      },
      empleado: { select: { nombre: true, puesto: true } },
    },
    orderBy: { fecha_hora: "desc" },
  });

  return NextResponse.json(mermas);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // RF-QA-06: Registrar usuario y fecha/hora automáticamente desde la sesión
  const empleadoId = Number(request.headers.get("x-empleado-id"));
  const userId = Number(request.headers.get("x-user-id"));

  if (!empleadoId || !userId) {
    return NextResponse.json({ error: "Sin sesión válida." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // TC-02: Validar que todos los campos obligatorios estén presentes
  const parsed = MermaInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos. Usuario, motivo, tipo de ajuste y cantidad son obligatorios.",
        detalles: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  const { id_lote, cantidad, ajuste, motivo } = parsed.data;

  try {
    const mermaCreada = await prisma.$transaction(async (tx) => {
      // 1. Obtener el lote con bloqueo implícito de la transacción
      const lote = await tx.lote.findUnique({ where: { id_lote } });

      if (!lote) {
        throw new Error(`Lote #${id_lote} no encontrado.`);
      }

      if (lote.estado !== "activo") {
        throw new Error(
          `Lote #${id_lote} no está activo (estado: ${lote.estado}).`
        );
      }

      // 2. Calcular saldo disponible actual
      const [consumos, mermasActuales] = await Promise.all([
        tx.detalleTick.aggregate({
          where: { id_lote },
          _sum: { cantidad: true },
        }),
        tx.merma.aggregate({
          where: { id_lote },
          _sum: { cantidad: true },
        }),
      ]);

      const totalDespachado = Number(consumos._sum.cantidad ?? 0);
      const totalMermado = Number(mermasActuales._sum.cantidad ?? 0);
      const saldoDisponible =
        Number(lote.cantidad_ingresada) - totalDespachado - totalMermado;

      // 3. RF-QA-07: BLOQUEAR si la merma excede el stock disponible
      if (cantidad > saldoDisponible) {
        throw new Error(
          `STOCK INSUFICIENTE: cantidad de merma=${cantidad}, saldo disponible=${saldoDisponible}. ` +
            `Transacción bloqueada para prevenir stock negativo.`
        );
      }

      // 4. Crear el registro de merma (fecha_hora automática via DEFAULT)
      const nuevaMerma = await tx.merma.create({
        data: {
          id_lote,
          id_empleado: empleadoId,
          cantidad,
          ajuste,
          motivo,
          // fecha_hora: automático por default en schema
        },
      });

      // 5. Si el saldo resultante es 0, marcar el lote como agotado
      const nuevoSaldo = saldoDisponible - cantidad;
      if (nuevoSaldo <= 0) {
        await tx.lote.update({
          where: { id_lote },
          data: { estado: "agotado" },
        });
      }

      return nuevaMerma;
    });

    // Registrar en bitácora
    await registrarBitacora({
      id_usuario: userId,
      accion: "MERMA",
      entidad: "Merma",
      entidad_id: String(mermaCreada.id_merma),
      descripcion: `Merma/Ajuste en Lote #${id_lote} | Tipo: ${ajuste} | Cantidad: ${cantidad} | Motivo: ${motivo}`,
      ip_address: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json(mermaCreada, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";
    const isStockError = message.includes("STOCK INSUFICIENTE");
    return NextResponse.json(
      { error: message },
      { status: isStockError ? 409 : 500 }
    );
  }
}
