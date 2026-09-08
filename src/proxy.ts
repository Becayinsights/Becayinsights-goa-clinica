import { NextResponse, type NextRequest } from "next/server";

/* Segunda barrera, a propósito redundante.
 *
 * Cada página del panel llama a exigirUsuario(), que es la que de verdad
 * comprueba la sesión contra la base. Esto de aquí solo mira si hay cookie, y
 * existe para que el día que alguien añada una página y se olvide de esa
 * llamada, la página no quede abierta a internet. Una comprobación barata que
 * cubre un despiste caro.
 *
 * No sirve como autenticación: una cookie inventada pasa este filtro y muere en
 * la siguiente puerta. */
export default function proxy(pedido: NextRequest) {
  const ruta = pedido.nextUrl.pathname;
  const publica = ruta === "/entrar" || ruta.startsWith("/reservar");
  if (publica || pedido.cookies.has("goa_sesion")) return NextResponse.next();

  const destino = new URL("/entrar", pedido.url);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
