/* Todo se guarda en UTC y se enseña en la hora de la consulta. Si algún día hay
   una segunda sede, se cambia aquí y no en cuarenta sitios. */
export const ZONA = "Europe/Madrid";

const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, ...o });

export const hora = (d: Date) => f({ hour: "2-digit", minute: "2-digit" }).format(d);
export const dia = (d: Date) => f({ day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
/* "martes, 8 de septiembre" con la inicial en mayúscula. Con capitalize de CSS
   saldría "8 De Septiembre": el navegador no sabe qué palabras son nombres. */
export const diaLargo = (d: Date) => {
  const t = f({ weekday: "long", day: "numeric", month: "long" }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const diaHora = (d: Date) => `${dia(d)} · ${hora(d)}`;

export function euros(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR",
    minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export function edad(nacimiento: string | null) {
  if (!nacimiento) return null;
  const n = new Date(nacimiento), h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  return a;
}

/* Un instante a partir de un día y una hora de pared en la zona de la consulta.
   Sin esto, "el 5 de octubre a las 00:00" se interpreta con la hora del
   servidor —UTC arriba— y el día empieza y acaba desplazado. */
export function instante(dia: string, hhmm: string): Date {
  return new Date(`${dia}T${hhmm}${desfase(new Date(`${dia}T12:00:00Z`))}`);
}

/* El día natural en la zona de la consulta, devuelto en instantes UTC: si se
   calcula con la hora del servidor, en verano el día empieza dos horas tarde. */
export function limitesDelDia(base = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(base);
  const inicio = new Date(`${ymd}T00:00:00${desfase(base)}`);
  const fin = new Date(inicio.getTime() + 86400_000);
  return { inicio, fin, ymd };
}

function desfase(d: Date) {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, timeZoneName: "longOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")!.value;   // "GMT+02:00"
  return s.replace("GMT", "") || "+00:00";
}
