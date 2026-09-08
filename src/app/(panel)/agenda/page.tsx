import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { hora, diaLargo, limitesDelDia } from "@/lib/formato";

export const dynamic = "force-dynamic";

/* Vista de semana. Es una lista por días y no una cuadrícula por horas a
   propósito: en una consulta con pocas citas al día, la cuadrícula es sobre
   todo hueco en blanco. Cuando la agenda se llene, se cambia. */
export default async function Agenda({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await exigirUsuario();
  const { d } = await searchParams;
  const db = await bd();

  const base = d ? new Date(`${d}T12:00:00`) : new Date();
  const { inicio: hoy } = limitesDelDia(base);
  /* La semana empieza el lunes. */
  const lunes = new Date(hoy.getTime() - ((base.getDay() + 6) % 7) * 86400_000);
  const fin = new Date(lunes.getTime() + 7 * 86400_000);

  const citas = await db.select({
      id: e.cita.id, inicio: e.cita.inicio, duracion: e.cita.duracionMin, estado: e.cita.estado,
      motivo: e.cita.motivo, pacienteId: e.paciente.id, paciente: e.paciente.nombre,
      apellidos: e.paciente.apellidos, tratamiento: e.tratamiento.nombre,
    })
    .from(e.cita)
    .innerJoin(e.paciente, eq(e.paciente.id, e.cita.pacienteId))
    .leftJoin(e.tratamiento, eq(e.tratamiento.id, e.cita.tratamientoId))
    .where(and(gte(e.cita.inicio, lunes), lt(e.cita.inicio, fin)))
    .orderBy(asc(e.cita.inicio));

  const dias = Array.from({ length: 7 }, (_, i) => new Date(lunes.getTime() + i * 86400_000));
  const ymd = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(x);
  const anterior = ymd(new Date(lunes.getTime() - 7 * 86400_000));
  const siguiente = ymd(new Date(lunes.getTime() + 7 * 86400_000));

  return (
    <>
      <div className="cabeza">
        <div><p className="eyebrow">Agenda</p>
          <h1>Semana del {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(lunes)}</h1></div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn linea mini" href={`/agenda?d=${anterior}`}>← Anterior</Link>
          <Link className="btn linea mini" href="/agenda">Esta semana</Link>
          <Link className="btn linea mini" href={`/agenda?d=${siguiente}`}>Siguiente →</Link>
        </div>
      </div>
      <div className="rejilla tres">
        {dias.map((dd) => {
          const delDia = citas.filter((c) => ymd(c.inicio) === ymd(dd));
          return (
            <section className="tarjeta" key={ymd(dd)} style={{ minHeight: 130 }}>
              <div className="k" style={{ marginBottom: 10 }}>{diaLargo(dd)}</div>
              {delDia.length === 0 ? <p className="silencio" style={{ fontSize: "var(--fs-3)" }}>—</p> : delDia.map((c) => (
                <div key={c.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--rule)" }}>
                  <span className="mono" style={{ fontSize: "var(--fs-3)" }}>{hora(c.inicio)}</span>{" "}
                  <Link href={`/pacientes/${c.pacienteId}`} style={{ textDecoration: "none" }}>
                    {c.paciente} {c.apellidos ?? ""}
                  </Link>
                  <div className="silencio" style={{ fontSize: "var(--fs-2)" }}>
                    {c.tratamiento ?? c.motivo ?? "—"} · {c.duracion} min
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
