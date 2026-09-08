/* La conexión.
 *
 * En producción, Postgres por TCP con postgres.js. No usamos el cliente propio
 * de ningún proveedor a propósito: la misma cadena de conexión vale para Neon,
 * Supabase, RDS o un servidor del propio doctor, y poder mudar los datos sin
 * reescribir la aplicación es parte de tratarlos con cuidado.
 *
 * En desarrollo, si no hay DATABASE_URL, PGlite: Postgres de verdad compilado a
 * WASM, contra la carpeta .pgdata. Mismo dialecto y mismas migraciones, así que
 * lo que se prueba en local es lo que corre arriba.
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as esquema from "./esquema";

export type BD = PostgresJsDatabase<typeof esquema>;

/* Sin cadena de conexión no hay dónde guardar, así que la aplicación se enseña
   en modo demostración: misma aplicación, base en memoria, nada persistente. */
export const MODO_DEMO = !process.env.DATABASE_URL;

let cache: Promise<BD> | null = null;

async function abrir(): Promise<BD> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    /* prepare:false porque los pooler en modo transacción no mantienen las
       sentencias preparadas entre consultas. */
    const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20 });
    return drizzle(sql, { schema: esquema });
  }
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  /* Con carpeta, es la base de desarrollo del portátil. Sin ella, memoria: la
     demostración no deja rastro ni siquiera en el disco del servidor. */
  const carpeta = process.env.PGLITE_DIR;
  const cliente = carpeta ? new PGlite(carpeta) : new PGlite();
  /* Los dos drivers exponen la misma superficie de consulta; el tipo se unifica
     aquí para no arrastrar una unión por toda la aplicación. */
  const db = drizzle(cliente, { schema: esquema }) as unknown as BD;
  if (!carpeta) {
    const { montarDemo } = await import("./demo");
    await montarDemo(cliente, db);
  }
  return db;
}

export function bd(): Promise<BD> {
  if (!cache) cache = abrir();
  return cache;
}

export * as esquema from "./esquema";
