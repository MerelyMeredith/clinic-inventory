/**
 * app/merma/nuevo/page.tsx
 *
 * RF-QA-06 / RF-QA-07: Formulario de Merma / Ajuste de Inventario.
 *
 * Reglas críticas:
 *  - TC-02: Motivo es OBLIGATORIO (mínimo 10 caracteres).
 *  - TC-01: El backend bloqueará si la cantidad excede el stock disponible.
 *  - RF-QA-06: Usuario, fecha y hora se registran automáticamente.
 */
"use client";

import { useState, useEffect, FormEvent } from "react";

interface LoteKardex {
  id_lote: number;
  insumo: string;
  unidad_medida: string;
  saldo_disponible: number;
  proveedor: string;
  fecha_caducidad: string | null;
  estado: string;
}

const TIPOS_AJUSTE = [
  "ROTURA",
  "VENCIMIENTO",
  "CONTAMINACION",
  "AJUSTE_INVENTARIO",
  "PERDIDA",
] as const;

type TipoAjuste = (typeof TIPOS_AJUSTE)[number];

export default function NuevaMermaPage() {
  const [lotes, setLotes] = useState<LoteKardex[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState<LoteKardex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch("/api/kardex?solo_activos=true")
      .then((r) => r.json())
      .then((data: LoteKardex[]) =>
        setLotes(data.filter((l) => l.saldo_disponible > 0))
      )
      .catch(() => setError("Error al cargar lotes activos."));
  }, []);

  function handleLoteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value);
    const lote = lotes.find((l) => l.id_lote === id) ?? null;
    setLoteSeleccionado(lote);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setCargando(true);

    const form = e.currentTarget;
    const id_lote = Number(
      (form.elements.namedItem("id_lote") as HTMLSelectElement).value
    );
    const cantidad = Number(
      (form.elements.namedItem("cantidad") as HTMLInputElement).value
    );
    const ajuste = (form.elements.namedItem("ajuste") as HTMLSelectElement)
      .value as TipoAjuste;
    // TC-02: Motivo obligatorio
    const motivo = (
      form.elements.namedItem("motivo") as HTMLTextAreaElement
    ).value.trim();

    // Validaciones del cliente
    if (!id_lote || cantidad <= 0) {
      setError("Seleccione un lote y una cantidad válida mayor a cero.");
      setCargando(false);
      return;
    }

    if (!motivo || motivo.length < 10) {
      setError("El motivo es obligatorio y debe tener al menos 10 caracteres (TC-02).");
      setCargando(false);
      return;
    }

    // Validación preventiva en el cliente (el server la repite atómicamente)
    if (loteSeleccionado && cantidad > loteSeleccionado.saldo_disponible) {
      setError(
        `La cantidad (${cantidad}) excede el stock disponible (${loteSeleccionado.saldo_disponible}). ` +
          `Transacción rechazada preventivamente (RF-QA-07).`
      );
      setCargando(false);
      return;
    }

    try {
      const res = await fetch("/api/merma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id_lote, cantidad, ajuste, motivo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al registrar merma.");
        setCargando(false);
        return;
      }

      setExito(`✅ Merma registrada exitosamente (ID: ${data.id_merma}).`);
      form.reset();
      setLoteSeleccionado(null);
      // Recargar lotes disponibles
      const updated = await fetch("/api/kardex?solo_activos=true")
        .then((r) => r.json())
        .then((d: LoteKardex[]) => d.filter((l) => l.saldo_disponible > 0));
      setLotes(updated);
    } catch {
      setError("Error de red. Intente nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main>
      <h1>Registrar Merma / Ajuste de Inventario</h1>
      <p>
        <a href="/dashboard">← Volver al Panel</a>
      </p>

      <form onSubmit={handleSubmit} id="form-merma" noValidate>
        <fieldset>
          <legend>Datos de la Merma</legend>

          <div>
            <label htmlFor="id_lote">* Lote Afectado:</label>
            <select
              id="id_lote"
              name="id_lote"
              required
              onChange={handleLoteChange}
              disabled={cargando}
            >
              <option value={0}>— Seleccionar lote activo —</option>
              {lotes.map((l) => (
                <option key={l.id_lote} value={l.id_lote}>
                  #{l.id_lote} — {l.insumo} | Disponible: {l.saldo_disponible}{" "}
                  {l.unidad_medida}
                  {l.fecha_caducidad
                    ? ` | Cad: ${new Date(l.fecha_caducidad).toLocaleDateString("es-MX")}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {loteSeleccionado && (
            <table border={1} cellPadding={4}>
              <caption>Información del Lote Seleccionado</caption>
              <tbody>
                <tr>
                  <th>Insumo</th>
                  <td>{loteSeleccionado.insumo}</td>
                </tr>
                <tr>
                  <th>Proveedor</th>
                  <td>{loteSeleccionado.proveedor}</td>
                </tr>
                <tr>
                  <th>Stock Disponible</th>
                  <td>
                    <strong>{loteSeleccionado.saldo_disponible}</strong>{" "}
                    {loteSeleccionado.unidad_medida}
                  </td>
                </tr>
                <tr>
                  <th>Fecha Caducidad</th>
                  <td>
                    {loteSeleccionado.fecha_caducidad
                      ? new Date(loteSeleccionado.fecha_caducidad).toLocaleDateString("es-MX")
                      : "Sin caducidad"}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          <div>
            <label htmlFor="ajuste">* Tipo de Ajuste:</label>
            <select id="ajuste" name="ajuste" required disabled={cargando}>
              <option value="">— Seleccionar tipo —</option>
              {TIPOS_AJUSTE.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cantidad">* Cantidad a Ajustar:</label>
            <input
              id="cantidad"
              name="cantidad"
              type="number"
              min={0.01}
              step={0.01}
              max={loteSeleccionado?.saldo_disponible ?? undefined}
              required
              disabled={cargando}
            />
            {loteSeleccionado && (
              <small> {loteSeleccionado.unidad_medida} (máx: {loteSeleccionado.saldo_disponible})</small>
            )}
          </div>

          {/* TC-02: Motivo OBLIGATORIO */}
          <div>
            <label htmlFor="motivo">
              * Motivo / Justificación (mínimo 10 caracteres):
            </label>
            <textarea
              id="motivo"
              name="motivo"
              required
              minLength={10}
              rows={4}
              disabled={cargando}
              placeholder="Describa la causa de la merma o ajuste de inventario..."
            />
            <small>
              Campo obligatorio. RF-QA-06 / TC-02. El sistema rechazará el guardado sin motivo.
            </small>
          </div>
        </fieldset>

        <p>
          <small>
            ℹ️ El usuario responsable y la fecha/hora exacta se registran
            automáticamente desde la sesión activa (RF-QA-06).
          </small>
        </p>

        {error && (
          <p role="alert" style={{ color: "red" }}>
            ⚠ {error}
          </p>
        )}
        {exito && (
          <p role="status" style={{ color: "green" }}>
            {exito}
          </p>
        )}

        <button type="submit" id="btn-registrar-merma" disabled={cargando}>
          {cargando ? "Registrando..." : "Registrar Merma / Ajuste"}
        </button>
      </form>
    </main>
  );
}
