import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { dia, euros } from "@/lib/formato";

export const dynamic = "force-dynamic";

/* Registro de cobros, no facturación fiscal: qué se hizo, cuánto se cobró y
   cómo se pagó. Sirve para saber cómo va la consulta; la factura, mientras no
   se decida otra cosa, se emite fuera. */
export default async function Cobros() {
  await exigirUsuario();
  const db = await bd();

  const lista = await db.select({
      id: e.cobro.id, fecha: e.cobro.fecha, concepto: e.cobro.concepto,
      importe: e.cobro.importeCents, metodo: e.cobro.metodo,
      pacienteId: e.paciente.id, paciente: e.paciente.nombre, apellidos: e.paciente.apellidos,
    })
    .from(e.cobro).innerJoin(e.paciente, eq(e.paciente.id, e.cobro.pacienteId))
    .orderBy(desc(e.cobro.fecha)).limit(200);

  /* Los totales se piden a la base y no se suman aquí: con doscientas filas da
     igual, con veinte mil no. */
  const meses = await db.select({
      mes: sql<string>`to_char(${e.cobro.fecha}, 'YYYY-MM')`.as("mes"),
      total: sql<number>`sum(${e.cobro.importeCents})::int`.as("total"),
      n: sql<number>`count(*)::int`.as("n"),
    }).from(e.cobro).groupBy(sql`1`).orderBy(sql`1 desc`).limit(6);

  const porMetodo = await db.select({
      metodo: e.cobro.metodo,
      total: sql<number>`sum(${e.cobro.importeCents})::int`.as("total"),
    }).from(e.cobro).groupBy(e.cobro.metodo).orderBy(sql`2 desc`);

  const nombreMes = (ym: string) => {
    const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${ym}-01T12:00:00Z`));
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <>
      <div className="cabeza">
        <div>
          <p className="eyebrow">Cobros</p>
          <h1>{meses[0] ? euros(meses[0].total) : "—"} <span className="silencio" style={{ fontSize: "var(--fs-4)" }}>
            este mes</span></h1>
        </div>
      </div>

      {meses.length > 0 && (
        <div className="rejilla tres" style={{ marginBottom: 30 }}>
          {meses.slice(0, 3).map((m) => (
            <div className="tarjeta" key={m.mes}>
              <div className="k">{nombreMes(m.mes)}</div>
              <div className="cifra">{euros(m.total)}</div>
              <div className="silencio" style={{ fontSize: "var(--fs-2)", marginTop: 4 }}>
                {m.n} cobro{m.n === 1 ? "" : "s"}
              </div>
            </div>
          ))}
          {porMetodo.length > 0 && (
            <div className="tarjeta">
              <div className="k">Por método</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", fontSize: "var(--fs-3)" }}>
                {porMetodo.map((m) => (
                  <li key={m.metodo} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span className="silencio">{m.metodo}</span><span>{euros(m.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {lista.length === 0 ? <p className="vacio">Todavía no hay cobros apuntados.</p> : (
        <table>
          <thead><tr><th style={{ width: 96 }}>Fecha</th><th>Paciente</th><th>Concepto</th>
            <th>Método</th><th style={{ textAlign: "right" }}>Importe</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="mono" style={{ fontSize: "var(--fs-3)" }}>{dia(new Date(`${c.fecha}T12:00:00Z`))}</td>
                <td><Link href={`/pacientes/${c.pacienteId}`}>{c.paciente} {c.apellidos ?? ""}</Link></td>
                <td>{c.concepto}</td>
                <td className="silencio" style={{ fontSize: "var(--fs-3)" }}>{c.metodo}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{euros(c.importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
