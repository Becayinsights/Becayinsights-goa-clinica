import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario, registrar } from "@/lib/sesion";
import { diaHora, dia, edad, euros } from "@/lib/formato";
import { guardarPaciente, anotar, citar, cambiarCita, apuntarActo, apuntarCobro } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario();
  const { id } = await params;
  const db = await bd();

  const [p] = await db.select().from(e.paciente).where(eq(e.paciente.id, id));
  if (!p) notFound();

  /* Abrir una historia clínica es un acceso, y como tal queda anotado. */
  await registrar(u.id, "ver", "paciente", p.id);

  const [citas, notas, tratamientos, actos, cobros] = await Promise.all([
    db.select({ id: e.cita.id, inicio: e.cita.inicio, estado: e.cita.estado,
                motivo: e.cita.motivo, tratamiento: e.tratamiento.nombre })
      .from(e.cita).leftJoin(e.tratamiento, eq(e.tratamiento.id, e.cita.tratamientoId))
      .where(eq(e.cita.pacienteId, id)).orderBy(desc(e.cita.inicio)),
    db.select().from(e.nota).where(eq(e.nota.pacienteId, id)).orderBy(desc(e.nota.creadaEn)),
    db.select().from(e.tratamiento).where(eq(e.tratamiento.activo, true)).orderBy(asc(e.tratamiento.orden)),
    db.select({ id: e.acto.id, fecha: e.acto.fecha, producto: e.acto.producto, lote: e.acto.lote,
                zonas: e.acto.zonas, dosis: e.acto.dosis, notas: e.acto.notas,
                tratamiento: e.tratamiento.nombre })
      .from(e.acto).leftJoin(e.tratamiento, eq(e.tratamiento.id, e.acto.tratamientoId))
      .where(eq(e.acto.pacienteId, id)).orderBy(desc(e.acto.fecha)),
    db.select().from(e.cobro).where(eq(e.cobro.pacienteId, id)).orderBy(desc(e.cobro.fecha)),
  ]);

  const gastado = cobros.reduce((n, c) => n + c.importeCents, 0);
  const hoy = new Date().toISOString().slice(0, 16);

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

          <section style={{ marginBottom: 30 }}>
            <h2 style={{ marginBottom: 12 }}>Tratamientos realizados</h2>
            <details className="plegable">
              <summary>Apuntar uno</summary>
              <form action={apuntarActo.bind(null, p.id)} className="tarjeta" style={{ marginTop: 10 }}>
                <div className="campos">
                  <div className="campo"><label htmlFor="a-trat">Qué se hizo</label>
                    <select id="a-trat" name="tratamientoId" defaultValue="">
                      <option value="">Sin concretar</option>
                      {tratamientos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select></div>
                  <div className="campo"><label htmlFor="a-fecha">Cuándo</label>
                    <input id="a-fecha" name="fecha" type="datetime-local" defaultValue={hoy} /></div>
                  <div className="campo"><label htmlFor="a-producto">Producto</label>
                    <input id="a-producto" name="producto" placeholder="Marca y presentación" /></div>
                  <div className="campo"><label htmlFor="a-lote">Lote</label>
                    <input id="a-lote" name="lote" /></div>
                  <div className="campo"><label htmlFor="a-zonas">Zonas</label>
                    <input id="a-zonas" name="zonas" placeholder="Entrecejo, frente…" /></div>
                  <div className="campo"><label htmlFor="a-dosis">Dosis</label>
                    <input id="a-dosis" name="dosis" placeholder="Unidades o ml" /></div>
                  <div className="campo"><label htmlFor="a-importe">Cobrado</label>
                    <input id="a-importe" name="importe" inputMode="decimal" placeholder="350" /></div>
                  <div className="campo"><label htmlFor="a-metodo">Método</label>
                    <select id="a-metodo" name="metodo" defaultValue="tarjeta">
                      <option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option><option value="bizum">Bizum</option>
                      <option value="financiado">Financiado</option>
                    </select></div>
                </div>
                <div className="campo"><label htmlFor="a-notas">Observaciones</label>
                  <textarea id="a-notas" name="notas" style={{ minHeight: 54 }} /></div>
                <button className="btn">Apuntar</button>
              </form>
            </details>

            {actos.length === 0 ? <p className="vacio">Todavía no se le ha hecho nada.</p> : (
              <div className="rejilla" style={{ gap: 8 }}>
                {actos.map((a) => (
                  <article className="tarjeta" key={a.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong style={{ fontWeight: 500 }}>{a.tratamiento ?? "Tratamiento"}</strong>
                      <span className="k">{dia(a.fecha)}</span>
                    </div>
                    {(a.producto || a.lote || a.zonas || a.dosis) && (
                      <dl className="datos">
                        {a.producto && <><dt>Producto</dt><dd>{a.producto}</dd></>}
                        {a.lote && <><dt>Lote</dt><dd className="mono">{a.lote}</dd></>}
                        {a.zonas && <><dt>Zonas</dt><dd>{a.zonas}</dd></>}
                        {a.dosis && <><dt>Dosis</dt><dd>{a.dosis}</dd></>}
                      </dl>
                    )}
                    {a.notas && <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{a.notas}</p>}
                  </article>
                ))}
              </div>
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

        <section className="tarjeta" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3>Cobros</h3>
            <span style={{ fontFamily: "var(--serif)", fontSize: 22 }}>{euros(gastado)}</span>
          </div>
          {cobros.length === 0
            ? <p className="vacio" style={{ padding: "10px 0" }}>Sin cobros apuntados.</p>
            : (
              <ul className="cobros">
                {cobros.map((c) => (
                  <li key={c.id}>
                    <span>
                      {c.concepto}
                      <em className="silencio">{dia(new Date(`${c.fecha}T12:00:00Z`))} · {c.metodo}</em>
                    </span>
                    <span>{euros(c.importeCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          <details className="plegable" style={{ marginTop: 10 }}>
            <summary>Apuntar un cobro suelto</summary>
            <form action={apuntarCobro.bind(null, p.id)} style={{ marginTop: 10 }}>
              <div className="campos">
                <div className="campo"><label htmlFor="c-fecha">Fecha</label>
                  <input id="c-fecha" name="fecha" type="date" defaultValue={hoy.slice(0, 10)} /></div>
                <div className="campo"><label htmlFor="c-importe">Importe</label>
                  <input id="c-importe" name="importe" inputMode="decimal" required /></div>
              </div>
              <div className="campo"><label htmlFor="c-concepto">Concepto</label>
                <input id="c-concepto" name="concepto" placeholder="Sesión suelta, anticipo…" /></div>
              <div className="campo"><label htmlFor="c-metodo">Método</label>
                <select id="c-metodo" name="metodo" defaultValue="tarjeta">
                  <option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option><option value="bizum">Bizum</option>
                  <option value="financiado">Financiado</option>
                </select></div>
              <button className="btn">Apuntar cobro</button>
            </form>
          </details>
        </section>
      </div>
    </>
  );
}
