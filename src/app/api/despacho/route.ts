/**
 * app/api/despacho/route.ts
 *
 * RF-QA-06 / RF-QA-07: API de Despacho (Salidas de inventario por ticket).
 *
 * POST /api/despacho → Crea un Ticket con sus detalles de lotes despachados.
 *
 * REGLA CRÍTICA (RF-QA-07 / TC-01):
 *   La operación es ATÓMICA mediante una transacción Prisma.
 *   Si algún lote tiene saldo insuficiente, TODO el despacho se revierte.
 *   No se permite stock negativo bajo ninguna circunstancia.
 *
 * Acceso: administrador | almacenista | docente (controlado por middleware)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora } from "@/lib/bitacora";
import { z } from "zod";

// ─── Esquemas de validación ───────────────────────────────────────────────────

const DetalleDespachoSchema = z.object({
  id_lote: z.number().int().positive(),
  cantidad: z.number().positive("La cantidad despachada debe ser mayor a cero"),
});

const ProcedimientoTicketSchema = z.object({
  id_procedimiento: z.number().int().positive(),
  cantidad: z.number().int().positive().default(1),
  precio_unitario: z.number().nonnegative(),
});

const DespachoInputSchema = z.object({
  no_control: z.string().min(1, "El número de control del estudiante es obligatorio"),
  nombre_paciente: z.string().min(2, "El nombre del paciente es obligatorio").max(120),
  // RF-QA-06: Motivo obligatorio (aunque en despacho el motivo es el procedimiento)
  motivo: z.string().min(5, "El motivo/justificación del despacho es obligatorio"),
  procedimientos: z
    .array(ProcedimientoTicketSchema)
    .min(1, "Debe incluir al menos un procedimiento"),
  detalles: z
    .array(DetalleDespachoSchema)
    .min(1, "Debe incluir al menos un insumo despachado"),
});

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // RF-QA-06: usuario y fecha/hora registrados automáticamente
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

  const parsed = DespachoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalles: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { no_control, nombre_paciente, motivo, procedimientos, detalles } = parsed.data;

  // ─── TRANSACCIÓN ATÓMICA ──────────────────────────────────────────────────
  // RF-QA-07: Validación de stock y despacho en una sola transacción.
  // Si alguna validación falla, NADA se persiste.

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Verificar que el estudiante exista
      const estudiante = await tx.estudiante.findUnique({
        where: { no_control },
      });
      if (!estudiante) {
        throw new Error(`Estudiante con no. control ${no_control} no encontrado.`);
      }

      // 2. Verificar stock ANTES de cualquier escritura (RF-QA-07 / TC-01)
      for (const detalle of detalles) {
        const lote = await tx.lote.findUnique({
          where: { id_lote: detalle.id_lote },
        });

        if (!lote) {
          throw new Error(`Lote #${detalle.id_lote} no encontrado.`);
        }

        if (lote.estado !== "activo") {
          throw new Error(
            `Lote #${detalle.id_lote} no está disponible (estado: ${lote.estado}).`
          );
        }

        // Calcular saldo disponible actual
        const [consumos, mermasResult] = await Promise.all([
          tx.detalleTick.aggregate({
            where: { id_lote: detalle.id_lote },
            _sum: { cantidad: true },
          }),
          tx.merma.aggregate({
            where: { id_lote: detalle.id_lote },
            _sum: { cantidad: true },
          }),
        ]);

        const totalDespachado = Number(consumos._sum.cantidad ?? 0);
        const totalMermado = Number(mermasResult._sum.cantidad ?? 0);
        const saldoDisponible =
          Number(lote.cantidad_ingresada) - totalDespachado - totalMermado;

        // RF-QA-07: BLOQUEAR si la salida excede el stock disponible
        if (detalle.cantidad > saldoDisponible) {
          throw new Error(
            `STOCK INSUFICIENTE en Lote #${detalle.id_lote}: ` +
              `solicitado=${detalle.cantidad}, disponible=${saldoDisponible}. ` +
              `Transacción bloqueada.`
          );
        }
      }

      // 3. Crear el Ticket (cabecera)
      const ticket = await tx.ticket.create({
        data: {
          no_control,
          id_empleado: empleadoId,
          nombre_paciente,
          // fecha_hora: automático via DEFAULT en schema
        },
      });

      // 4. Crear los procedimientos del ticket
      await tx.ticketProcedimiento.createMany({
        data: procedimientos.map((p) => ({
          id_ticket: ticket.id_ticket,
          id_procedimiento: p.id_procedimiento,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
        })),
      });

      // 5. Crear los detalles de despacho de insumos
      await tx.detalleTick.createMany({
        data: detalles.map((d) => ({
          id_ticket: ticket.id_ticket,
          id_lote: d.id_lote,
          cantidad: d.cantidad,
        })),
      });

      return ticket;
    });

    // Registrar en bitácora fuera de la transacción
    await registrarBitacora({
      id_usuario: userId,
      accion: "DESPACHO",
      entidad: "Ticket",
      entidad_id: String(resultado.id_ticket),
      descripcion: `Despacho Ticket #${resultado.id_ticket} | Estudiante: ${no_control} | Motivo: ${motivo}`,
      ip_address: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json(
      { ok: true, ticket_id: resultado.id_ticket },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno del servidor.";

    // Si es error de stock, devolver 409 Conflict con mensaje claro
    const isStockError = message.includes("STOCK INSUFICIENTE");
    return NextResponse.json(
      { error: message },
      { status: isStockError ? 409 : 500 }
    );
  }
}
