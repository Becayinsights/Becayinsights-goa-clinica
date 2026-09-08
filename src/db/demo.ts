/* Modo demostración: la aplicación entera, sin guardar nada.
 *
 * Cuando no hay DATABASE_URL, la base es una PGlite **en memoria**: se crea al
 * arrancar, se le aplican las mismas migraciones, se siembra con un día de
 * consulta inventado y desaparece con el proceso. No toca disco, no hay fichero
 * que borrar y no hay nada que se quede.
 *
 * Es la aplicación de verdad, no una maqueta: si aquí se puede pedir cita y
 * verla llegar al panel, es porque el código que lo hace es el mismo que correrá
 * con la base real. Una maqueta paralela acabaría enseñando cosas que la
 * aplicación no hace.
 *
 * Los pacientes son inventados. Nombre de pila e inicial, que es como se
 * apuntan en una agenda y como se ve que no son de nadie.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { BD } from "./index";
import * as e from "./esquema";
import { sembrarCatalogo, sembrarHorario, sembrarUsuario } from "./sembrar";
import { instante, ZONA } from "../lib/formato";

export const DEMO_EMAIL = "doctor@goa.demo";
export const DEMO_CLAVE = "demostracion";

export async function montarDemo(cliente: PGlite, db: BD) {
  const dir = join(process.cwd(), "drizzle");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const trozo of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) {
      if (trozo.trim()) await cliente.exec(trozo);
    }
  }

  await sembrarUsuario(db, DEMO_EMAIL, DEMO_CLAVE);
  await sembrarCatalogo(db);
  await sembrarHorario(db);

  const tratamientos = await db.select().from(e.tratamiento);
  const porSlug = (s: string) => tratamientos.find((t) => t.slug === s);

  /* Un día de consulta creíble, colocado alrededor de ahora para que la agenda
     no salga vacía sea cual sea el día en que se enseñe. */
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const a = (dias: number, h: number, m = 0) =>
    new Date(hoy.getTime() + dias * 86400_000 + h * 3600_000 + m * 60_000);

  const gente: Array<[string, string, string, "lead" | "paciente", string | null]> = [
    ["Ana R.",     "600 111 222", "instagram",     "paciente", "Ojeras marcadas desde hace un par de años."],
    ["Carlos M.",  "600 222 333", "web",           "paciente", "Entradas y pérdida de densidad en la coronilla."],
    ["Lucía P.",   "600 333 444", "recomendacion", "paciente", "Quiere valorar los labios sin que se note."],
    ["Javier S.",  "600 444 555", "web",           "lead",     "Pregunta por injerto capilar."],
    ["Marta L.",   "600 555 666", "web",           "lead",     "Rinomodelación; pide precio y si duele."],
    ["Diego F.",   "600 666 777", "consulta",      "paciente", "Bruxismo, viene derivado del dentista."],
  ];

  const ids: string[] = [];
  for (const [nombre, telefono, origen, estado, motivo] of gente) {
    const [p] = await db.insert(e.paciente)
      .values({ nombre, telefono, origen: origen as any, estado, motivo })
      .returning({ id: e.paciente.id });
    ids.push(p.id);
  }

  const citas = [
    { p: 0, t: "ojeras",                     cuando: a(0, 10, 30), estado: "confirmada" },
    { p: 1, t: "mesoterapia-capilar",        cuando: a(0, 11, 30), estado: "confirmada" },
    { p: 5, t: "neuromoduladores",           cuando: a(0, 16, 0),  estado: "confirmada" },
    { p: 2, t: "labios",                     cuando: a(1, 12, 0),  estado: "confirmada" },
    { p: 1, t: "mesoterapia-capilar",        cuando: a(-21, 11, 0), estado: "hecha" },
    { p: 0, t: "ojeras",                     cuando: a(-40, 10, 0), estado: "hecha" },
    /* Las dos que esperan confirmación: es lo primero que mira al abrir. */
    { p: 3, t: "primera-valoracion-capilar", cuando: a(2, 17, 0),  estado: "solicitada", web: true },
    { p: 4, t: "armonizacion-facial",        cuando: a(3, 10, 0),  estado: "solicitada", web: true },
  ];

  for (const c of citas) {
    const t = porSlug(c.t);
    await db.insert(e.cita).values({
      pacienteId: ids[c.p], tratamientoId: t?.id ?? null, inicio: c.cuando,
      duracionMin: t?.duracionMin ?? 45, estado: c.estado as any, pedidaEnWeb: !!c.web,
    });
  }

  /* Lo que ya se hizo, con producto y lote: es lo que convierte la ficha en una
     historia y no en una lista de citas. */
  const actos: Array<{ p: number; t: string; cuando: Date; datos: Record<string, string>; cobro: [number, string] }> = [
    { p: 1, t: "mesoterapia-capilar", cuando: a(-21, 11, 0),
      datos: { producto: "Complejo vitamínico capilar", lote: "MC-2291", zonas: "Coronilla y línea media", dosis: "3 ml" },
      cobro: [25000, "tarjeta"] },
    { p: 0, t: "ojeras", cuando: a(-40, 10, 0),
      datos: { producto: "Ácido hialurónico de baja reticulación", lote: "AH-7714", zonas: "Surco nasoyugal bilateral", dosis: "1 vial" },
      cobro: [39000, "bizum"] },
    { p: 5, t: "neuromoduladores", cuando: a(-62, 17, 0),
      datos: { producto: "Toxina botulínica tipo A", lote: "TX-4180", zonas: "Maseteros", dosis: "50 U" },
      cobro: [35000, "tarjeta"] },
  ];

  for (const x of actos) {
    const t = porSlug(x.t);
    const [acto] = await db.insert(e.acto).values({
      pacienteId: ids[x.p], tratamientoId: t?.id ?? null, fecha: x.cuando, ...x.datos,
    }).returning({ id: e.acto.id });
    await db.insert(e.cobro).values({
      pacienteId: ids[x.p], actoId: acto.id, fecha: x.cuando.toISOString().slice(0, 10),
      concepto: t?.nombre ?? "Tratamiento", importeCents: x.cobro[0], metodo: x.cobro[1] as any,
    });
  }

  /* Un cobro suelto: no todo el dinero cuelga de un tratamiento. */
  await db.insert(e.cobro).values({
    pacienteId: ids[1], fecha: a(-7, 12).toISOString().slice(0, 10),
    concepto: "Segunda sesión de mesoterapia", importeCents: 25000, metodo: "efectivo",
  });

  /* Y unos días cerrados, para que se vea que el calendario los respeta. */
  const ymd = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(x);
  await db.insert(e.bloqueo).values({
    inicio: instante(ymd(a(24, 12)), "00:00:00"),
    fin: instante(ymd(a(31, 12)), "23:59:59"),
    motivo: "Congreso y vacaciones",
  });

  await db.insert(e.nota).values([
    { pacienteId: ids[1], texto: "Patrón androgénico, escala III. Se empieza por tratamiento médico y mesoterapia; el injerto se valora a los seis meses, no antes." },
    { pacienteId: ids[1], texto: "Primera sesión de mesoterapia sin incidencias. Cita en tres semanas." },
    { pacienteId: ids[0], texto: "Surco nasoyugal marcado, sin bolsa grasa. Un vial, técnica retrógrada. Se avisa de posible edema 48 h." },
  ]);
}
