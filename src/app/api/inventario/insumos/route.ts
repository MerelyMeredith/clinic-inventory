/**
 * app/api/inventario/insumos/route.ts
 *
 * RF-QA-03: Catálogo de Insumos.
 *
 * GET  /api/inventario/insumos       → Lista todos los insumos del catálogo
 * POST /api/inventario/insumos       → Crea un nuevo insumo en el catálogo
 *
 * Acceso: administrador | almacenista
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora } from "@/lib/bitacora";
import { z } from "zod";

const InsumoInputSchema = z.object({
  nombre: z.string().min(2).max(120),
  unidad_medida: z.string().min(1).max(30),
  stock_minimo: z.number().nonnegative().default(0),
  caduca: z.boolean().default(true),
});

export async function GET() {
  const insumos = await prisma.insumo.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { lotes: true } },
    },
  });

  // RF-QA-05: Calcular existencia total como suma de saldos disponibles por lote
  const insumosConStock = await Promise.all(
    insumos.map(async (insumo) => {
      const lotes = await prisma.lote.findMany({
        where: { id_insumo: insumo.id_insumo, estado: "activo" },
        include: {
          _count: { select: { detalles: true, mermas: true } },
        },
      });

      let stockTotal = 0;
      for (const lote of lotes) {
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
        const saldo =
          Number(lote.cantidad_ingresada) -
          Number(consumos._sum.cantidad ?? 0) -
          Number(mermasResult._sum.cantidad ?? 0);
        stockTotal += Math.max(0, saldo);
      }

      return {
        ...insumo,
        stock_minimo: Number(insumo.stock_minimo),
        stock_total: stockTotal,
        alerta_stock_bajo: stockTotal <= Number(insumo.stock_minimo),
      };
    })
  );

  return NextResponse.json(insumosConStock);
}

export async function POST(request: NextRequest) {
  const userId = Number(request.headers.get("x-user-id"));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = InsumoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", detalles: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const nuevo = await prisma.insumo.create({ data: parsed.data });

  await registrarBitacora({
    id_usuario: userId,
    accion: "CREATE",
    entidad: "Insumos",
    entidad_id: String(nuevo.id_insumo),
    descripcion: `Nuevo insumo creado: ${nuevo.nombre}`,
    ip_address: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json(nuevo, { status: 201 });
}
