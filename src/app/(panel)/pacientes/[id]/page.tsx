import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario, registrar } from "@/lib/sesion";
import { diaHora, dia, edad } from "@/lib/formato";
import { guardarPaciente, anotar, citar, cambiarCita } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario();
  const { id } = await params;
  const db = await bd();

  const [p] = await db.select().from(e.paciente).where(eq(e.paciente.id, id));
  if (!p) notFound();

  /* Abrir una historia clínica es un acceso, y como tal queda anotado. */
  await registrar(u.id, "ver", "paciente", p.id);

  const [citas, notas, tratamientos] = await Promise.all([
    db.select({ id: e.cita.id, inicio: e.cita.inicio, estado: e.cita.estado,
                motivo: e.cita.motivo, tratamiento: e.tratamiento.nombre })
      .from(e.cita).leftJoin(e.tratamiento, eq(e.tratamiento.id, e.cita.tratamientoId))
      .where(eq(e.cita.pacienteId, id)).orderBy(desc(e.cita.inicio)),
    db.select().from(e.nota).where(eq(e.nota.pacienteId, id)).orderBy(desc(e.nota.creadaEn)),
    db.select().from(e.tratamiento).where(eq(e.tratamiento.activo, true)).orderBy(asc(e.tratamiento.orden)),
  ]);

  const años = edad(p.fechaNacimiento);

  return (
    <>
      <div className="cabeza">
        <div>
          <p className="eyebrow"><Link href="/pacientes" style={{ textDecoration: "none" }}>Pacientes</Link></p>
          <h1>{p.nombre} {p.apellidos ?? ""}</h1>
          <p className="silencio" style={{ fontSize: "var(--fs-3)", marginTop: 6 }}>
            <span className={`etiqueta ${p.estado}`}>{p.estado}</span>{" "}
            {años != null && `${años} años · `}
            {p.telefono ?? "sin teléfono"}{p.email ? ` · ${p.email}` : ""} · alta {dia(p.creadoEn)}
          </p>
        </div>
      </div>

      {(p.alergias || p.antecedentes) && (
        <div className="error" style={{ maxWidth: 720 }}>
          {p.alergias && <div><strong>Alergias:</strong> {p.alergias}</div>}
          {p.antecedentes && <div><strong>Antecedentes:</strong> {p.antecedentes}</div>}
        </div>
      )}

      <div className="rejilla dos" style={{ alignItems: "start" }}>
        <div>
          <section style={{ marginBottom: 30 }}>
            <h2 style={{ marginBottom: 12 }}>Citas</h2>
            <form action={citar.bind(null, p.id)} className="tarjeta" style={{ marginBottom: 14 }}>
              <div className="campos">
                <div className="campo"><label htmlFor="inicio">Cuándo</label>
                  <input id="inicio" name="inicio" type="datetime-local" required /></div>
                <div className="campo"><label htmlFor="tratamientoId">Para qué</label>
                  <select id="tratamientoId" name="tratamientoId" defaultValue="">
                    <option value="">Sin concretar</option>
                    {tratamientos.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.duracionMin} min</option>)}
                  </select></div>
              </div>
              <button className="btn">Citar</button>
            </form>
            {citas.length === 0 ? <p className="vacio">Todavía no ha venido.</p> : (
              <table>
                <thead><tr><th>Cuándo</th><th>Qué</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {citas.map((c) => (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontSize: "var(--fs-3)" }}>{diaHora(c.inicio)}</td>
                      <td>{c.tratamiento ?? c.motivo ?? "—"}</td>
                      <td><span className={`etiqueta ${c.estado}`}>{c.estado.replace("_", " ")}</span></td>
                      <td style={{ textAlign: "right" }}>
                        {(c.estado === "confirmada" || c.estado === "solicitada") && (
                          <form action={cambiarCita.bind(null, c.id, "hecha")}>
                            <button className="btn linea mini">Hecha</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2 style={{ marginBottom: 12 }}>Historia</h2>
            <form action={anotar.bind(null, p.id)} style={{ marginBottom: 16 }}>
              <div className="campo">
                <label htmlFor="texto">Nueva nota</label>
                <textarea id="texto" name="texto" placeholder="Qué se ve, qué se decide y por qué." />
              </div>
              <button className="btn">Guardar nota</button>
            </form>
            {notas.length === 0 ? <p className="vacio">Sin notas todavía.</p> : notas.map((n) => (
              <article className="tarjeta" key={n.id} style={{ marginBottom: 10 }}>
                <div className="k" style={{ marginBottom: 6 }}>{diaHora(n.creadaEn)}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{n.texto}</div>
              </article>
            ))}
          </section>
        </div>

        <form action={guardarPaciente.bind(null, p.id)} className="tarjeta">
          <h3 style={{ marginBottom: 14 }}>Ficha</h3>
          <div className="campos">
            <div className="campo"><label htmlFor="f-nombre">Nombre</label>
              <input id="f-nombre" name="nombre" defaultValue={p.nombre} required /></div>
            <div className="campo"><label htmlFor="f-apellidos">Apellidos</label>
              <input id="f-apellidos" name="apellidos" defaultValue={p.apellidos ?? ""} /></div>
            <div className="campo"><label htmlFor="f-telefono">Teléfono</label>
              <input id="f-telefono" name="telefono" defaultValue={p.telefono ?? ""} /></div>
            <div className="campo"><label htmlFor="f-email">Correo</label>
              <input id="f-email" name="email" type="email" defaultValue={p.email ?? ""} /></div>
            <div className="campo"><label htmlFor="f-nac">Nacimiento</label>
              <input id="f-nac" name="fechaNacimiento" type="date" defaultValue={p.fechaNacimiento ?? ""} /></div>
            <div className="campo"><label htmlFor="f-estado">Estado</label>
              <select id="f-estado" name="estado" defaultValue={p.estado}>
                <option value="lead">Lead</option>
                <option value="paciente">Paciente</option>
                <option value="inactivo">Inactivo</option>
              </select></div>
          </div>
          <div className="campo"><label htmlFor="f-alergias">Alergias</label>
            <textarea id="f-alergias" name="alergias" defaultValue={p.alergias ?? ""} style={{ minHeight: 54 }} /></div>
          <div className="campo"><label htmlFor="f-ant">Antecedentes</label>
            <textarea id="f-ant" name="antecedentes" defaultValue={p.antecedentes ?? ""} style={{ minHeight: 54 }} /></div>
          <div className="campo"><label htmlFor="f-notas">Notas administrativas</label>
            <textarea id="f-notas" name="notas" defaultValue={p.notas ?? ""} style={{ minHeight: 54 }} /></div>
          <button className="btn">Guardar</button>
        </form>
      </div>
    </>
  );
}
