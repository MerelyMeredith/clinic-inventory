/**
 * app/forbidden/page.tsx
 *
 * Página mostrada cuando el middleware deniega acceso a una ruta
 * por rol insuficiente (RF-QA-02).
 */
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="login-shell">
      <section className="card login-card" style={{ textAlign: "center" }}>
        <div className="login-brand">
          <div className="seal" aria-hidden="true" style={{ background: "linear-gradient(135deg, #b42318 0%, #d92d20 100%)" }}>!</div>
          <span className="eyebrow">Seguridad del sistema</span>
          <h1>Acceso denegado</h1>
        </div>
        <p className="subtitle" style={{ marginBottom: "1.25rem" }}>
          Su rol no tiene permisos para acceder a esta sección del sistema
          (RF-QA-02 — Matriz de Permisos por Rol).
        </p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <Link href="/dashboard" className="btn-secondary-link" style={{ padding: "0.7rem 1.3rem", borderRadius: "999px", border: "1px solid #cfe0dc", fontWeight: 600 }}>
            ← Volver al panel principal
          </Link>
        </div>
      </section>
    </main>
  );
}
