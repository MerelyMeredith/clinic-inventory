/**
 * app/despacho/nuevo/page.tsx
 *
 * RF-QA-06 / RF-QA-07: Formulario de Despacho (Salida de Insumos).
 *
 * - Asocia un despacho a un estudiante y un empleado (docente/almacenista).
 * - Requiere motivo/justificación (RF-QA-06 / TC-02).
 * - El backend rechaza si algún lote no tiene stock suficiente (TC-01).
 * - Fecha y hora se registran automáticamente (RF-QA-06).
 */
"use client";

import { useState, useEffect, FormEvent } from "react";

interface Lote {
  id_lote: number;
  insumo: string;
  unidad_medida: string;
  saldo_disponible: number;
  estado: string;
  fecha_caducidad: string | null;
  proveedor: string;
}

interface Procedimiento {
  id_procedimiento: number;
  nombre_tratamiento: string;
  precio: number;
}

interface ItemDespacho {
  id_lote: number;
  cantidad: number;
}

export default function NuevoDespachoPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([]);
  const [items, setItems] = useState<ItemDespacho[]>([{ id_lote: 0, cantidad: 1 }]);
  const [procSeleccionado, setProcSeleccionado] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/kardex?solo_activos=true").then((r) => r.json()),
      fetch("/api/inventario/procedimientos").then((r) => r.json()),
    ])
      .then(([lotesData, procData]) => {
        setLotes(lotesData);
        setProcedimientos(procData);
      })
      .catch(() => setError("Error al cargar datos."));
  }, []);

  function addItem() {
    setItems([...items, { id_lote: 0, cantidad: 1 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemDespacho, value: number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setCargando(true);

    const form = e.currentTarget;
    const no_control = (
      form.elements.namedItem("no_control") as HTMLInputElement
    ).value.trim();
    const nombre_paciente = (
      form.elements.namedItem("nombre_paciente") as HTMLInputElement
    ).value.trim();
    // RF-QA-06 / TC-02: Motivo OBLIGATORIO
    const motivo = (
      form.elements.namedItem("motivo") as HTMLTextAreaElement
    ).value.trim();

    // Validaciones del formulario
    if (!no_control || !nombre_paciente || !motivo) {
      setError("No. control, nombre del paciente y motivo son obligatorios (RF-QA-06).");
      setCargando(false);
      return;
    }

    if (motivo.length < 5) {
      setError("El motivo debe tener al menos 5 caracteres.");
      setCargando(false);
      return;
    }

    if (procSeleccionado === 0) {
      setError("Seleccione al menos un procedimiento.");
      setCargando(false);
      return;
    }

    const detallesValidos = items.filter(
      (item) => item.id_lote > 0 && item.cantidad > 0
    );
    if (detallesValidos.length === 0) {
      setError("Agregue al menos un lote de insumo con cantidad válida.");
      setCargando(false);
      return;
    }

    const proc = procedimientos.find((p) => p.id_procedimiento === procSeleccionado);

    try {
      const res = await fetch("/api/despacho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          no_control,
          nombre_paciente,
          motivo,
          procedimientos: [
            {
              id_procedimiento: procSeleccionado,
              cantidad: 1,
              precio_unitario: proc?.precio ?? 0,
            },
          ],
          detalles: detallesValidos,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // TC-01: Mensaje específico de stock insuficiente
        setError(data.error ?? "Error al registrar despacho.");
        setCargando(false);
        return;
      }

      setExito(`✅ Despacho registrado. Ticket #${data.ticket_id}`);
      form.reset();
      setItems([{ id_lote: 0, cantidad: 1 }]);
      setProcSeleccionado(0);
    } catch {
      setError("Error de red. Intente nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main>
      <h1>Registrar Despacho de Insumos (Ticket)</h1>
      <p>
        <a href="/dashboard">← Volver al Panel</a>
      </p>

      <form onSubmit={handleSubmit} id="form-despacho" noValidate>
        <fieldset>
          <legend>Datos del Servicio</legend>

          <div>
            <label htmlFor="no_control">* No. de Control del Estudiante:</label>
            <input
              id="no_control"
              name="no_control"
              type="text"
              required
              maxLength={30}
              disabled={cargando}
              placeholder="ej. 1289456"
            />
          </div>

          <div>
            <label htmlFor="nombre_paciente">* Nombre del Paciente:</label>
            <input
              id="nombre_paciente"
              name="nombre_paciente"
              type="text"
              required
              maxLength={120}
              disabled={cargando}
            />
          </div>

          <div>
            <label htmlFor="id_procedimiento">* Procedimiento Realizado:</label>
            <select
              id="id_procedimiento"
              name="id_procedimiento"
              required
              disabled={cargando}
              onChange={(e) => setProcSeleccionado(Number(e.target.value))}
            >
              <option value={0}>— Seleccionar procedimiento —</option>
              {procedimientos.map((p) => (
                <option key={p.id_procedimiento} value={p.id_procedimiento}>
                  {p.nombre_tratamiento} (${p.precio.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* RF-QA-06 / TC-02: Motivo OBLIGATORIO */}
          <div>
            <label htmlFor="motivo">
              * Motivo / Justificación del Despacho:
            </label>
            <textarea
              id="motivo"
              name="motivo"
              required
              minLength={5}
              rows={3}
              disabled={cargando}
              placeholder="Describa el motivo o justificación del despacho..."
            />
            <small>Campo obligatorio. RF-QA-06 / TC-02.</small>
          </div>
        </fieldset>

        <fieldset>
          <legend>Insumos a Despachar</legend>
          <p>
            <small>
              ⚠️ Se bloqueará el guardado si la cantidad excede el stock disponible
              en el lote (RF-QA-07 / TC-01).
            </small>
          </p>

          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Lote / Insumo</th>
                <th>Stock Disponible</th>
                <th>Cantidad a Despachar</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const loteInfo = lotes.find(
                  (l) => l.id_lote === item.id_lote
                );
                return (
                  <tr key={index}>
                    <td>
                      <select
                        aria-label={`Lote ${index + 1}`}
                        value={item.id_lote}
                        onChange={(e) =>
                          updateItem(index, "id_lote", Number(e.target.value))
                        }
                        disabled={cargando}
                      >
                        <option value={0}>— Seleccionar lote —</option>
                        {lotes
                          .filter((l) => l.saldo_disponible > 0)
                          .map((l) => (
                            <option key={l.id_lote} value={l.id_lote}>
                              #{l.id_lote} — {l.insumo} (disp: {l.saldo_disponible}{" "}
                              {l.unidad_medida})
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      {loteInfo
                        ? `${loteInfo.saldo_disponible} ${loteInfo.unidad_medida}`
                        : "—"}
                    </td>
                    <td>
                      <input
                        type="number"
                        aria-label={`Cantidad lote ${index + 1}`}
                        min={0.01}
                        max={loteInfo?.saldo_disponible ?? undefined}
                        step={0.01}
                        value={item.cantidad}
                        onChange={(e) =>
                          updateItem(index, "cantidad", Number(e.target.value))
                        }
                        disabled={cargando}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1 || cargando}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button type="button" onClick={addItem} disabled={cargando}>
            + Agregar otro insumo
          </button>
        </fieldset>

        <p>
          <small>
            ℹ️ El usuario responsable y la fecha/hora se registran automáticamente
            desde la sesión activa (RF-QA-06).
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

        <button type="submit" id="btn-registrar-despacho" disabled={cargando}>
          {cargando ? "Procesando..." : "Registrar Despacho"}
        </button>
      </form>
    </main>
  );
}
