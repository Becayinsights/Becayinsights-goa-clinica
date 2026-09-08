import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { bd } from "@/db";
import * as e from "@/db/esquema";
import { huecosLibres } from "@/lib/huecos";
import { hora, diaLargo } from "@/lib/formato";
import { Marca } from "../marca";
import { Aviso } from "../aviso";
import { Peticion } from "./formulario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedir cita · GOA", robots: { index: false } };

/* Tres pasos en tres pantallas servidas por el servidor: elegir tratamiento,
   elegir hueco y dejar el contacto. Sin calendario interactivo ni JavaScript de
   más: quien pide cita para una consulta médica lo hace una vez, no necesita
   una aplicación. */
export default async function Reservar({ searchParams }: {
  searchParams: Promise<{ t?: string; h?: string }>;
}) {
  const { t: slug, h } = await searchParams;
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
        <Huecos tratamiento={elegido} />
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

async function Huecos({ tratamiento }: { tratamiento: { id: string; slug: string; nombre: string; duracionMin: number } }) {
  const dias = await huecosLibres(tratamiento.duracionMin);
  return (
    <>
      <h1>{tratamiento.nombre}</h1>
      <p className="entrada">
        {dias.length
          ? `Elige el día y la hora que mejor te venga. La cita dura ${tratamiento.duracionMin} minutos.`
          : "Ahora mismo no hay huecos publicados. Escribe a la consulta y se busca hueco."}
      </p>
      {dias.map((d) => (
        <section key={d.dia} className="dia">
          <h2>{diaLargo(new Date(`${d.dia}T12:00:00Z`))}</h2>
          <div className="horas">
            {d.huecos.map((x) => (
              <Link className="hueco" key={+x}
                    href={`/reservar?t=${tratamiento.slug}&h=${encodeURIComponent(x.toISOString())}`}>
                {hora(x)}
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p style={{ marginTop: 24 }}><Link className="silencio" href="/reservar">← Elegir otro tratamiento</Link></p>
    </>
  );
}
