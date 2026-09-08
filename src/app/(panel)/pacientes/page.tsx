import Link from "next/link";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { diaHora } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function Pacientes({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  await exigirUsuario();
  const { q, estado } = await searchParams;
  const db = await bd();

  const filtros = [];
  if (estado === "lead" || estado === "paciente" || estado === "inactivo") {
    filtros.push(eq(e.paciente.estado, estado));
  }
  if (q?.trim()) {
    const patron = `%${q.trim()}%`;
    filtros.push(or(ilike(e.paciente.nombre, patron), ilike(e.paciente.apellidos, patron),
                    ilike(e.paciente.telefono, patron), ilike(e.paciente.email, patron))!);
  }

  const lista = await db.select().from(e.paciente)
    .where(filtros.length ? sql.join(filtros, sql` and `) : undefined)
    .orderBy(desc(e.paciente.actualizadoEn)).limit(200);

  return (
    <>
      <div className="cabeza">
        <div>
          <p className="eyebrow">{estado === "lead" ? "Leads" : "Pacientes"}</p>
          <h1>{lista.length}{lista.length === 200 ? "+" : ""} ficha{lista.length === 1 ? "" : "s"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <form style={{ display: "flex", gap: 8 }}>
            {estado && <input type="hidden" name="estado" value={estado} />}
            <input name="q" placeholder="Nombre, teléfono o correo" defaultValue={q ?? ""} style={{ width: 250 }} />
            <button className="btn linea">Buscar</button>
          </form>
          <Link className="btn" href="/pacientes/nuevo">Nuevo</Link>
        </div>
      </div>

      {lista.length === 0 ? <p className="vacio">Nadie coincide con esa búsqueda.</p> : (
        <table>
          <thead><tr><th>Nombre</th><th>Contacto</th><th>Estado</th><th>Origen</th><th>Última actividad</th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/pacientes/${p.id}`}>{p.nombre} {p.apellidos ?? ""}</Link></td>
                <td className="mono" style={{ fontSize: "var(--fs-2)" }}>
                  {p.telefono ?? "—"}{p.email && <div className="silencio">{p.email}</div>}
                </td>
                <td><span className={`etiqueta ${p.estado}`}>{p.estado}</span></td>
                <td className="silencio" style={{ fontSize: "var(--fs-3)" }}>{p.origen}</td>
                <td className="silencio mono" style={{ fontSize: "var(--fs-2)" }}>{diaHora(p.actualizadoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
