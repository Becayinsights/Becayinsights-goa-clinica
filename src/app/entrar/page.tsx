import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { MODO_DEMO } from "@/db";
import { DEMO_EMAIL, DEMO_CLAVE } from "@/db/demo";
import { Formulario } from "./formulario";

export default async function Entrar() {
  if (await usuarioActual()) redirect("/");
  /* En demostración la llave va a la vista: esconderla no protegería nada
     —dentro no hay un solo dato real— y sin ella no se puede enseñar. */
  const demo = MODO_DEMO ? { email: DEMO_EMAIL, clave: DEMO_CLAVE } : null;
  return <main className="puerta"><Formulario demo={demo} /></main>;
}
