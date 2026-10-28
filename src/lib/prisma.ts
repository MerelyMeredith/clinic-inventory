/**
 * lib/prisma.ts
 *
 * Singleton del cliente Prisma.
 * Patrón recomendado para Next.js (evita conexiones múltiples en hot-reload).
 *
 * MIGRACIÓN A SUPABASE:
 *   1. Cambiar DATABASE_URL en .env a la URL de conexión de Supabase.
 *   2. En prisma/schema.prisma cambiar provider = "postgresql".
 *   3. Sustituir @db.NVarChar -> @db.VarChar y @db.DateTime2 -> @db.Timestamptz.
 *   4. Ejecutar: npx prisma migrate deploy
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // Evitar múltiples instancias en modo de desarrollo con hot-reload
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma: PrismaClient =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
