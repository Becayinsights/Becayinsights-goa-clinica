import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { Formulario } from "./formulario";

export default async function Entrar() {
  if (await usuarioActual()) redirect("/");
  return <main className="puerta"><Formulario /></main>;
}
