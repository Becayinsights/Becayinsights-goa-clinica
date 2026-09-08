import { MODO_DEMO } from "@/db";

/* Que no haya duda de qué se está mirando. Un panel de clínica que parece real
   y no lo es se presta a malentendidos: mejor decirlo en cada pantalla que
   fiarse de que quien lo enseñó lo aclaró. */
export function Aviso() {
  if (!MODO_DEMO) return null;
  return (
    <p className="demo">
      <strong>Demostración.</strong> Los pacientes son inventados y nada de lo
      que hagas aquí se guarda: la base vive en memoria y se borra sola.
    </p>
  );
}
