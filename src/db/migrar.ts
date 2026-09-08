/* Aplica las migraciones de drizzle/ a la base que toque:
 *     npm run migrar
 * Sin DATABASE_URL trabaja contra la PGlite de desarrollo. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "drizzle");

async function main() {
  const url = process.env.DATABASE_URL;
  const ficheros = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  if (!ficheros.length) { console.log("No hay migraciones que aplicar."); return; }

  const ejecutar = await conexion(url);
  await ejecutar(`create table if not exists migracion (
      nombre text primary key, aplicada_en timestamptz not null default now())`);
  const hechas = new Set<string>(
    (await ejecutar("select nombre from migracion")).map((f: any) => f.nombre),
  );

  for (const f of ficheros) {
    if (hechas.has(f)) { console.log("  ya estaba  ", f); continue; }
    const sql = readFileSync(join(DIR, f), "utf8");
    /* drizzle separa las sentencias con este marcador. */
    for (const trozo of sql.split("--> statement-breakpoint")) {
      const t = trozo.trim();
      if (t) await ejecutar(t);
    }
    await ejecutar(`insert into migracion (nombre) values ('${f}')`);
    console.log("  aplicada   ", f);
  }
  console.log(url ? "Base remota al día." : "PGlite local al día (.pgdata).");
  process.exit(0);
}

async function conexion(url?: string) {
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 1 });
    return async (q: string) => (await sql.unsafe(q)) as any;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const cliente = new PGlite(process.env.PGLITE_DIR ?? ".pgdata");
  return async (q: string) => (await cliente.exec(q)).flatMap((r) => r.rows) as any;
}

main().catch((e) => { console.error(e); process.exit(1); });
