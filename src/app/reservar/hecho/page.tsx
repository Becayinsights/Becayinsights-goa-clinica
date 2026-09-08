import { Marca } from "../../marca";
import { Aviso } from "../../aviso";

export const metadata = { title: "Cita solicitada · GOA", robots: { index: false } };

export default function Hecho() {
  return (
    <main className="reserva">
      <header><Marca sub="Medical Aesthetics · Dr. Bengoa" /></header>
      <Aviso />
      <h1>Cita solicitada</h1>
      <p className="entrada">
        Queda apuntada. La consulta te llama para confirmarla; hasta entonces la
        hora no está reservada del todo. Si necesitas cambiarla, contesta a esa
        llamada o escribe a la consulta.
      </p>
    </main>
  );
}
