/**
 * app/inventario/lotes/nuevo/page.tsx
 *
 * RF-QA-06 / RF-QA-04: Formulario de Entrada de Lote.
 *
 * Permite al almacenista registrar la recepción de un nuevo lote de insumos.
 * El backend valida que si el insumo caduca, la fecha sea futura (TC-03).
 */
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Insumo {
  id_insumo: number;
  nombre: string;
  unidad_medida: string;
  caduca: boolean;
  stock_minimo: number;
}

export default function NuevoLotePage() {
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState<Insumo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Cargar catálogo de insumos al montar
  useEffect(() => {
    fetch("/api/inventario/insumos")
      .then((r) => r.json())
      .then((data) => setInsumos(data))
      .catch(() => setError("Error al cargar catálogo de insumos."));
  }, []);

  function handleInsumoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value);
    const ins = insumos.find((i) => i.id_insumo === id) ?? null;
    setInsumoSeleccionado(ins);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setCargando(true);

    const form = e.currentTarget;
    const id_insumo = Number(
      (form.elements.namedItem("id_insumo") as HTMLSelectElement).value
    );
    const cantidad_ingresada = Number(
      (form.elements.namedItem("cantidad_ingresada") as HTMLInputElement).value
    );
    const fecha_caducidad =
      (form.elements.namedItem("fecha_caducidad") as HTMLInputElement)?.value ||
      null;
    const proveedor = (
      form.elements.namedItem("proveedor") as HTMLInputElement
    ).value.trim();

    if (!id_insumo || !cantidad_ingresada || !proveedor) {
      setError("Todos los campos marcados con * son obligatorios.");
      setCargando(false);
      return;
    }

    try {
      const res = await fetch("/api/inventario/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_insumo,
          cantidad_ingresada,
          fecha_caducidad,
          proveedor,
        }),
        credentials: "same-origin",
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.detalles?.fieldErrors
            ? Object.values(data.detalles.fieldErrors).flat().join(" | ")
            : data.error ?? "Error al registrar lote.";
        setError(msg);
        setCargando(false);
        return;
      }

      setExito(`✅ Lote registrado exitosamente (ID: ${data.id_lote}).`);
      form.reset();
      setInsumoSeleccionado(null);
    } catch {
      setError("Error de red. Intente nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="page-shell narrow">
      <a href="/dashboard" className="link-back">← Volver al panel</a>
      <header className="page-header">
        <div>
          <span className="eyebrow">Inventario</span>
          <h1>Registrar entrada de lote</h1>
          <p className="subtitle">Capture la recepción de insumos con trazabilidad automática de usuario y fecha.</p>
        </div>
      </header>

      <section className="card form-card">
        <form onSubmit={handleSubmit} id="form-nuevo-lote" noValidate>
          <fieldset>
            <legend>Datos del lote</legend>

            <div className="form-grid">
              <div className="field full">
                <label htmlFor="id_insumo">* Insumo</label>
                <select
                  id="id_insumo"
                  name="id_insumo"
                  required
                  onChange={handleInsumoChange}
                  disabled={cargando}
                >
                  <option value="">— Seleccionar insumo —</option>
                  {insumos.map((ins) => (
                    <option key={ins.id_insumo} value={ins.id_insumo}>
                      [{ins.id_insumo}] {ins.nombre} ({ins.unidad_medida})
                    </option>
                  ))}
                </select>
                {insumoSeleccionado && (
                  <small>
                    Stock mínimo: {insumoSeleccionado.stock_minimo} ·{" "}
                    {insumoSeleccionado.caduca ? "⚠️ Este insumo requiere fecha de caducidad" : "✅ Sin fecha de caducidad"}
                  </small>
                )}
              </div>

              <div className="field">
                <label htmlFor="fecha_caducidad">
                  {insumoSeleccionado?.caduca ? "* " : ""}Fecha de caducidad
                </label>
                <input
                  id="fecha_caducidad"
                  name="fecha_caducidad"
                  type="date"
                  required={insumoSeleccionado?.caduca ?? false}
                  disabled={cargando || !insumoSeleccionado?.caduca}
                  min={new Date().toISOString().split("T")[0]}
                />
                {insumoSeleccionado?.caduca && <small>Obligatoria. Solo fechas futuras.</small>}
              </div>

              <div className="field">
                <label htmlFor="cantidad_ingresada">* Cantidad ingresada</label>
                <input
                  id="cantidad_ingresada"
                  name="cantidad_ingresada"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={cargando}
                />
                {insumoSeleccionado && <small>Unidad: {insumoSeleccionado.unidad_medida}</small>}
              </div>

              <div className="field full">
                <label htmlFor="proveedor">* Proveedor</label>
                <input
                  id="proveedor"
                  name="proveedor"
                  type="text"
                  maxLength={120}
                  required
                  disabled={cargando}
                  placeholder="Nombre del proveedor o distribuidor"
                />
              </div>
            </div>
          </fieldset>

          <p className="muted" style={{ marginBottom: "0.5rem" }}>
            <small>ℹ️ El usuario, fecha y hora se registran automáticamente desde su sesión activa (RF-QA-06).</small>
          </p>

          {error && (
            <p role="alert" className="alert error">
              ⚠ {error}
            </p>
          )}
          {exito && (
            <p role="status" className="alert success">
              {exito}
            </p>
          )}

          <div className="btn-row">
            <button type="submit" id="btn-guardar-lote" disabled={cargando} className="btn-primary">
              {cargando ? "Guardando..." : "Registrar entrada"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/inventario/lotes")}
              disabled={cargando}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
