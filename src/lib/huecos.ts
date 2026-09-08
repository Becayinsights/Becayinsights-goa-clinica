/* Los huecos libres no se guardan: se calculan.
 *
 * Restar a las franjas de consulta las citas y los bloqueos es una consulta
 * barata y siempre dice la verdad. Una tabla de huecos libres, en cambio, se
 * desincroniza en cuanto cambias un horario o mueves una cita, y entonces la
 * web ofrece huecos que ya no existen. */
import { and, gte, lt, ne } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { ZONA, instante } from "./formato";

const PASO = 30;                       // los huecos se ofrecen en punto y media
const MINIMO_HORAS = 12;               // nada para dentro de un rato: hay que verlo antes

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);

export type Dia = { dia: string; huecos: Date[] };

/* Dos meses por delante: lo que cabe en el calendario sin que la agenda se
   convierta en una promesa a demasiado plazo. */
export async function huecosLibres(duracionMin: number, dias = 62): Promise<Dia[]> {
  const db = await bd();
  const desde = new Date(Date.now() + MINIMO_HORAS * 3600_000);
  const hasta = new Date(Date.now() + dias * 86400_000);

  const [franjas, ocupadas, bloqueos] = await Promise.all([
    db.select().from(e.horario),
    db.select({ inicio: e.cita.inicio, duracion: e.cita.duracionMin }).from(e.cita)
      .where(and(gte(e.cita.inicio, desde), lt(e.cita.inicio, hasta), ne(e.cita.estado, "cancelada"))),
    db.select().from(e.bloqueo).where(and(lt(e.bloqueo.inicio, hasta), gte(e.bloqueo.fin, desde))),
  ]);

  const chocan = (a: Date, b: Date) =>
    ocupadas.some((c) => c.inicio < b && new Date(c.inicio.getTime() + c.duracion * 60_000) > a) ||
    bloqueos.some((x) => x.inicio < b && x.fin > a);

  const salida: Dia[] = [];
  for (let i = 0; i < dias; i++) {
    const dia = ymd(new Date(Date.now() + i * 86400_000));
    /* getUTCDay sobre el mediodía del día evita que la conversión de zona
       cambie de día y con ello de día de la semana. */
    const semana = ((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const huecos: Date[] = [];

    for (const f of franjas.filter((x) => x.activo && x.diaSemana === semana)) {
      const fin = instante(dia, f.hasta);
      for (let t = instante(dia, f.desde); ; t = new Date(t.getTime() + PASO * 60_000)) {
        const cierra = new Date(t.getTime() + duracionMin * 60_000);
        if (cierra > fin) break;
        if (t >= desde && !chocan(t, cierra)) huecos.push(t);
      }
    }
    if (huecos.length) salida.push({ dia, huecos: huecos.sort((a, b) => +a - +b) });
  }
  return salida;
}

/* Se vuelve a comprobar al confirmar: entre que alguien ve un hueco y lo pide
   pueden pasar minutos, y en esos minutos el hueco puede haberse ido. */
export async function sigueLibre(inicio: Date, duracionMin: number): Promise<boolean> {
  const db = await bd();
  const fin = new Date(inicio.getTime() + duracionMin * 60_000);
  const margen = new Date(inicio.getTime() - 8 * 3600_000);
  const [citas, bloqueos] = await Promise.all([
    db.select({ inicio: e.cita.inicio, duracion: e.cita.duracionMin }).from(e.cita)
      .where(and(gte(e.cita.inicio, margen), lt(e.cita.inicio, fin), ne(e.cita.estado, "cancelada"))),
    db.select().from(e.bloqueo).where(and(lt(e.bloqueo.inicio, fin), gte(e.bloqueo.fin, inicio))),
  ]);
  if (bloqueos.length) return false;
  return !citas.some((c) => c.inicio < fin && new Date(c.inicio.getTime() + c.duracion * 60_000) > inicio);
}
