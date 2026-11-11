/**
 * app/dashboard/page.tsx
 *
 * Dashboard principal. Server Component que lee el rol del header
 * inyectado por el middleware y muestra el menú correspondiente.
 */
import { headers } from "next/headers";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  const headersList = await headers();
  const rol = headersList.get("x-user-rol") ?? "desconocido";
  const nombre = headersList.get("x-user-nombre") ?? "Usuario";

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Sistema de control de inventario</span>
          <h1>Panel principal</h1>
          <p className="subtitle">
            Bienvenido, <strong>{nombre}</strong>. Rol activo: <span className="badge">{rol}</span>
          </p>
        </div>
      </header>

      <section className="card">
        <div className="card-header">
          <h2>Módulos disponibles</h2>
          <p>Acceda a las funciones habilitadas según su perfil dentro de la clínica dental.</p>
        </div>
        <nav aria-label="Módulos del sistema">
          <ul className="nav-grid">
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
      </section>

      <section className="card soft">
        <div className="card-header">
          <h2>Sesión</h2>
          <p>Clínica Dental UABC · FACISALUD Valle de las Palmas</p>
        </div>
        <LogoutButton />
      </section>
    </main>
  );
}
