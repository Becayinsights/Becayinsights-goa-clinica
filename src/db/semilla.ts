/* Deja la base lista para usarse, una sola vez:
 *     DATABASE_URL=… ADMIN_EMAIL=… ADMIN_CLAVE=… npm run semilla
 *
 * Nunca pisa una contraseña ya puesta: si el usuario existe, se deja como está. */
import { bd } from "./index";
import { sembrarCatalogo, sembrarHorario, sembrarUsuario } from "./sembrar";

async function main() {
  const db = await bd();
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const clave = process.env.ADMIN_CLAVE ?? "";

  if (email && clave) {
    if (clave.length < 12) throw new Error("La contraseña del doctor debe tener 12 caracteres o más.");
    console.log(await sembrarUsuario(db, email, clave)
      ? `Usuario creado: ${email}` : `Usuario ya existente, no se toca: ${email}`);
  } else {
    console.log("Sin ADMIN_EMAIL/ADMIN_CLAVE: no se crea usuario.");
  }

  console.log(`Catálogo al día: ${await sembrarCatalogo(db)} tratamientos.`);
  if (await sembrarHorario(db)) console.log("Horario por defecto: L-V de 10 a 14 y de 16 a 20.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
