/**
 * app/forbidden/page.tsx
 *
 * Página mostrada cuando el middleware deniega acceso a una ruta
 * por rol insuficiente (RF-QA-02).
 */
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main>
      <h1>Acceso Denegado</h1>
      <p>
        Su rol no tiene permisos para acceder a esta sección del sistema
        (RF-QA-02 — Matriz de Permisos por Rol).
      </p>
      <p>
        <Link href="/dashboard">← Volver al Panel Principal</Link>
      </p>
    </main>
  );
}
