/**
 * app/api/inventario/procedimientos/route.ts
 *
 * API de Procedimientos/Tratamientos (solo lectura para formularios).
 * GET /api/inventario/procedimientos → Lista procedimientos con su categoría.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const procedimientos = await prisma.procedimiento.findMany({
    include: {
      categoria: { select: { nombre_categoria: true } },
    },
    orderBy: [{ id_categoria: "asc" }, { nombre_tratamiento: "asc" }],
  });

  return NextResponse.json(
    procedimientos.map((p) => ({
      id_procedimiento: p.id_procedimiento,
      nombre_tratamiento: p.nombre_tratamiento,
      precio: Number(p.precio),
      categoria: p.categoria.nombre_categoria,
    }))
  );
}
