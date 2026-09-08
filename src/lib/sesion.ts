/* Sesión y registro de accesos.
 *
 * La cookie lleva un testigo aleatorio de 32 bytes; en la base solo vive su
 * resumen. La sesión dura ocho horas y se renueva sola si se usa pasada la
 * mitad, para que una jornada de consulta no se corte por la mitad pero un
 * portátil olvidado no quede abierto indefinidamente.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, desc, count } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { bd, MODO_DEMO } from "@/db";
import * as e from "@/db/esquema";
import { DEMO_EMAIL } from "@/db/demo";
import { nuevoTestigo, resumen } from "./clave";

const COOKIE = "goa_sesion";
const HORAS = 8;

export type Usuario = { id: string; email: string; nombre: string; rol: "doctor" | "recepcion" };

/* ─────────── La sesión de la demostración ───────────
 *
 * En demostración la sesión no puede guardarse en la base, porque la base es de
 * memoria y cada instancia del servidor tiene la suya: la sesión abierta en una
 * no existe en la siguiente, y el panel devolvía a la puerta al primer clic.
 *
 * Aquí la sesión es una cookie firmada, que cualquier instancia puede comprobar
 * sin compartir nada. La clave de firma es constante y está escrita en el
 * código a propósito: no protege ningún dato —en demostración no hay ninguno— y
 * la contraseña ya va impresa en la pantalla de entrada. Con DATABASE_URL nada
 * de esto se usa: la sesión vuelve a la base, que es donde debe estar. */
const CLAVE_DEMO = "goa-demostracion-sin-datos";

const firmaDemo = (caduca: number) =>
  createHmac("sha256", CLAVE_DEMO).update(String(caduca)).digest("base64url");

function demoValido(testigo: string): boolean {
  const [txt, firma] = testigo.split(".");
  const caduca = Number(txt);
  if (!firma || !Number.isFinite(caduca) || caduca < Date.now()) return false;
  const a = Buffer.from(firma), b = Buffer.from(firmaDemo(caduca));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function crearSesion(usuarioId: string) {
  const expira = new Date(Date.now() + HORAS * 3600_000);
  const testigo = MODO_DEMO
    ? `${+expira}.${firmaDemo(+expira)}`
    : nuevoTestigo();

  if (!MODO_DEMO) {
    const db = await bd();
    const agente = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
    await db.insert(e.sesion).values({ id: resumen(testigo), usuarioId, expiraEn: expira, agente });
  }
  (await cookies()).set(COOKIE, testigo, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: expira,
  });
}

export async function usuarioActual(): Promise<Usuario | null> {
  const testigo = (await cookies()).get(COOKIE)?.value;
  if (!testigo) return null;
  const db = await bd();

  if (MODO_DEMO) {
    if (!demoValido(testigo)) return null;
    /* El usuario se busca por correo y no por identificador: cada instancia
       siembra el suyo y los identificadores no coinciden entre ellas. */
    const [u] = await db.select().from(e.usuario).where(eq(e.usuario.email, DEMO_EMAIL));
    return u && u.activo ? { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol } : null;
  }
  const filas = await db.select({
      id: e.usuario.id, email: e.usuario.email, nombre: e.usuario.nombre,
      rol: e.usuario.rol, activo: e.usuario.activo, expira: e.sesion.expiraEn, sid: e.sesion.id,
    })
    .from(e.sesion)
    .innerJoin(e.usuario, eq(e.usuario.id, e.sesion.usuarioId))
    .where(and(eq(e.sesion.id, resumen(testigo)), gt(e.sesion.expiraEn, new Date())));

  const f = filas[0];
  if (!f || !f.activo) return null;

  /* Renovación deslizante: solo si ya se ha consumido más de la mitad, para no
     escribir en la base en cada carga de página. */
  const restante = f.expira.getTime() - Date.now();
  if (restante < (HORAS * 3600_000) / 2) {
    const nueva = new Date(Date.now() + HORAS * 3600_000);
    await db.update(e.sesion).set({ expiraEn: nueva }).where(eq(e.sesion.id, f.sid));
  }
  return { id: f.id, email: f.email, nombre: f.nombre, rol: f.rol };
}

/* Toda página del panel empieza por aquí. Sin sesión no se devuelve nada, ni
   siquiera vacío: se manda a la puerta. */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect("/entrar");
  return u;
}

export async function cerrarSesion() {
  const galletas = await cookies();
  const testigo = galletas.get(COOKIE)?.value;
  if (testigo && !MODO_DEMO) {
    const db = await bd();
    await db.delete(e.sesion).where(eq(e.sesion.id, resumen(testigo)));
  }
  galletas.delete(COOKIE);
}

/* Deja rastro de quién tocó qué. En datos de salud no es telemetría: es la
   prueba de quién accedió a una historia y cuándo. */
export async function registrar(
  usuarioId: string | null, accion: string, entidad: string,
  entidadId?: string, detalle?: string,
) {
  const db = await bd();
  await db.insert(e.auditoria).values({ usuarioId, accion, entidad, entidadId, detalle });
}

/* Freno a la fuerza bruta: cinco fallos en quince minutos y ese correo descansa.
   Es la única puerta del sistema y está en internet. */
export async function demasiadosIntentos(email: string) {
  const db = await bd();
  const desde = new Date(Date.now() - 15 * 60_000);
  const [{ n }] = await db.select({ n: count() }).from(e.intento)
    .where(and(eq(e.intento.email, email), eq(e.intento.logrado, false), gt(e.intento.cuando, desde)));
  return n >= 5;
}

export async function anotarIntento(email: string, logrado: boolean) {
  const db = await bd();
  await db.insert(e.intento).values({ email, logrado });
  /* La tabla no crece para siempre. */
  await db.delete(e.intento).where(lt(e.intento.cuando, new Date(Date.now() - 7 * 86400_000)));
}

export async function ultimosAccesos(limite = 20) {
  const db = await bd();
  return db.select().from(e.auditoria).orderBy(desc(e.auditoria.cuando)).limit(limite);
}
