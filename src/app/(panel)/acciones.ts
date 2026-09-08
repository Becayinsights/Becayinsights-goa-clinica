"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario, cerrarSesion, registrar } from "@/lib/sesion";
import { instante } from "@/lib/formato";

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

/* ─────────── Lo que se hizo y lo que se cobró ─────────── */

/* El acto es lo que de verdad ocurrió, que no siempre es lo que se citó. Y va
   con producto y lote porque en inyectables hay que poder saber qué se puso a
   quién si un lote se retira. */
export async function apuntarActo(pacienteId: string, datos: FormData) {
  const u = await exigirUsuario();
  const db = await bd();
  const tratamientoId = vacio(String(datos.get("tratamientoId") ?? ""));
  const fecha = String(datos.get("fecha") ?? "");

  const [a] = await db.insert(e.acto).values({
    pacienteId, tratamientoId,
    fecha: fecha ? new Date(fecha) : new Date(),
    producto: vacio(String(datos.get("producto") ?? "").trim()),
    lote: vacio(String(datos.get("lote") ?? "").trim()),
    zonas: vacio(String(datos.get("zonas") ?? "").trim()),
    dosis: vacio(String(datos.get("dosis") ?? "").trim()),
    notas: vacio(String(datos.get("notas") ?? "").trim()),
  }).returning({ id: e.acto.id });

  /* Si se cobró en el momento, el cobro nace pegado al acto: así el dinero
     siempre sabe a qué tratamiento corresponde y no hay que casarlos después. */
  const importe = euros(String(datos.get("importe") ?? ""));
  if (importe != null) {
    const [t] = tratamientoId
      ? await db.select().from(e.tratamiento).where(eq(e.tratamiento.id, tratamientoId))
      : [undefined];
    await db.insert(e.cobro).values({
      pacienteId, actoId: a.id,
      fecha: (fecha || new Date().toISOString()).slice(0, 10),
      concepto: t?.nombre ?? "Tratamiento",
      importeCents: importe,
      metodo: String(datos.get("metodo") ?? "tarjeta") as any,
    });
  }
  await registrar(u.id, "crear", "acto", a.id, `paciente ${pacienteId}`);
  revalidatePath(`/pacientes/${pacienteId}`); revalidatePath("/cobros");
}

export async function apuntarCobro(pacienteId: string, datos: FormData) {
  const u = await exigirUsuario();
  const importe = euros(String(datos.get("importe") ?? ""));
  if (importe == null) return;
  const db = await bd();
  const [c] = await db.insert(e.cobro).values({
    pacienteId,
    fecha: String(datos.get("fecha") ?? "") || new Date().toISOString().slice(0, 10),
    concepto: String(datos.get("concepto") ?? "").trim() || "Sin concepto",
    importeCents: importe,
    metodo: String(datos.get("metodo") ?? "tarjeta") as any,
  }).returning({ id: e.cobro.id });
  await registrar(u.id, "crear", "cobro", c.id, `paciente ${pacienteId}`);
  revalidatePath(`/pacientes/${pacienteId}`); revalidatePath("/cobros");
}

/* "1.250,50" y "1250.5" son lo mismo escrito por dos personas distintas. Se
   admiten las dos, y lo que no sea un número se rechaza en vez de guardar un
   cero que nadie escribió. */
function euros(texto: string): number | null {
  const limpio = texto.trim().replace(/[€\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/* ─────────── La agenda de la que salen los huecos ─────────── */

export async function guardarHorario(datos: FormData) {
  const u = await exigirUsuario();
  const db = await bd();
  /* Se reescribe entero en vez de ir fila a fila: son diez franjas y así no
     queda nada suelto de una edición anterior. */
  await db.delete(e.horario);
  const filas = [];
  for (let d = 1; d <= 7; d++) {
    for (const turno of ["m", "t"]) {
      const desde = String(datos.get(`${d}-${turno}-desde`) ?? "");
      const hasta = String(datos.get(`${d}-${turno}-hasta`) ?? "");
      if (desde && hasta && desde < hasta) {
        filas.push({ diaSemana: d, desde: `${desde}:00`, hasta: `${hasta}:00` });
      }
    }
  }
  if (filas.length) await db.insert(e.horario).values(filas);
  await registrar(u.id, "editar", "horario", undefined, `${filas.length} franjas`);
  revalidatePath("/ajustes"); revalidatePath("/agenda");
}

export async function bloquear(datos: FormData) {
  const u = await exigirUsuario();
  const inicio = String(datos.get("inicio") ?? ""), fin = String(datos.get("fin") ?? "");
  if (!inicio || !fin) return;
  const db = await bd();
  /* Un bloqueo por días se guarda de la mañana del primero a la noche del
     último: quien se va de vacaciones piensa en días, no en horas. Y las horas
     son las de la consulta, no las del servidor: en Vercel el servidor va en
     UTC, y sin esto un cierre del 5 de octubre empezaría a las dos de la
     madrugada del 5 y se comería la primera hora del 6. */
  const [b] = await db.insert(e.bloqueo).values({
    inicio: instante(inicio, "00:00:00"),
    fin: instante(fin, "23:59:59"),
    motivo: vacio(String(datos.get("motivo") ?? "").trim()),
  }).returning({ id: e.bloqueo.id });
  await registrar(u.id, "crear", "bloqueo", b.id);
  revalidatePath("/ajustes"); revalidatePath("/agenda");
}

export async function quitarBloqueo(id: string) {
  const u = await exigirUsuario();
  const db = await bd();
  await db.delete(e.bloqueo).where(eq(e.bloqueo.id, id));
  await registrar(u.id, "borrar", "bloqueo", id);
  revalidatePath("/ajustes"); revalidatePath("/agenda");
}
