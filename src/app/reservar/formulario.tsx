"use client";
import { useActionState, useState } from "react";
import { pedirCita } from "./acciones";

export function Peticion({ tratamientoId, inicio, cuando }: { tratamientoId: string; inicio: string; cuando: string }) {
  const [error, accion, enviando] = useActionState(pedirCita, null);
  const [datos, setDatos] = useState({ nombre: "", telefono: "", email: "", motivo: "" });
  const cambia = (k: string) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDatos((d) => ({ ...d, [k]: ev.target.value }));

  return (
    <form action={accion} className="tarjeta">
      <input type="hidden" name="tratamientoId" value={tratamientoId} />
      <input type="hidden" name="inicio" value={inicio} />
      <p className="eyebrow" style={{ marginBottom: 4 }}>Hora elegida</p>
      <p style={{ fontFamily: "var(--serif)", fontSize: 24, marginBottom: 18 }}>{cuando}</p>
      {error && <p className="error">{error}</p>}
      <div className="campos">
        <div className="campo"><label htmlFor="r-nombre">Nombre y apellidos</label>
          <input id="r-nombre" name="nombre" required autoFocus value={datos.nombre} onChange={cambia("nombre")} /></div>
        <div className="campo"><label htmlFor="r-tel">Teléfono</label>
          <input id="r-tel" name="telefono" inputMode="tel" required value={datos.telefono} onChange={cambia("telefono")} /></div>
      </div>
      <div className="campo"><label htmlFor="r-email">Correo (opcional)</label>
        <input id="r-email" name="email" type="email" value={datos.email} onChange={cambia("email")} /></div>
      <div className="campo"><label htmlFor="r-motivo">Qué te gustaría valorar</label>
        <textarea id="r-motivo" name="motivo" value={datos.motivo} onChange={cambia("motivo")}
          placeholder="Cuéntalo con tus palabras. No hace falta que uses términos médicos." /></div>
      <div aria-hidden style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="r-web">No rellenes esto</label>
        <input id="r-web" name="web" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn" disabled={enviando}>{enviando ? "Enviando…" : "Pedir esta cita"}</button>
      <p className="silencio" style={{ fontSize: "var(--fs-2)", marginTop: 14, lineHeight: 1.6 }}>
        La cita queda solicitada, no confirmada: la consulta te llama para
        confirmarla. Tus datos se usan solo para gestionar la cita.
      </p>
    </form>
  );
}
