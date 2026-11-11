"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Lote {
  id_lote: number;
  id_insumo: number;
  cantidad_ingresada: number;
  saldo_disponible?: number;
  total_despachado?: number;
  total_mermado?: number;
  fecha_ingreso?: string;
  fecha_caducidad?: string | null;
  estado: string;
  proveedor: string;
  insumo?: { nombre: string; unidad_medida: string; stock_minimo: number };
  empleado?: { nombre: string };
}

export default function LotesPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch("/api/inventario/lotes", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "No se pudieron cargar los lotes.");
          return;
        }
        setLotes(Array.isArray(data) ? data : []);
      } catch {
        setError("Error de red al cargar los lotes.");
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  return (
    <main className="page-shell wide">
      <a href="/dashboard" className="link-back">← Volver al panel</a>
      <header className="page-header">
        <div>
          <span className="eyebrow">Inventario</span>
          <h1>Consulta de lotes</h1>
          <p className="subtitle">Visualice las entradas registradas, su estado y saldo disponible.</p>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link href="/inventario/lotes/nuevo" className="btn-secondary-link" style={{ padding: "0.7rem 1.2rem", borderRadius: "999px", border: "1px solid #cfe0dc", fontWeight: 600 }}>
            + Registrar lote
          </Link>
        </div>
      </header>

      <section className="card">
        {cargando && <p className="muted">Cargando lotes...</p>}
        {error && <p role="alert" className="alert error">⚠ {error}</p>}
        {!cargando && !error && lotes.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>No hay lotes registrados para mostrar.</p>
        )}
        {!cargando && !error && lotes.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption>Listado de lotes</caption>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Insumo</th>
                  <th>Proveedor</th>
                  <th>Ingreso</th>
                  <th>Caducidad</th>
                  <th>Ingresado</th>
                  <th>Disponible</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id_lote}>
                    <td><strong>#{l.id_lote}</strong></td>
                    <td>{l.insumo?.nombre ?? `Insumo ${l.id_insumo}`}</td>
                    <td>{l.proveedor}</td>
                    <td>{l.fecha_ingreso ? new Date(l.fecha_ingreso).toLocaleString("es-MX") : "—"}</td>
                    <td>{l.fecha_caducidad ? new Date(l.fecha_caducidad).toLocaleDateString("es-MX") : "N/A"}</td>
                    <td>{l.cantidad_ingresada} {l.insumo?.unidad_medida ?? ""}</td>
                    <td>
                      <strong>{l.saldo_disponible ?? "—"}</strong>{" "}
                      {l.insumo?.unidad_medida ?? ""}
                    </td>
                    <td>
                      <span className={`badge ${l.estado === "activo" ? "success" : l.estado === "agotado" ? "warning" : ""}`}>
                        {l.estado?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
