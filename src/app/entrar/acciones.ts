"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { comprobarClave } from "@/lib/clave";
import { crearSesion, registrar, demasiadosIntentos, anotarIntento } from "@/lib/sesion";

export async function entrar(_previo: string | null, datos: FormData): Promise<string | null> {
  const email = String(datos.get("email") ?? "").trim().toLowerCase();
  const clave = String(datos.get("clave") ?? "");
  if (!email || !clave) return "Faltan el correo o la contraseña.";

  if (await demasiadosIntentos(email)) {
    return "Demasiados intentos fallidos. Espera quince minutos.";
  }

  const db = await bd();
  const [u] = await db.select().from(e.usuario).where(eq(e.usuario.email, email));

  /* Se comprueba la contraseña aunque el usuario no exista, contra un hash de
     mentira: si no, el sistema tarda distinto según el correo exista o no y eso
     ya dice quién tiene cuenta. */
  const guardado = u?.clave ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "=";
  const vale = await comprobarClave(clave, guardado);

  if (!u || !u.activo || !vale) {
    await anotarIntento(email, false);
    return "Correo o contraseña incorrectos.";
  }

  await anotarIntento(email, true);
  await crearSesion(u.id);
  await registrar(u.id, "entrar", "usuario", u.id);
  redirect("/");
}
