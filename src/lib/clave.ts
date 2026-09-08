/* Contraseñas y testigos de sesión.
 *
 * scrypt de la librería estándar de Node: sin dependencias nativas que compilar
 * ni binarios de terceros en la única puerta del sistema. Los parámetros son los
 * que recomienda OWASP para scrypt (N=2^15, r=8, p=1), y se guardan dentro del
 * propio hash para poder subirlos más adelante sin invalidar lo ya guardado. */
import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

const N = 32768, R = 8, P = 1, LARGO = 64, MAXMEM = 96 * 1024 * 1024;

function derivar(clave: string, sal: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((ok, mal) =>
    scrypt(clave.normalize("NFKC"), sal, LARGO, { N: n, r, p, maxmem: MAXMEM },
      (e, dk) => (e ? mal(e) : ok(dk))));
}

export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const dk = await derivar(clave, sal);
  return ["scrypt", N, R, P, sal.toString("base64"), dk.toString("base64")].join("$");
}

export async function comprobarClave(clave: string, guardado: string): Promise<boolean> {
  const [tipo, n, r, p, sal64, dk64] = guardado.split("$");
  if (tipo !== "scrypt") return false;
  const dk = Buffer.from(dk64, "base64");
  const calc = await derivar(clave, Buffer.from(sal64, "base64"), +n, +r, +p);
  /* Comparar en tiempo constante: una comparación normal filtra por cuánto
     tarda en fallar cuántos bytes iniciales eran correctos. */
  return dk.length === calc.length && timingSafeEqual(dk, calc);
}

/* El testigo viaja en la cookie; en la base solo se guarda su resumen, así que
   quien lea la tabla de sesiones no se lleva credenciales que funcionen. */
export function nuevoTestigo(): string {
  return randomBytes(32).toString("base64url");
}

export function resumen(testigo: string): string {
  return createHash("sha256").update(testigo).digest("hex");
}
