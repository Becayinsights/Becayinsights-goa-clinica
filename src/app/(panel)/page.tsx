import Link from "next/link";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { diaLargo, hora, diaHora, limitesDelDia } from "@/lib/formato";
import { cambiarCita } from "./acciones";

export const dynamic = "force-dynamic";

export default async function Hoy() {
  await exigirUsuario();
  const db = await bd();
  const { inicio, fin } = limitesDelDia();

  const citas = await db.select({
      id: e.cita.id, inicio: e.cita.inicio, estado: e.cita.estado, motivo: e.cita.motivo,
      paciente: e.paciente.nombre, apellidos: e.paciente.apellidos, pacienteId: e.paciente.id,
      telefono: e.paciente.telefono, tratamiento: e.tratamiento.nombre,
    })
    .from(e.cita)
    .innerJoin(e.paciente, eq(e.paciente.id, e.cita.pacienteId))
    .leftJoin(e.tratamiento, eq(e.tratamiento.id, e.cita.tratamientoId))
    .where(and(gte(e.cita.inicio, inicio), lt(e.cita.inicio, fin)))
    .orderBy(asc(e.cita.inicio));

  const solicitudes = await db.select({
      id: e.cita.id, inicio: e.cita.inicio, paciente: e.paciente.nombre,
      pacienteId: e.paciente.id, telefono: e.paciente.telefono, tratamiento: e.tratamiento.nombre,
    })
    .from(e.cita)
    .innerJoin(e.paciente, eq(e.paciente.id, e.cita.pacienteId))
    .leftJoin(e.tratamiento, eq(e.tratamiento.id, e.cita.tratamientoId))
    .where(eq(e.cita.estado, "solicitada"))
    .orderBy(asc(e.cita.inicio)).limit(10);

  const nuevos = await db.select().from(e.paciente)
    .where(eq(e.paciente.estado, "lead")).orderBy(desc(e.paciente.creadoEn)).limit(8);

  return (
    <>
      <div className="cabeza">
        <div>
          <p className="eyebrow">Hoy</p>
          <h1 style={{ textTransform: "capitalize" }}>{diaLargo(new Date())}</h1>
        </div>
        <Link className="btn" href="/pacientes/nuevo">Nuevo paciente</Link>
      </div>

      <section style={{ marginBottom: 34 }}>
        <h2 style={{ marginBottom: 12 }}>Consulta del día</h2>
        {citas.length === 0 ? (
          <p className="vacio">No hay nada citado para hoy.</p>
        ) : (
          <table>
            <thead><tr><th style={{ width: 70 }}>Hora</th><th>Paciente</th><th>Tratamiento</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{hora(c.inicio)}</td>
                  <td>
                    <Link href={`/pacientes/${c.pacienteId}`}>{c.paciente} {c.apellidos ?? ""}</Link>
                    {c.telefono && <div className="silencio mono" style={{ fontSize: "var(--fs-2)" }}>{c.telefono}</div>}
                  </td>
                  <td>{c.tratamiento ?? c.motivo ?? "—"}</td>
                  <td><span className={`etiqueta ${c.estado}`}>{c.estado.replace("_", " ")}</span></td>
                  <td style={{ textAlign: "right" }}>
                    {c.estado === "confirmada" && (
                      <form action={cambiarCita.bind(null, c.id, "hecha")}>
                        <button className="btn linea mini">Marcar hecha</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="rejilla dos">
        <section>
          <h2 style={{ marginBottom: 12 }}>Por confirmar</h2>
          {solicitudes.length === 0 ? <p className="vacio">Nada pendiente de confirmar.</p> : (
            <div className="rejilla" style={{ gap: 8 }}>
              {solicitudes.map((s) => (
                <div className="tarjeta" key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <Link href={`/pacientes/${s.pacienteId}`} style={{ textDecoration: "none", fontWeight: 500 }}>{s.paciente}</Link>
                    <div className="silencio" style={{ fontSize: "var(--fs-3)" }}>
                      {diaHora(s.inicio)} · {s.tratamiento ?? "sin tratamiento"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={cambiarCita.bind(null, s.id, "confirmada")}><button className="btn mini">Confirmar</button></form>
                    <form action={cambiarCita.bind(null, s.id, "cancelada")}><button className="btn linea mini">Descartar</button></form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ marginBottom: 12 }}>Leads sin citar</h2>
          {nuevos.length === 0 ? <p className="vacio">Ninguno esperando.</p> : (
            <table>
              <thead><tr><th>Nombre</th><th>Contacto</th><th>Entró</th></tr></thead>
              <tbody>
                {nuevos.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/pacientes/${p.id}`}>{p.nombre} {p.apellidos ?? ""}</Link>
                      {p.motivo && <div className="silencio" style={{ fontSize: "var(--fs-2)" }}>{p.motivo.slice(0, 70)}</div>}</td>
                    <td className="mono" style={{ fontSize: "var(--fs-2)" }}>{p.telefono ?? p.email ?? "—"}</td>
                    <td className="silencio mono" style={{ fontSize: "var(--fs-2)" }}>{diaHora(p.creadoEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
