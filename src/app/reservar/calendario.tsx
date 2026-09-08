import Link from "next/link";
import type { Dia } from "@/lib/huecos";
import { hora, diaLargo, ZONA } from "@/lib/formato";

/* Calendario de mes, como en cualquier reserva de mesa: primero el día, y las
   horas debajo. La lista corrida anterior era honesta pero enseñaba doscientos
   huecos de golpe, y ante doscientas opciones no se elige, se cierra.
 *
 * Va sin JavaScript: cada día y cada hora son un enlace. En una pantalla que se
 * usa una vez, un enlace es más fiable que un componente, funciona con el botón
 * de atrás y se puede compartir por WhatsApp tal cual.
 */

/* "Septiembre de 2026". La mayúscula se pone aquí y no con capitalize de CSS,
   que capitaliza también el "de". */
const nombreMes = (ym: string) => {
  const t = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${ym}-01T12:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const hoyYmd = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());

/* Lunes a domingo, que es como se lee un calendario en España. */
const CABECERA = ["L", "M", "X", "J", "V", "S", "D"];

function celdas(ym: string): (string | null)[] {
  const [a, m] = ym.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const largo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const hueco = (primero.getUTCDay() + 6) % 7;              // ISO: lunes = 0
  const salida: (string | null)[] = Array(hueco).fill(null);
  for (let d = 1; d <= largo; d++) {
    salida.push(`${ym}-${String(d).padStart(2, "0")}`);
  }
  while (salida.length % 7) salida.push(null);
  return salida;
}

export function Calendario({ slug, dias, mes, elegido }: {
  slug: string; dias: Dia[]; mes: string; elegido?: string;
}) {
  const conHueco = new Map(dias.map((d) => [d.dia, d.huecos]));
  const meses = [...new Set(dias.map((d) => d.dia.slice(0, 7)))].sort();
  const i = meses.indexOf(mes);
  const anterior = i > 0 ? meses[i - 1] : null;
  const siguiente = i >= 0 && i < meses.length - 1 ? meses[i + 1] : null;
  const hoy = hoyYmd();
  const horas = elegido ? conHueco.get(elegido) : undefined;

  return (
    <>
      <div className="cal">
        <div className="cal-mes">
          {anterior
            ? <Link href={`/reservar?t=${slug}&m=${anterior}`} aria-label="Mes anterior">‹</Link>
            : <span aria-hidden>‹</span>}
          <strong>{nombreMes(mes)}</strong>
          {siguiente
            ? <Link href={`/reservar?t=${slug}&m=${siguiente}`} aria-label="Mes siguiente">›</Link>
            : <span aria-hidden>›</span>}
        </div>

        <div className="cal-rej" role="grid">
          {CABECERA.map((d, n) => <span className="cal-cab" key={n}>{d}</span>)}
          {celdas(mes).map((dia, n) => {
            if (!dia) return <span className="cal-dia vacio" key={n} />;
            const libres = conHueco.get(dia);
            const numero = Number(dia.slice(-2));
            if (!libres) {
              return (
                <span className={`cal-dia cerrado${dia === hoy ? " hoy" : ""}`} key={n}
                      aria-disabled title="Sin huecos">{numero}</span>
              );
            }
            return (
              <Link className={`cal-dia libre${dia === elegido ? " elegido" : ""}${dia === hoy ? " hoy" : ""}`}
                    key={n} href={`/reservar?t=${slug}&m=${mes}&d=${dia}`}
                    aria-current={dia === elegido ? "date" : undefined}>
                {numero}
              </Link>
            );
          })}
        </div>
      </div>

      {horas?.length ? (
        <section className="cal-horas">
          <h2>{diaLargo(new Date(`${elegido}T12:00:00Z`))}</h2>
          <div className="horas">
            {horas.map((x) => (
              <Link className="hueco" key={+x}
                    href={`/reservar?t=${slug}&h=${encodeURIComponent(x.toISOString())}`}>
                {hora(x)}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <p className="vacio">Elige un día para ver las horas libres.</p>
      )}
    </>
  );
}
