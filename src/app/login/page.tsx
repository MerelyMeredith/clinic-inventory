/**
 * app/login/page.tsx
 *
 * RF-QA-01: Página de Login.
 * Componente cliente que envía credenciales al API de autenticación.
 * La sesión se maneja con cookie HTTP-only (no localStorage/sessionStorage).
 */
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    if (!username || !password) {
      setError("Usuario y contraseña son obligatorios.");
      setCargando(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "same-origin", // Incluir cookies en la respuesta
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión.");
        setCargando(false);
        return;
      }

      // Redirigir al dashboard tras login exitoso
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de red. Intente nuevamente.");
      setCargando(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="card login-card">
        <div className="login-brand">
          <div className="seal" aria-hidden="true">U</div>
          <span className="eyebrow">FACISALUD Valle de las Palmas</span>
          <h1>Inventario Clínica Dental</h1>
          <p className="subtitle">Acceso seguro para personal autorizado de la UABC</p>
        </div>

        <form onSubmit={handleSubmit} method="post" id="form-login" className="form-grid">
          <div className="field full">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              disabled={cargando}
              placeholder="Ingrese su nombre de usuario"
            />
          </div>

          <div className="field full">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={cargando}
              placeholder="Ingrese su contraseña"
            />
          </div>

          {error && (
            <div className="field full">
              <p role="alert" aria-live="assertive" className="alert error">
                ⚠ {error}
              </p>
            </div>
          )}

          <div className="field full">
            <button type="submit" disabled={cargando} id="btn-login" className="btn-primary" style={{ width: "100%" }}>
              {cargando ? "Verificando acceso..." : "Entrar al sistema"}
            </button>
          </div>
        </form>

        <div className="footer-note">
          <small>
            Universidad Autónoma de Baja California · Sistema protegido. Solo personal autorizado.
          </small>
        </div>
      </section>
    </main>
  );
}
