"use server";
import { redirect } from "next/navigation";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { sigueLibre } from "@/lib/huecos";

const Peticion = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre."),
  telefono: z.string().trim().min(9, "Hace falta un teléfono para confirmarte la cita."),
  email: z.union([z.string().trim().email("Ese correo no parece válido."), z.literal("")]).optional(),
  motivo: z.string().trim().max(1000).optional(),
  inicio: z.string().min(1),
  tratamientoId: z.string().uuid(),
  /* Campo señuelo: está escondido y una persona no lo rellena nunca. Si viene
     con algo, es un robot. Es el filtro más barato que existe y no molesta a
     nadie con un captcha. */
  web: z.string().max(0).optional(),
});

export async function pedirCita(_previo: string | null, datos: FormData): Promise<string | null> {
  const leido = Peticion.safeParse(Object.fromEntries(datos));
  if (!leido.success) return leido.error.issues[0].message;
  const d = leido.data;
  if (d.web) return null;                      /* al robot no se le explica nada */

  const db = await bd();
  const [t] = await db.select().from(e.tratamiento).where(eq(e.tratamiento.id, d.tratamientoId));
  if (!t || !t.reservableOnline) return "Ese tratamiento no se puede reservar por aquí.";

  const inicio = new Date(d.inicio);
  if (Number.isNaN(+inicio)) return "Esa hora no es válida.";
  if (!(await sigueLibre(inicio, t.duracionMin))) {
    return "Ese hueco se acaba de ocupar. Elige otro, por favor.";
  }

  /* Un teléfono, una solicitud pendiente. Sin esto, un dedo nervioso llena la
     agenda de la misma cita cuatro veces. */
  const telefono = d.telefono.replace(/\s+/g, "");
  const [ya] = await db.select({ id: e.cita.id })
    .from(e.cita).innerJoin(e.paciente, eq(e.paciente.id, e.cita.pacienteId))
    .where(and(eq(e.paciente.telefono, telefono), eq(e.cita.estado, "solicitada")));
  if (ya) return "Ya tienes una solicitud pendiente. Te llamamos para confirmarla.";

  /* Si el teléfono ya está fichado, se reutiliza la ficha: nadie quiere dos
     historias de la misma persona por haber escrito el nombre distinto. */
  const [conocido] = await db.select().from(e.paciente)
    .where(and(eq(e.paciente.telefono, telefono), gte(e.paciente.creadoEn, new Date(0))));

  let pacienteId = conocido?.id;
  if (!pacienteId) {
    const [p] = await db.insert(e.paciente).values({
      nombre: d.nombre, telefono, email: d.email || null,
      motivo: d.motivo || null, origen: "web", estado: "lead",
    }).returning({ id: e.paciente.id });
    pacienteId = p.id;
  }

  await db.insert(e.cita).values({
    pacienteId, tratamientoId: t.id, inicio, duracionMin: t.duracionMin,
    estado: "solicitada", pedidaEnWeb: true, motivo: d.motivo || null,
  });

  redirect("/reservar/hecho");
}
