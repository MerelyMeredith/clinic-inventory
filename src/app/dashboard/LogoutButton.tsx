"use client";

export default function LogoutButton() {
  return (
    <button
      type="button"
      id="btn-logout"
      className="btn-secondary"
      onClick={async () => {
        await fetch("/api/auth/login", { method: "DELETE" });
        window.location.href = "/login";
      }}
    >
      Cerrar sesión
    </button>
  );
}
