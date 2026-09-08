"use client";
import { useActionState, useState } from "react";
import { entrar } from "./acciones";
import { Marca } from "../marca";

export function Formulario() {
  const [error, accion, enviando] = useActionState(entrar, null);
  /* React vacía los campos no controlados cuando termina la acción del
     formulario. Para la contraseña está bien; para el correo no, porque obliga
     a reescribirlo en cada intento fallido. */
  const [email, setEmail] = useState("");

  return (
    <form action={accion}>
      <Marca sub="Clínica" />
      {error && <p className="error">{error}</p>}
      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus
               value={email} onChange={(ev) => setEmail(ev.target.value)} />
      </div>
      <div className="campo">
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={enviando}>
        {enviando ? "Entrando\u2026" : "Entrar"}
      </button>
      <p className="silencio" style={{ fontSize: "var(--fs-2)", marginTop: 18, lineHeight: 1.6 }}>
        Este panel contiene historias cl\u00ednicas. No lo abras en un equipo
        compartido y cierra sesi\u00f3n al terminar.
      </p>
    </form>
  );
}
