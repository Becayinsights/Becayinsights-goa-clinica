import Link from "next/link";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { exigirUsuario } from "@/lib/sesion";
import { limitesDelDia } from "@/lib/formato";
import { Marca } from "../marca";
import { Aviso } from "../aviso";
import { salir } from "./acciones";

export default async function Panel({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const db = await bd();
  const { inicio, fin } = limitesDelDia();

  /* Los tres números que importan al abrir: qué hay hoy, qué falta por
     confirmar y quién ha escrito y todavía no tiene cita. */
  const [[hoy], [porConfirmar], [leads]] = await Promise.all([
    db.select({ n: count() }).from(e.cita)
      .where(and(gte(e.cita.inicio, inicio), lt(e.cita.inicio, fin), eq(e.cita.estado, "confirmada"))),
    db.select({ n: count() }).from(e.cita).where(eq(e.cita.estado, "solicitada")),
    db.select({ n: count() }).from(e.paciente).where(eq(e.paciente.estado, "lead")),
  ]);

  return (
    <div className="marco">
      <aside className="lado">
        <Link href="/" style={{ textDecoration: "none" }}><Marca sub="Clínica" /></Link>
        <nav className="menu">
          <Link href="/">Hoy {hoy.n > 0 && <span className="pill">{hoy.n}</span>}</Link>
          <Link href="/agenda">Agenda</Link>
          <Link href="/solicitudes">Solicitudes {porConfirmar.n > 0 && <span className="pill">{porConfirmar.n}</span>}</Link>
          <Link href="/pacientes">Pacientes</Link>
          <Link href="/pacientes?estado=lead">Leads {leads.n > 0 && <span className="pill">{leads.n}</span>}</Link>
          <Link href="/cobros">Cobros</Link>
          <Link href="/ajustes">Ajustes</Link>
        </nav>
        <footer>
          {u.nombre}<br />
          <span className="mono" style={{ fontSize: "var(--fs-1)" }}>{u.email}</span>
          <form action={salir}><button className="btn linea mini">Cerrar sesión</button></form>
        </footer>
      </aside>
      <main className="cuerpo"><Aviso />{children}</main>
    </div>
  );
}
