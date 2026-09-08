"use client";
import { useActionState } from "react";
import { crearPaciente } from "../../acciones";

export function Alta() {
  const [error, accion, enviando] = useActionState(crearPaciente, null);
  return (
    <form action={accion} style={{ maxWidth: 620 }}>
      {error && <p className="error">{error}</p>}
      <div className="campos">
        <div className="campo"><label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" required autoFocus /></div>
        <div className="campo"><label htmlFor="apellidos">Apellidos</label>
          <input id="apellidos" name="apellidos" /></div>
        <div className="campo"><label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" inputMode="tel" /></div>
        <div className="campo"><label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" /></div>
        <div className="campo"><label htmlFor="fechaNacimiento">Fecha de nacimiento</label>
          <input id="fechaNacimiento" name="fechaNacimiento" type="date" /></div>
        <div className="campo"><label htmlFor="origen">Cómo llegó</label>
          <select id="origen" name="origen" defaultValue="consulta">
            <option value="consulta">En consulta</option>
            <option value="web">Web</option>
            <option value="instagram">Instagram</option>
            <option value="recomendacion">Recomendación</option>
            <option value="otro">Otro</option>
          </select></div>
      </div>
      <div className="campo"><label htmlFor="motivo">Qué pide</label>
        <textarea id="motivo" name="motivo" placeholder="Lo que cuenta, con sus palabras." /></div>
      <button className="btn" disabled={enviando}>{enviando ? "Guardando…" : "Crear ficha"}</button>
    </form>
  );
}
