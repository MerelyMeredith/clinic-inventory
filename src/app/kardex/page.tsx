/**
 * app/kardex/page.tsx
 *
 * RF-QA-08: Monitor Kardex — Vista de Solo Lectura.
 *
 * - Muestra el historial cronológico de movimientos por lote.
 * - Calcula saldos acumulados en tiempo real (sin discrepancias).
 * - Muestra alertas de RF-QA-09 (stock bajo) y RF-QA-10 (caducidad próxima).
 * - Implementado como Server Component que llama directamente a Prisma
 *   (sin pasar por la API HTTP, más eficiente en Server).
 */
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import Link from "next/link";

// ─── Lógica de datos (mirrors vista_kardex_lotes) ─────────────────────────────

async function getKardexData(filtros: {
  insumoId?: number;
  soloActivos?: boolean;
  diasAlerta?: number;
}) {
  const { insumoId, soloActivos = false, diasAlerta = 30 } = filtros;

  const lotes = await prisma.lote.findMany({
    where: {
      ...(insumoId ? { id_insumo: insumoId } : {}),
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
        orderBy: { ticket: { fecha_hora: "asc" } },
      },
      mermas: {
        include: { empleado: { select: { nombre: true } } },
        orderBy: { fecha_hora: "asc" },
      },
    },
    orderBy: [{ id_insumo: "asc" }, { fecha_ingreso: "asc" }],
  });

  return lotes.map((lote) => {
    const totalDespachado = lote.detalles.reduce(
      (s, d) => s + Number(d.cantidad),
      0
    );
    const totalMermado = lote.mermas.reduce(
      (s, m) => s + Number(m.cantidad),
      0
    );
    const saldoDisponible =
      Number(lote.cantidad_ingresada) - totalDespachado - totalMermado;
    const stockMinimo = Number(lote.insumo.stock_minimo);

    // RF-QA-09: Alerta stock bajo
    const alertaStockBajo = saldoDisponible <= stockMinimo;

    // RF-QA-10: Alerta caducidad próxima
    let alertaCaducidadProxima = false;
    let diasParaCaducidad: number | null = null;
    if (lote.fecha_caducidad) {
      const diff = lote.fecha_caducidad.getTime() - Date.now();
      diasParaCaducidad = Math.ceil(diff / 86400000);
      alertaCaducidadProxima = diasParaCaducidad <= diasAlerta && diasParaCaducidad >= 0;
    }

    // Movimientos cronológicos con saldo acumulado (RF-QA-08)
    type Mov = {
      tipo: string;
      fecha: Date;
      cantidad: number;
      saldo: number;
      ref: string;
      usuario: string;
    };
    const movimientosBrutos: Mov[] = [
      ...lote.detalles.map((d) => ({
        tipo: "DESPACHO",
        fecha: d.ticket.fecha_hora,
        cantidad: -Number(d.cantidad),
        saldo: 0,
        ref: `Ticket #${d.id_ticket} — ${d.ticket.estudiante.nombre}`,
        usuario: d.ticket.empleado.nombre,
      })),
      ...lote.mermas.map((m) => ({
        tipo: "MERMA",
        fecha: m.fecha_hora,
        cantidad: -Number(m.cantidad),
        saldo: 0,
        ref: `${m.ajuste}: ${m.motivo.substring(0, 60)}`,
        usuario: m.empleado.nombre,
      })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    let saldoAcum = Number(lote.cantidad_ingresada);
    const movimientos = movimientosBrutos.map((m) => {
      saldoAcum += m.cantidad;
      return { ...m, saldo: saldoAcum };
    });

    return {
      id_lote: lote.id_lote,
      insumo: lote.insumo.nombre,
      unidad: lote.insumo.unidad_medida,
      proveedor: lote.proveedor,
      empleadoRegistro: lote.empleado.nombre,
      fecha_ingreso: lote.fecha_ingreso,
      fecha_caducidad: lote.fecha_caducidad,
      estado: lote.estado,
      stockMinimo,
      cantidadIngresada: Number(lote.cantidad_ingresada),
      totalDespachado,
      totalMermado,
      saldoDisponible,
      alertaStockBajo,
      alertaCaducidadProxima,
      diasParaCaducidad,
      movimientos,
    };
  });
}

// ─── Server Component ─────────────────────────────────────────────────────────

export default async function KardexPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const insumoId = params.insumo_id ? Number(params.insumo_id) : undefined;
  const soloActivos = params.solo_activos === "true";

  const kardex = await getKardexData({ insumoId, soloActivos });

  const alertasStock = kardex.filter((l) => l.alertaStockBajo);
  const alertasCaducidad = kardex.filter((l) => l.alertaCaducidadProxima);

  return (
    <main>
      <h1>Monitor Kardex — Historial de Movimientos de Inventario</h1>
      <p>
        <a href="/dashboard">← Volver al Panel</a>
      </p>
      <p>
        <em>Vista de solo lectura. RF-QA-08.</em>
      </p>

      {/* ─── Alertas RF-QA-09 y RF-QA-10 ─────────────────────────────── */}
      {alertasStock.length > 0 && (
        <section aria-label="Alertas de stock bajo">
          <h2>⚠️ Alertas de Stock Bajo (RF-QA-09)</h2>
          <ul>
            {alertasStock.map((l) => (
              <li key={l.id_lote}>
                <strong>Lote #{l.id_lote}</strong> — {l.insumo}: disponible={" "}
                <strong>{l.saldoDisponible}</strong> {l.unidad} (mínimo:{" "}
                {l.stockMinimo})
              </li>
            ))}
          </ul>
        </section>
      )}

      {alertasCaducidad.length > 0 && (
        <section aria-label="Alertas de caducidad próxima">
          <h2>📅 Alertas de Caducidad Próxima (RF-QA-10)</h2>
          <ul>
            {alertasCaducidad.map((l) => (
              <li key={l.id_lote}>
                <strong>Lote #{l.id_lote}</strong> — {l.insumo}: vence en{" "}
                <strong>{l.diasParaCaducidad}</strong> días (
                {l.fecha_caducidad
                  ? new Date(l.fecha_caducidad).toLocaleDateString("es-MX")
                  : "—"}
                )
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Filtros ───────────────────────────────────────────────────── */}
      <form method="get" id="form-filtros-kardex">
        <label htmlFor="solo_activos">
          <input
            id="solo_activos"
            name="solo_activos"
            type="checkbox"
            value="true"
            defaultChecked={soloActivos}
          />{" "}
          Solo lotes activos
        </label>
        <button type="submit">Filtrar</button>
      </form>

      <hr />

      {/* ─── Tabla principal del Kardex ───────────────────────────────── */}
      {kardex.length === 0 ? (
        <p>No se encontraron lotes con los filtros seleccionados.</p>
      ) : (
        kardex.map((lote) => (
          <section key={lote.id_lote} aria-label={`Lote ${lote.id_lote}`}>
            <h2>
              Lote #{lote.id_lote} — {lote.insumo}
              {lote.alertaStockBajo && " ⚠️ STOCK BAJO"}
              {lote.alertaCaducidadProxima && " 📅 VENCE PRONTO"}
            </h2>

            <table border={1} cellPadding={4}>
              <caption>Resumen del Lote</caption>
              <tbody>
                <tr>
                  <th>Proveedor</th>
                  <td>{lote.proveedor}</td>
                  <th>Registrado por</th>
                  <td>{lote.empleadoRegistro}</td>
                </tr>
                <tr>
                  <th>Fecha Ingreso</th>
                  <td>
                    {new Date(lote.fecha_ingreso).toLocaleString("es-MX")}
                  </td>
                  <th>Fecha Caducidad</th>
                  <td>
                    {lote.fecha_caducidad
                      ? new Date(lote.fecha_caducidad).toLocaleDateString("es-MX")
                      : "N/A"}
                    {lote.diasParaCaducidad !== null &&
                      ` (${lote.diasParaCaducidad} días)`}
                  </td>
                </tr>
                <tr>
                  <th>Estado</th>
                  <td>
                    <strong>{lote.estado.toUpperCase()}</strong>
                  </td>
                  <th>Unidad</th>
                  <td>{lote.unidad}</td>
                </tr>
              </tbody>
            </table>

            <table border={1} cellPadding={4}>
              <caption>Balance del Lote (RF-QA-05)</caption>
              <thead>
                <tr>
                  <th>Cantidad Ingresada</th>
                  <th>Total Despachado</th>
                  <th>Total Mermado</th>
                  <th>Saldo Disponible</th>
                  <th>Stock Mínimo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{lote.cantidadIngresada}</td>
                  <td>{lote.totalDespachado}</td>
                  <td>{lote.totalMermado}</td>
                  <td>
                    <strong>
                      {lote.saldoDisponible}
                      {lote.alertaStockBajo && " ⚠️"}
                    </strong>
                  </td>
                  <td>{lote.stockMinimo}</td>
                </tr>
              </tbody>
            </table>

            {/* Historial cronológico de movimientos (RF-QA-08) */}
            {lote.movimientos.length > 0 ? (
              <table border={1} cellPadding={4}>
                <caption>Historial Cronológico de Movimientos</caption>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Fecha / Hora</th>
                    <th>Cantidad</th>
                    <th>Saldo Acumulado</th>
                    <th>Referencia</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.movimientos.map((m, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{m.tipo}</td>
                      <td>{new Date(m.fecha).toLocaleString("es-MX")}</td>
                      <td style={{ color: m.cantidad < 0 ? "red" : "green" }}>
                        {m.cantidad > 0 ? "+" : ""}
                        {m.cantidad}
                      </td>
                      <td>
                        <strong>{m.saldo}</strong>
                      </td>
                      <td>
                        <small>{m.ref}</small>
                      </td>
                      <td>{m.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>
                <em>Sin movimientos registrados en este lote.</em>
              </p>
            )}

            <hr />
          </section>
        ))
      )}
    </main>
  );
}
