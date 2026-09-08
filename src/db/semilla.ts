/* Deja la base lista para usarse:
 *     ADMIN_EMAIL=… ADMIN_CLAVE=… npm run semilla
 *
 * - Crea el usuario del doctor si no existe (y solo entonces: nunca pisa una
 *   contraseña ya puesta).
 * - Vuelca el catálogo de tratamientos desde content/tratamientos.json, que es
 *   una copia del que alimenta la web. El precio y el nombre se escriben en un
 *   sitio y llegan a los dos.
 * - Pone un horario de consulta por defecto, que luego se edita desde el panel.
 */
import { eq } from "drizzle-orm";
import { bd } from "./index";
import * as e from "./esquema";
import { cifrarClave } from "../lib/clave";
import catalogo from "../../content/tratamientos.json";

const AREAS: Record<string, "estetica" | "capilar" | "cirugia"> = {
  estetica: "estetica", capilar: "capilar", cirugia: "cirugia",
};

/* "Desde 4.500 €" → 450000. Lo que no se puede leer como número —"A valorar"—
   se queda sin importe, que es más honesto que inventarse un cero. */
function aCentimos(texto?: string): number | null {
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

async function main() {
  const db = await bd();

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const clave = process.env.ADMIN_CLAVE ?? "";
  if (email && clave) {
    const hay = await db.select().from(e.usuario).where(eq(e.usuario.email, email));
    if (hay.length) console.log("Usuario ya existente, no se toca:", email);
    else {
      if (clave.length < 12) throw new Error("La contraseña del doctor debe tener 12 caracteres o más.");
      await db.insert(e.usuario).values({
        email, clave: await cifrarClave(clave), nombre: "Dr. Manuel Bengoa", rol: "doctor",
      });
      console.log("Usuario creado:", email);
    }
  } else {
    console.log("Sin ADMIN_EMAIL/ADMIN_CLAVE: no se crea usuario.");
  }

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
  console.log(`Catálogo al día: ${n} tratamientos.`);

  const horarios = await db.select().from(e.horario);
  if (!horarios.length) {
    await db.insert(e.horario).values(
      [1, 2, 3, 4, 5].flatMap((d) => [
        { diaSemana: d, desde: "10:00:00", hasta: "14:00:00" },
        { diaSemana: d, desde: "16:00:00", hasta: "20:00:00" },
      ]),
    );
    console.log("Horario por defecto: L-V de 10 a 14 y de 16 a 20.");
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
