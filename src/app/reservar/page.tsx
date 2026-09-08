import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { huecosLibres } from "@/lib/huecos";
import { hora, diaLargo } from "@/lib/formato";
import { Marca } from "../marca";
import { Aviso } from "../aviso";
import { Peticion } from "./formulario";
import { Calendario } from "./calendario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedir cita · GOA", robots: { index: false } };

/* Tres pasos servidos por el servidor: elegir tratamiento, elegir día y hora en
   el calendario, y dejar el contacto. Todo con enlaces y sin componente de
   calendario: quien pide cita en una consulta lo hace una vez, y un enlace
   funciona con el botón de atrás y se puede mandar por WhatsApp tal cual. */
export default async function Reservar({ searchParams }: {
  searchParams: Promise<{ t?: string; h?: string; d?: string; m?: string }>;
}) {
  const { t: slug, h, d, m } = await searchParams;
  const db = await bd();
  const tratamientos = await db.select().from(e.tratamiento)
    .where(eq(e.tratamiento.reservableOnline, true)).orderBy(asc(e.tratamiento.orden));

  const elegido = slug ? tratamientos.find((x) => x.slug === slug) : undefined;

  return (
    <main className="reserva">
      <header>
        <Marca sub="Medical Aesthetics · Dr. Bengoa" />
      </header>
      <Aviso />

      {!elegido ? (
        <>
          <h1>Pedir cita</h1>
          <p className="entrada">
            Elige qué quieres valorar. Si no lo tienes claro, la primera
            valoración sirve para eso: verlo juntos y decidir después.
          </p>
          <div className="opciones">
            {tratamientos.map((x) => (
              <Link className="opcion" key={x.id} href={`/reservar?t=${x.slug}`}>
                <span>{x.nombre}</span>
                <span className="silencio">{x.duracionMin} min · {x.precioTexto ?? "a valorar"}</span>
              </Link>
            ))}
          </div>
        </>
      ) : !h ? (
        <Huecos tratamiento={elegido} dia={d} mes={m} />
      ) : (
        <>
          <h1>Tus datos</h1>
          <p className="entrada">Último paso: cómo localizarte para confirmarla.</p>
          <Peticion tratamientoId={elegido.id} inicio={h}
                    cuando={`${diaLargo(new Date(h))}, ${hora(new Date(h))} · ${elegido.nombre}`} />
          <p style={{ marginTop: 20 }}>
            <Link className="silencio" href={`/reservar?t=${elegido.slug}`}>← Elegir otra hora</Link>
          </p>
        </>
      )}
    </main>
  );
}

async function Huecos({ tratamiento, dia, mes }: {
  tratamiento: { id: string; slug: string; nombre: string; duracionMin: number };
  dia?: string; mes?: string;
}) {
  const dias = await huecosLibres(tratamiento.duracionMin);

  if (!dias.length) {
    return (
      <>
        <h1>{tratamiento.nombre}</h1>
        <p className="entrada">
          Ahora mismo no hay huecos publicados. Escribe a la consulta y se busca hueco.
        </p>
        <p><Link className="silencio" href="/reservar">← Elegir otro tratamiento</Link></p>
      </>
    );
  }

  /* Si todavía no se ha elegido nada, se abre por el primer día con hueco y con
     sus horas ya a la vista: un calendario que abre vacío obliga a adivinar
     dónde hay algo. Y al cambiar de mes no se arrastra el día del mes anterior. */
  const libres = new Set(dias.map((x) => x.dia));
  const elegido = dia && libres.has(dia) ? dia : dias[0].dia;
  const visible = mes && dias.some((x) => x.dia.startsWith(mes)) ? mes : elegido.slice(0, 7);
  const marcado = visible === elegido.slice(0, 7) ? elegido : undefined;

  return (
    <>
      <h1>{tratamiento.nombre}</h1>
      <p className="entrada">
        Elige el día y la hora que mejor te venga. La cita dura {tratamiento.duracionMin} minutos.
      </p>
      <Calendario slug={tratamiento.slug} dias={dias} mes={visible} elegido={marcado} />
      <p style={{ marginTop: 26 }}>
        <Link className="silencio" href="/reservar">← Elegir otro tratamiento</Link>
      </p>
    </>
  );
}
