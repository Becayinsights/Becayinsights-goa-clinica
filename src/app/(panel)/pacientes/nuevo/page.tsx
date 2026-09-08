import { exigirUsuario } from "@/lib/sesion";
import { Alta } from "./formulario";

export default async function Nuevo() {
  await exigirUsuario();
  return (
    <>
      <div className="cabeza">
        <div><p className="eyebrow">Pacientes</p><h1>Nueva ficha</h1></div>
      </div>
      <Alta />
    </>
  );
}
