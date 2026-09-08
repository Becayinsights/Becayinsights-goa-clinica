/* La siembra, en un solo sitio.
 *
 * La usan dos: el script de instalación contra la base de verdad, y la
 * demostración contra la base en memoria. Si fueran dos códigos distintos, la
 * demo acabaría enseñando algo que la aplicación real no hace. */
import { eq } from "drizzle-orm";
import type { BD } from "./index";
import * as e from "./esquema";
import { cifrarClave } from "../lib/clave";
import catalogo from "../../content/tratamientos.json";

const AREAS: Record<string, "estetica" | "capilar" | "cirugia"> = {
  estetica: "estetica", capilar: "capilar", cirugia: "cirugia",
};

/* "Desde 4.500 €" → 450000. Lo que no se puede leer como número —"A valorar"—
   se queda sin importe, que es más honesto que inventarse un cero. */
export function aCentimos(texto?: string): number | null {
  if (!texto) return null;
  const m = texto.replace(/\./g, "").match(/(\d+)(?:,(\d{1,2}))?\s*€/);
  if (!m) return null;
  return +m[1] * 100 + (m[2] ? +m[2].padEnd(2, "0") : 0);
}

/* Cuánto ocupa en agenda. La web no lo dice porque al paciente no le sirve,
   pero la agenda no puede funcionar sin ello. */
function duracion(slug: string, area: string): number {
  if (area === "cirugia") return 480;                       // jornada de quirófano
  if (slug.includes("valoracion")) return 30;
  if (slug.includes("armonizacion")) return 90;
  return 45;
}

export async function sembrarCatalogo(db: BD): Promise<number> {
  let orden = 0, n = 0;
  for (const area of (catalogo as any).areas) {
    for (const t of area.tratamientos) {
      const valores = {
        slug: t.slug as string,
        nombre: t.nombre as string,
        area: AREAS[area.id],
        precioTexto: (t.precio_corto ?? t.precio ?? null) as string | null,
        precioCents: aCentimos(t.precio),
        duracionMin: duracion(t.slug, area.id),
        /* Online solo lo que es una primera visita. Un injerto no se reserva
           desde una web: se decide en consulta. */
        reservableOnline: area.id !== "cirugia",
        orden: orden++,
      };
      await db.insert(e.tratamiento).values(valores)
        .onConflictDoUpdate({ target: e.tratamiento.slug, set: valores });
      n++;
    }
  }
  return n;
}

export async function sembrarHorario(db: BD): Promise<boolean> {
  if ((await db.select().from(e.horario)).length) return false;
  await db.insert(e.horario).values(
    [1, 2, 3, 4, 5].flatMap((d) => [
      { diaSemana: d, desde: "10:00:00", hasta: "14:00:00" },
      { diaSemana: d, desde: "16:00:00", hasta: "20:00:00" },
    ]),
  );
  return true;
}

export async function sembrarUsuario(db: BD, email: string, clave: string, nombre = "Dr. Manuel Bengoa") {
  if ((await db.select().from(e.usuario).where(eq(e.usuario.email, email))).length) return false;
  await db.insert(e.usuario).values({ email, clave: await cifrarClave(clave), nombre, rol: "doctor" });
  return true;
}
