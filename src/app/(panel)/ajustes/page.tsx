import { asc } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { dia } from "@/lib/formato";
import { guardarHorario, bloquear, quitarBloqueo } from "../acciones";

export const dynamic = "force-dynamic";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/* De aquí salen los huecos que ve el paciente. No hay una tabla de huecos
   libres: la web resta a estas franjas las citas y los bloqueos, así que
   cambiar un horario cambia la agenda pública al momento. */
export default async function Ajustes() {
  await exigirUsuario();
  const db = await bd();
  const [horas, bloqueos] = await Promise.all([
    db.select().from(e.horario).orderBy(asc(e.horario.diaSemana), asc(e.horario.desde)),
    db.select().from(e.bloqueo).orderBy(asc(e.bloqueo.inicio)),
  ]);

  /* Dos turnos por día, que es como funciona una consulta: mañana y tarde. */
  const turno = (d: number, n: number) => {
    const delDia = horas.filter((h) => h.diaSemana === d);
    return delDia[n];
  };
  const hhmm = (t?: string) => (t ? t.slice(0, 5) : "");

  return (
    <>
      <div className="cabeza">
        <div><p className="eyebrow">Ajustes</p><h1>Horario de consulta</h1></div>
      </div>

      <p className="entrada" style={{ fontSize: "var(--fs-4)", fontFamily: "var(--sans)", maxWidth: "62ch" }}>
        De aquí salen los huecos que ve el paciente al pedir cita. Un día sin
        horas no aparece en el calendario. Deja los dos turnos vacíos para
        cerrar el día entero.
      </p>

      <form action={guardarHorario} className="tarjeta" style={{ maxWidth: 620, marginBottom: 34 }}>
        <table className="horario">
          <thead><tr><th>Día</th><th>Mañana</th><th>Tarde</th></tr></thead>
          <tbody>
            {DIAS.map((nombre, i) => {
              const d = i + 1, m = turno(d, 0), t = turno(d, 1);
              return (
                <tr key={d}>
                  <td style={{ verticalAlign: "middle" }}>{nombre}</td>
                  <td>
                    <div className="par">
                      <input type="time" name={`${d}-m-desde`} defaultValue={hhmm(m?.desde)} aria-label={`${nombre}, mañana, desde`} />
                      <input type="time" name={`${d}-m-hasta`} defaultValue={hhmm(m?.hasta)} aria-label={`${nombre}, mañana, hasta`} />
                    </div>
                  </td>
                  <td>
                    <div className="par">
                      <input type="time" name={`${d}-t-desde`} defaultValue={hhmm(t?.desde)} aria-label={`${nombre}, tarde, desde`} />
                      <input type="time" name={`${d}-t-hasta`} defaultValue={hhmm(t?.hasta)} aria-label={`${nombre}, tarde, hasta`} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="btn" style={{ marginTop: 16 }}>Guardar horario</button>
      </form>

      <h2 style={{ marginBottom: 12 }}>Días cerrados</h2>
      <p className="silencio" style={{ fontSize: "var(--fs-3)", marginBottom: 14, maxWidth: "62ch" }}>
        Vacaciones, congresos o quirófano. Lo que caiga dentro deja de ofrecerse,
        aunque el horario diga que hay consulta.
      </p>

      <form action={bloquear} className="tarjeta" style={{ maxWidth: 620, marginBottom: 14 }}>
        <div className="campos">
          <div className="campo"><label htmlFor="b-inicio">Desde</label>
            <input id="b-inicio" name="inicio" type="date" required /></div>
          <div className="campo"><label htmlFor="b-fin">Hasta</label>
            <input id="b-fin" name="fin" type="date" required /></div>
          <div className="campo"><label htmlFor="b-motivo">Motivo</label>
            <input id="b-motivo" name="motivo" placeholder="Vacaciones" /></div>
        </div>
        <button className="btn">Cerrar esos días</button>
      </form>

      {bloqueos.length === 0 ? <p className="vacio">Ningún día cerrado.</p> : (
        <table style={{ maxWidth: 620 }}>
          <tbody>
            {bloqueos.map((b) => (
              <tr key={b.id}>
                <td className="mono" style={{ fontSize: "var(--fs-3)" }}>
                  {dia(b.inicio)} — {dia(b.fin)}
                </td>
                <td>{b.motivo ?? "—"}</td>
                <td style={{ textAlign: "right" }}>
                  <form action={quitarBloqueo.bind(null, b.id)}>
                    <button className="btn linea mini">Quitar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
