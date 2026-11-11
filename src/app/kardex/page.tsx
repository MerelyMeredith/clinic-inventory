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
    <main className="page-shell wide">
      <a href="/dashboard" className="link-back">← Volver al panel</a>
      <header className="page-header">
        <div>
          <span className="eyebrow">Trazabilidad</span>
          <h1>Monitor Kardex</h1>
          <p className="subtitle">Historial cronológico de movimientos de inventario. Vista de solo lectura (RF-QA-08).</p>
        </div>
      </header>

      {(alertasStock.length > 0 || alertasCaducidad.length > 0) && (
        <section className="card">
          <div className="card-header">
            <h2>Alertas de inventario</h2>
            <p>Indicadores automáticos de disponibilidad y vigencia de lotes.</p>
          </div>
          {alertasStock.length > 0 && (
            <div className="alert warning" aria-label="Alertas de stock bajo" style={{ marginBottom: "0.75rem" }}>
              <strong>⚠️ Stock bajo (RF-QA-09)</strong>
              <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>
                {alertasStock.map((l) => (
                  <li key={l.id_lote}>
                    <strong>Lote #{l.id_lote}</strong> — {l.insumo}: disponible <strong>{l.saldoDisponible}</strong> {l.unidad} (mínimo: {l.stockMinimo})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {alertasCaducidad.length > 0 && (
            <div className="alert info" aria-label="Alertas de caducidad próxima">
              <strong>📅 Caducidad próxima (RF-QA-10)</strong>
              <ul style={{ margin: "0.4rem 0 0 1.1rem" }}>
                {alertasCaducidad.map((l) => (
                  <li key={l.id_lote}>
                    <strong>Lote #{l.id_lote}</strong> — {l.insumo}: vence en <strong>{l.diasParaCaducidad}</strong> días ({l.fecha_caducidad ? new Date(l.fecha_caducidad).toLocaleDateString("es-MX") : "—"})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="card soft">
        <form method="get" id="form-filtros-kardex" className="btn-row" style={{ marginTop: 0 }}>
          <label htmlFor="solo_activos" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
            <input
              id="solo_activos"
              name="solo_activos"
              type="checkbox"
              value="true"
              defaultChecked={soloActivos}
            />
            Mostrar solo lotes activos
          </label>
          <button type="submit" className="btn-secondary">Aplicar filtro</button>
        </form>
      </section>

      {kardex.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>No se encontraron lotes con los filtros seleccionados.</p>
        </section>
      ) : (
        <div className="section-stack">
          {kardex.map((lote) => (
            <section key={lote.id_lote} aria-label={`Lote ${lote.id_lote}`} className="card">
              <div className="card-header" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 0.75rem", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ marginBottom: "0.2rem" }}>Lote #{lote.id_lote} — {lote.insumo}</h2>
                  <p>Proveedor: {lote.proveedor} · Registrado por: {lote.empleadoRegistro}</p>
                </div>
                <div className="btn-row" style={{ marginTop: 0 }}>
                  {lote.alertaStockBajo && <span className="badge danger">⚠️ Stock bajo</span>}
                  {lote.alertaCaducidadProxima && <span className="badge warning">📅 Vence pronto</span>}
                  <span className={`badge ${lote.estado === "activo" ? "success" : ""}`}>{lote.estado.toUpperCase()}</span>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <caption>Resumen del lote</caption>
                  <tbody>
                    <tr>
                      <th>Fecha ingreso</th>
                      <td>{new Date(lote.fecha_ingreso).toLocaleString("es-MX")}</td>
                      <th>Fecha caducidad</th>
                      <td>
                        {lote.fecha_caducidad ? new Date(lote.fecha_caducidad).toLocaleDateString("es-MX") : "N/A"}
                        {lote.diasParaCaducidad !== null && ` (${lote.diasParaCaducidad} días)`}
                      </td>
                    </tr>
                    <tr>
                      <th>Unidad</th>
                      <td>{lote.unidad}</td>
                      <th>Stock mínimo</th>
                      <td>{lote.stockMinimo}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="table-wrap">
                <table>
                  <caption>Balance del lote (RF-QA-05)</caption>
                  <thead>
                    <tr>
                      <th>Cantidad ingresada</th>
                      <th>Total despachado</th>
                      <th>Total mermado</th>
                      <th>Saldo disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{lote.cantidadIngresada}</td>
                      <td>{lote.totalDespachado}</td>
                      <td>{lote.totalMermado}</td>
                      <td>
                        <strong>{lote.saldoDisponible}</strong>
                        {lote.alertaStockBajo && <span className="badge danger" style={{ marginLeft: "0.4rem" }}>Bajo</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {lote.movimientos.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <caption>Historial cronológico de movimientos</caption>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tipo</th>
                        <th>Fecha / hora</th>
                        <th>Cantidad</th>
                        <th>Saldo acumulado</th>
                        <th>Referencia</th>
                        <th>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lote.movimientos.map((m, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td><span className={`badge ${m.tipo === "MERMA" ? "warning" : ""}`}>{m.tipo}</span></td>
                          <td>{new Date(m.fecha).toLocaleString("es-MX")}</td>
                          <td style={{ color: m.cantidad < 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                            {m.cantidad > 0 ? "+" : ""}{m.cantidad}
                          </td>
                          <td><strong>{m.saldo}</strong></td>
                          <td><small>{m.ref}</small></td>
                          <td>{m.usuario}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted"><em>Sin movimientos registrados en este lote.</em></p>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
