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
    <main>
      <h1>Sistema de Control de Inventario — Clínica Dental UABC</h1>
      <h2>Inicio de Sesión</h2>

      <form onSubmit={handleSubmit} method="post" id="form-login">
        <div>
          <label htmlFor="username">Usuario:</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            disabled={cargando}
          />
        </div>

        <div>
          <label htmlFor="password">Contraseña:</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={cargando}
          />
        </div>

        {error && (
          <p role="alert" aria-live="assertive" style={{ color: "red" }}>
            ⚠ {error}
          </p>
        )}

        <button type="submit" disabled={cargando} id="btn-login">
          {cargando ? "Verificando..." : "Entrar"}
        </button>
      </form>

      <hr />
      <small>
        UABC — FACISALUD Valle de las Palmas |{" "}
        <em>Sistema protegido. Solo personal autorizado.</em>
      </small>
    </main>
  );
}
