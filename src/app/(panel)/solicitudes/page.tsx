import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { diaHora } from "@/lib/formato";
import { cambiarCita } from "../acciones";

export const dynamic = "force-dynamic";

export default async function Solicitudes() {
  await exigirUsuario();
  const db = await bd();
  const lista = await db.select({
      id: e.cita.id, inicio: e.cita.inicio, motivo: e.cita.motivo, pedidaEnWeb: e.cita.pedidaEnWeb,
      pacienteId: e.paciente.id, paciente: e.paciente.nombre, apellidos: e.paciente.apellidos,
      telefono: e.paciente.telefono, email: e.paciente.email, tratamiento: e.tratamiento.nombre,
    })
    .from(e.cita)
    .innerJoin(e.paciente, eq(e.paciente.id, e.cita.pacienteId))
    .leftJoin(e.tratamiento, eq(e.tratamiento.id, e.cita.tratamientoId))
    .where(eq(e.cita.estado, "solicitada")).orderBy(asc(e.cita.inicio));

  return (
    <>
      <div className="cabeza">
        <div><p className="eyebrow">Solicitudes</p>
          <h1>{lista.length} por confirmar</h1></div>
      </div>
      {lista.length === 0 ? <p className="vacio">Nada pendiente.</p> : (
        <table>
          <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué pide</th><th>Vía</th><th /></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td className="mono" style={{ fontSize: "var(--fs-3)" }}>{diaHora(s.inicio)}</td>
                <td><Link href={`/pacientes/${s.pacienteId}`}>{s.paciente} {s.apellidos ?? ""}</Link>
                  <div className="silencio mono" style={{ fontSize: "var(--fs-2)" }}>{s.telefono ?? s.email ?? "—"}</div></td>
                <td>{s.tratamiento ?? s.motivo ?? "—"}</td>
                <td className="silencio" style={{ fontSize: "var(--fs-3)" }}>{s.pedidaEnWeb ? "web" : "panel"}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <form action={cambiarCita.bind(null, s.id, "confirmada")} style={{ display: "inline-block", marginRight: 6 }}>
                    <button className="btn mini">Confirmar</button></form>
                  <form action={cambiarCita.bind(null, s.id, "cancelada")} style={{ display: "inline-block" }}>
                    <button className="btn linea mini">Descartar</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
