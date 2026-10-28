/**
 * app/dashboard/page.tsx
 *
 * Dashboard principal. Server Component que lee el rol del header
 * inyectado por el middleware y muestra el menú correspondiente.
 */
import { headers } from "next/headers";
import Link from "next/link";

export default async function DashboardPage() {
  const headersList = await headers();
  const rol = headersList.get("x-user-rol") ?? "desconocido";
  const nombre = headersList.get("x-user-nombre") ?? "Usuario";

  return (
    <main>
      <h1>Panel Principal — Inventario Clínica Dental UABC</h1>
      <p>
        Bienvenido. Rol activo: <strong>{rol}</strong>
      </p>

      <nav aria-label="Módulos del sistema">
        <h2>Módulos disponibles</h2>
        <ul>
          {/* Todos los roles autenticados */}
          <li>
            <Link href="/kardex">📋 Monitor Kardex / Historial de Movimientos</Link>
          </li>

          {/* Almacenista y Administrador */}
          {(rol === "administrador" || rol === "almacenista") && (
            <>
              <li>
                <Link href="/inventario/lotes/nuevo">📦 Registrar Entrada de Lote</Link>
              </li>
              <li>
                <Link href="/inventario/lotes">📦 Consultar Lotes</Link>
              </li>
              <li>
                <Link href="/merma/nuevo">⚠️ Registrar Merma / Ajuste</Link>
              </li>
            </>
          )}

          {/* Almacenista, Docente y Administrador */}
          {(rol === "administrador" || rol === "almacenista" || rol === "docente") && (
            <li>
              <Link href="/despacho/nuevo">🦷 Registrar Despacho (Ticket)</Link>
            </li>
          )}

          {/* Solo Administrador */}
          {rol === "administrador" && (
            <>
              <li>
                <Link href="/admin/usuarios">👥 Administrar Usuarios</Link>
              </li>
              <li>
                <Link href="/admin/bitacora">🔍 Bitácora de Auditoría</Link>
              </li>
            </>
          )}
        </ul>
      </nav>

      <hr />

      <form action="/api/auth/login" method="delete" id="form-logout">
        <button
          type="button"
          id="btn-logout"
          onClick={async () => {
            await fetch("/api/auth/login", { method: "DELETE" });
            window.location.href = "/login";
          }}
        >
          Cerrar Sesión
        </button>
      </form>
    </main>
  );
}
