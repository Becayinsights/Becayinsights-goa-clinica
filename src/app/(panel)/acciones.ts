"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario, cerrarSesion, registrar } from "@/lib/sesion";

export async function salir() {
  const u = await exigirUsuario();
  await registrar(u.id, "salir", "usuario", u.id);
  await cerrarSesion();
  redirect("/entrar");
}

const Paciente = z.object({
  nombre: z.string().trim().min(1, "El nombre no puede quedar vacío."),
  apellidos: z.string().trim().optional(),
  email: z.union([z.string().trim().email("Ese correo no es válido."), z.literal("")]).optional(),
  telefono: z.string().trim().optional(),
  fechaNacimiento: z.string().trim().optional(),
  motivo: z.string().trim().optional(),
  origen: z.enum(["web", "instagram", "recomendacion", "consulta", "otro"]).default("consulta"),
});

const vacio = (s?: string) => (s && s.length ? s : null);

export async function crearPaciente(_previo: string | null, datos: FormData): Promise<string | null> {
  const u = await exigirUsuario();
  const leido = Paciente.safeParse(Object.fromEntries(datos));
  if (!leido.success) return leido.error.issues[0].message;
  const d = leido.data;

  const db = await bd();
  const [p] = await db.insert(e.paciente).values({
    nombre: d.nombre, apellidos: vacio(d.apellidos), email: vacio(d.email),
    telefono: vacio(d.telefono), fechaNacimiento: vacio(d.fechaNacimiento),
    motivo: vacio(d.motivo), origen: d.origen, estado: "lead",
  }).returning({ id: e.paciente.id });

  await registrar(u.id, "crear", "paciente", p.id);
  redirect(`/pacientes/${p.id}`);
}

export async function guardarPaciente(id: string, datos: FormData) {
  const u = await exigirUsuario();
  const db = await bd();
  await db.update(e.paciente).set({
    nombre: String(datos.get("nombre") ?? "").trim(),
    apellidos: vacio(String(datos.get("apellidos") ?? "").trim()),
    email: vacio(String(datos.get("email") ?? "").trim()),
    telefono: vacio(String(datos.get("telefono") ?? "").trim()),
    fechaNacimiento: vacio(String(datos.get("fechaNacimiento") ?? "").trim()),
    alergias: vacio(String(datos.get("alergias") ?? "").trim()),
    antecedentes: vacio(String(datos.get("antecedentes") ?? "").trim()),
    notas: vacio(String(datos.get("notas") ?? "").trim()),
    estado: String(datos.get("estado") ?? "lead") as "lead" | "paciente" | "inactivo",
    actualizadoEn: new Date(),
  }).where(eq(e.paciente.id, id));
  await registrar(u.id, "editar", "paciente", id);
  revalidatePath(`/pacientes/${id}`);
}

export async function anotar(pacienteId: string, datos: FormData) {
  const u = await exigirUsuario();
  const texto = String(datos.get("texto") ?? "").trim();
  if (!texto) return;
  const db = await bd();
  const [n] = await db.insert(e.nota)
    .values({ pacienteId, autorId: u.id, texto }).returning({ id: e.nota.id });
  await registrar(u.id, "crear", "nota", n.id, `paciente ${pacienteId}`);
  revalidatePath(`/pacientes/${pacienteId}`);
}

export async function citar(pacienteId: string, datos: FormData) {
  const u = await exigirUsuario();
  const cuando = String(datos.get("inicio") ?? "");
  if (!cuando) return;
  const db = await bd();
  const tratamientoId = vacio(String(datos.get("tratamientoId") ?? ""));
  let duracion = 45;
  if (tratamientoId) {
    const [t] = await db.select({ d: e.tratamiento.duracionMin })
      .from(e.tratamiento).where(eq(e.tratamiento.id, tratamientoId));
    if (t) duracion = t.d;
  }
  const [c] = await db.insert(e.cita).values({
    pacienteId, tratamientoId, inicio: new Date(cuando), duracionMin: duracion,
    estado: "confirmada", motivo: vacio(String(datos.get("motivo") ?? "").trim()),
  }).returning({ id: e.cita.id });
  /* Citar a alguien es lo que lo convierte en paciente. */
  await db.update(e.paciente).set({ estado: "paciente", actualizadoEn: new Date() })
    .where(eq(e.paciente.id, pacienteId));
  await registrar(u.id, "crear", "cita", c.id, `paciente ${pacienteId}`);
  revalidatePath("/"); revalidatePath(`/pacientes/${pacienteId}`);
}

export async function cambiarCita(citaId: string, estado: string) {
  const u = await exigirUsuario();
  const db = await bd();
  await db.update(e.cita).set({ estado: estado as any }).where(eq(e.cita.id, citaId));
  await registrar(u.id, "editar", "cita", citaId, `estado ${estado}`);
  revalidatePath("/");
}
