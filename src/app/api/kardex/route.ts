/**
 * app/api/kardex/route.ts
 *
 * RF-QA-08: Monitor de Acciones / Kardex de Lotes.
 *
 * GET /api/kardex → Replica la lógica de la vista_kardex_lotes del DDL.
 *   Devuelve el historial cronológico de movimientos por lote con
 *   saldos calculados en tiempo real sin discrepancias aritméticas.
 *
 * Parámetros de consulta opcionales:
 *   - lote_id         : Filtrar por lote específico
 *   - insumo_id       : Filtrar por insumo
 *   - desde / hasta   : Rango de fechas (ISO 8601)
 *   - solo_activos    : "true" | "false" (default: false)
 *
 * Acceso: administrador | almacenista | docente (controlado por middleware)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Tipo de movimiento para el kardex cronológico
type TipoMovimiento = "ENTRADA" | "DESPACHO" | "MERMA";

interface MovimientoKardex {
  id: number;
  tipo: TipoMovimiento;
  fecha_hora: Date;
  cantidad: number;
  saldo_acumulado: number;
  referencia_id: number;   // id_ticket | id_merma
  referencia_tipo: string; // "Ticket" | "Merma"
  descripcion: string;
  usuario: string;
}

interface KardexLote {
  id_lote: number;
  insumo: string;
  unidad_medida: string;
  proveedor: string;
  fecha_ingreso: Date;
  fecha_caducidad: Date | null;
  estado: string;
  stock_minimo: number;
  cantidad_ingresada: number;
  total_despachado: number;
  total_mermado: number;
  saldo_disponible: number;
  alerta_stock_bajo: boolean;    // RF-QA-09
  alerta_caducidad_proxima: boolean; // RF-QA-10
  dias_para_caducidad: number | null;
  movimientos: MovimientoKardex[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const loteId = searchParams.get("lote_id");
  const insumoId = searchParams.get("insumo_id");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const soloActivos = searchParams.get("solo_activos") === "true";

  // ALERTA_CADUCIDAD: umbral configurable (default 30 días)
  const diasAlertaCaducidad = Number(searchParams.get("dias_alerta") ?? "30");

  // ─── Consultar lotes con todas sus relaciones ─────────────────────────────
  const lotes = await prisma.lote.findMany({
    where: {
      ...(loteId ? { id_lote: Number(loteId) } : {}),
      ...(insumoId ? { id_insumo: Number(insumoId) } : {}),
      ...(soloActivos ? { estado: "activo" } : {}),
    },
    include: {
      insumo: {
        select: { nombre: true, unidad_medida: true, stock_minimo: true },
      },
      empleado: { select: { nombre: true } },
      detalles: {
        include: {
          ticket: {
            include: {
              empleado: { select: { nombre: true } },
              estudiante: { select: { nombre: true } },
            },
          },
        },
        ...(desde || hasta
          ? {
              where: {
                ticket: {
                  fecha_hora: {
                    ...(desde ? { gte: new Date(desde) } : {}),
                    ...(hasta ? { lte: new Date(hasta) } : {}),
                  },
                },
              },
            }
          : {}),
      },
      mermas: {
        include: {
          empleado: { select: { nombre: true } },
        },
        ...(desde || hasta
          ? {
              where: {
                fecha_hora: {
                  ...(desde ? { gte: new Date(desde) } : {}),
                  ...(hasta ? { lte: new Date(hasta) } : {}),
                },
              },
            }
          : {}),
      },
    },
    orderBy: [{ id_insumo: "asc" }, { fecha_ingreso: "asc" }],
  });

  // ─── Construir Kardex con saldos acumulados ───────────────────────────────
  const kardexData: KardexLote[] = lotes.map((lote) => {
    // 1. Construir lista cronológica de movimientos
    const movimientosRaw: MovimientoKardex[] = [];

    // Despachos (salidas)
    for (const detalle of lote.detalles) {
      movimientosRaw.push({
        id: detalle.id_detalle_ticket,
        tipo: "DESPACHO",
        fecha_hora: detalle.ticket.fecha_hora,
        cantidad: -Number(detalle.cantidad), // negativo = salida
        saldo_acumulado: 0, // se calcula abajo
        referencia_id: detalle.id_ticket,
        referencia_tipo: "Ticket",
        descripcion: `Despacho Ticket #${detalle.id_ticket} - ${detalle.ticket.estudiante.nombre}`,
        usuario: detalle.ticket.empleado.nombre,
      });
    }

    // Mermas (ajustes)
    for (const merma of lote.mermas) {
      movimientosRaw.push({
        id: merma.id_merma,
        tipo: "MERMA",
        fecha_hora: merma.fecha_hora,
        cantidad: -Number(merma.cantidad), // negativo = salida
        saldo_acumulado: 0,
        referencia_id: merma.id_merma,
        referencia_tipo: "Merma",
        descripcion: `${merma.ajuste}: ${merma.motivo.substring(0, 80)}`,
        usuario: merma.empleado.nombre,
      });
    }

    // 2. Ordenar cronológicamente (RF-QA-08)
    movimientosRaw.sort(
      (a, b) => a.fecha_hora.getTime() - b.fecha_hora.getTime()
    );

    // 3. Calcular saldos acumulados (saldo running)
    let saldoAcumulado = Number(lote.cantidad_ingresada);
    const movimientos = movimientosRaw.map((m) => {
      saldoAcumulado += m.cantidad; // cantidad es negativa para salidas
      return { ...m, saldo_acumulado: saldoAcumulado };
    });

    // 4. Totales globales
    const totalDespachado = lote.detalles.reduce(
      (sum, d) => sum + Number(d.cantidad),
      0
    );
    const totalMermado = lote.mermas.reduce(
      (sum, m) => sum + Number(m.cantidad),
      0
    );
    const saldoDisponible =
      Number(lote.cantidad_ingresada) - totalDespachado - totalMermado;

    // 5. RF-QA-09: Alerta de stock bajo
    const stockMinimo = Number(lote.insumo.stock_minimo);
    const alertaStockBajo = saldoDisponible <= stockMinimo;

    // 6. RF-QA-10: Alerta de caducidad próxima
    let alertaCaducidadProxima = false;
    let diasParaCaducidad: number | null = null;
    if (lote.fecha_caducidad) {
      const hoy = new Date();
      const diff = lote.fecha_caducidad.getTime() - hoy.getTime();
      diasParaCaducidad = Math.ceil(diff / (1000 * 60 * 60 * 24));
      alertaCaducidadProxima =
        diasParaCaducidad <= diasAlertaCaducidad && diasParaCaducidad >= 0;
    }

    return {
      id_lote: lote.id_lote,
      insumo: lote.insumo.nombre,
      unidad_medida: lote.insumo.unidad_medida,
      proveedor: lote.proveedor,
      fecha_ingreso: lote.fecha_ingreso,
      fecha_caducidad: lote.fecha_caducidad,
      estado: lote.estado,
      stock_minimo: stockMinimo,
      cantidad_ingresada: Number(lote.cantidad_ingresada),
      total_despachado: totalDespachado,
      total_mermado: totalMermado,
      saldo_disponible: saldoDisponible,
      alerta_stock_bajo: alertaStockBajo,
      alerta_caducidad_proxima: alertaCaducidadProxima,
      dias_para_caducidad: diasParaCaducidad,
      movimientos,
    };
  });

  return NextResponse.json(kardexData);
}
