/**
 * app/api/inventario/lotes/route.ts
 *
 * RF-QA-06 / RF-QA-04: CRUD de Lotes (entradas de inventario).
 *
 * GET  /api/inventario/lotes       → Lista lotes con saldo disponible calculado
 * POST /api/inventario/lotes       → Registra una nueva entrada de lote
 *
 * Acceso: administrador | almacenista  (controlado por middleware)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora } from "@/lib/bitacora";
import { z } from "zod";

// ─── Esquema de validación ────────────────────────────────────────────────────

const LoteInputSchema = z.object({
  id_insumo: z.number().int().positive("id_insumo debe ser un entero positivo"),
  fecha_caducidad: z
    .string()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true; // Permitir null para insumos que no caducan
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Fecha de caducidad inválida"),
  cantidad_ingresada: z
    .number()
    .positive("La cantidad debe ser mayor a cero"),
  proveedor: z.string().min(2, "El proveedor es obligatorio").max(120),
  // id_empleado vendrá del token de sesión, no del body (seguridad)
});

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const insumoId = searchParams.get("insumo_id");
  const soloActivos = searchParams.get("activos") !== "false";

  const lotes = await prisma.lote.findMany({
    where: {
      ...(insumoId ? { id_insumo: Number(insumoId) } : {}),
      ...(soloActivos ? { estado: "activo" } : {}),
    },
    include: {
      insumo: {
        select: { nombre: true, unidad_medida: true, stock_minimo: true },
      },
      empleado: { select: { nombre: true } },
      _count: { select: { detalles: true, mermas: true } },
    },
    orderBy: [{ fecha_ingreso: "desc" }],
  });

  // Calcular saldo disponible en la capa de aplicación
  // (mirrors vista_kardex_lotes del DDL)
  const lotesConSaldo = await Promise.all(
    lotes.map(async (lote) => {
      const [consumos, mermasResult] = await Promise.all([
        prisma.detalleTick.aggregate({
          where: { id_lote: lote.id_lote },
          _sum: { cantidad: true },
        }),
        prisma.merma.aggregate({
          where: { id_lote: lote.id_lote },
          _sum: { cantidad: true },
        }),
      ]);

      const totalDespachado = Number(consumos._sum.cantidad ?? 0);
      const totalMermado = Number(mermasResult._sum.cantidad ?? 0);
      const saldoDisponible =
        Number(lote.cantidad_ingresada) - totalDespachado - totalMermado;

      return {
        ...lote,
        cantidad_ingresada: Number(lote.cantidad_ingresada),
        total_despachado: totalDespachado,
        total_mermado: totalMermado,
        saldo_disponible: saldoDisponible,
      };
    })
  );

  return NextResponse.json(lotesConSaldo);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  const parsed = LoteInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalles: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { id_insumo, fecha_caducidad, cantidad_ingresada, proveedor } = parsed.data;

  // RF-QA-04: Validar que el insumo exista
  const insumo = await prisma.insumo.findUnique({ where: { id_insumo } });
  if (!insumo) {
    return NextResponse.json({ error: "Insumo no encontrado." }, { status: 404 });
  }

  // RF-QA-04: Si el insumo caduca, la fecha es obligatoria y debe ser futura
  if (insumo.caduca) {
    if (!fecha_caducidad) {
      return NextResponse.json(
        { error: "Este insumo requiere fecha de caducidad." },
        { status: 422 }
      );
    }
    const fechaCad = new Date(fecha_caducidad);
    if (fechaCad <= new Date()) {
      return NextResponse.json(
        { error: "La fecha de caducidad debe ser futura. Lote rechazado." },
        { status: 422 }
      );
    }
  }

  // Crear el lote (consulta parametrizada vía Prisma)
  const nuevoLote = await prisma.lote.create({
    data: {
      id_insumo,
      fecha_caducidad: fecha_caducidad ? new Date(fecha_caducidad) : null,
      cantidad_ingresada,
      estado: "activo",
      id_empleado: empleadoId,
      proveedor,
    },
  });

  // Registrar en bitácora
  await registrarBitacora({
    id_usuario: userId,
    accion: "CREATE",
    entidad: "Lotes",
    entidad_id: String(nuevoLote.id_lote),
    descripcion: `Entrada de lote: ${cantidad_ingresada} unidades de insumo #${id_insumo} (${insumo.nombre})`,
    ip_address: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json(nuevoLote, { status: 201 });
}
