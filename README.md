# GOA · Clínica

Panel de gestión de la consulta del Dr. Bengoa: agenda, pacientes, historia
clínica, consentimientos y cobros. Es el reverso de la web (`Goaweb`): la web
capta, esto gestiona.

**En pie ahora mismo, en modo demostración:**
[goa-citas-becay.vercel.app/reservar](https://goa-citas-becay.vercel.app/reservar)
· panel en `/entrar`, con la clave a la vista. Nada de lo que se haga ahí se
guarda: la base vive en memoria y se borra sola.

**Estado: etapas 1 y 2.** Funciona el acceso, la ficha de paciente, la historia,
la agenda y **la reserva pública**, que es lo que activa el botón «Reservar
cita» de la web. Falta lo que está listado abajo.

## Lo primero, y no es un formalismo

Aquí se guardan **datos de salud**, que el RGPD trata como categoría especial
(art. 9). El responsable del tratamiento es el doctor, no la agencia. Antes de
que esto vea un solo paciente real hacen falta, y no las resuelve el código:

- Contrato de encargado del tratamiento con quien aloje la base de datos y los
  ficheros, con los datos en la UE.
- Registro de actividades de tratamiento del doctor.
- Información y consentimiento a los pacientes sobre el tratamiento de sus datos.
- Plazos de conservación: la historia clínica tiene mínimos legales (Ley 41/2002
  y la norma autonómica que aplique).
- Copias de seguridad probadas —probadas quiere decir restauradas alguna vez— y
  un plan si el proveedor desaparece.

Lo que sí resuelve el código: contraseñas con scrypt, sesiones con el testigo
resumido, freno a la fuerza bruta, registro de accesos a cada historia, ficheros
servidos solo con sesión y cabeceras de seguridad.

## Cómo se levanta

```bash
npm install
npm run migrar                 # crea o actualiza el esquema
ADMIN_EMAIL=… ADMIN_CLAVE=… npm run semilla
npm run dev
```

Sin `DATABASE_URL` trabaja contra **PGlite** —Postgres compilado a WASM— en la
carpeta `.pgdata`. Es Postgres de verdad y las migraciones son las mismas, así
que lo que se prueba en local es lo que corre arriba. Con `DATABASE_URL`, contra
la base que sea: no usamos el cliente propio de ningún proveedor, y esa cadena
vale igual para Neon, Supabase, RDS o un servidor propio. Poder mudar los datos
sin reescribir la aplicación es parte de tratarlos con cuidado.

## Cómo está montado

| Sitio | Qué hay |
|---|---|
| `src/db/esquema.ts` | El modelo. Lead y paciente son la misma tabla; lo clínico cuelga del paciente y no de la cita. |
| `src/db/migrar.ts` | Aplica `drizzle/*.sql` y anota lo aplicado. |
| `src/db/semilla.ts` | Usuario inicial, catálogo desde `content/tratamientos.json` y horario por defecto. |
| `src/lib/clave.ts` | scrypt de la librería estándar. Sin dependencias nativas en la única puerta. |
| `src/lib/sesion.ts` | Sesión, renovación deslizante, auditoría y freno a los intentos. |
| `src/proxy.ts` | Barrera redundante: si falta la cookie, ni se llega a la página. |
| `src/app/(panel)/` | Hoy, agenda, solicitudes, pacientes y ficha. |

El catálogo de tratamientos se siembra desde una copia de
`content/tratamientos.json` de la web, para que el precio y el nombre se
escriban en un sitio y lleguen a los dos. Cuando el back esté en producción,
lo suyo es que la web lea de aquí y no al revés.

## Modo demostración

Sin `DATABASE_URL` la aplicación arranca contra una PGlite **en memoria**: se
crea al vuelo, recibe estas mismas migraciones, se siembra con un día de consulta
inventado y desaparece con el proceso. Sirve para enseñarla sin montar nada y sin
guardar un solo dato.

No es una maqueta aparte: es la aplicación, con su código. Por eso lo que se ve
en la demostración es exactamente lo que hará con la base real.

Dos límites que conviene saber al enseñarla:

- Cada instancia del servidor tiene su propia copia. Si Vercel levanta una
  segunda, puede enseñar un estado ligeramente distinto. Con el tráfico de una
  demostración casi nunca pasa.
- El primer acceso tras un rato dormida tarda algo más: está montando el esquema
  y sembrando.

## Puesta en marcha sin pagar nada

Todo lo de abajo tiene plan gratuito y ninguno pide tarjeta.

1. **Base de datos.** Crear un proyecto gratis en [Neon](https://neon.tech) —o
   Supabase, da igual— **en una región de la UE**, y copiar la cadena de
   conexión.
2. **Repositorio.** Este proyecto en un repositorio **privado**. El de la web es
   público y ahí no puede vivir un panel de historias clínicas.
3. **Vercel.** El proyecto ya existe: `goa-citas`, enganchado a este
   repositorio. Solo hay que añadirle dos variables: `DATABASE_URL` (la del paso
   1) y `SECRETO` (`openssl rand -hex 32`). En cuanto tenga `DATABASE_URL` deja
   de estar en demostración: el aviso desaparece solo y empieza a guardar.
   Conviene además mover la región de la función a Frankfurt, para que esté
   junto a la base y no al otro lado del Atlántico.
4. **Preparar la base**, una sola vez y desde el portátil:
   ```bash
   DATABASE_URL=… npm run migrar
   DATABASE_URL=… ADMIN_EMAIL=… ADMIN_CLAVE=… npm run semilla
   ```
   La contraseña tiene que tener doce caracteres o más; el script no acepta menos.
5. **La web apunta aquí.** En el repositorio de la web:
   `RESERVAS=https://<lo-que-sea>.vercel.app/reservar python3 build.py`

Dos cosas que conviene tener claras y no descubrir tarde:

- El plan **Hobby de Vercel no permite uso comercial** según sus propias
  condiciones. Técnicamente funciona; contractualmente, para una consulta que
  cobra, hace falta Pro. Es una decisión de negocio, no técnica.
- El plan gratuito de Neon **duerme la base tras un rato sin uso**. La primera
  visita después de dormir tarda un segundo de más. Para pedir cita no importa.

## Lo que falta

**Etapa 3 — consentimientos y fotos.** Subida a almacenamiento privado, servida
por una ruta que comprueba la sesión. Las tablas `documento` y `foto` ya están;
falta el almacén y las pantallas. Cada foto lleva aparte si el paciente autorizó
publicarla: guardarla y poder enseñarla son dos permisos distintos.

**Etapa 4 — cobros y cuadro de mando.** Tabla `cobro` puesta; faltan las
pantallas y los totales por paciente y periodo. Es registro de cobros, no
facturación fiscal: la factura se emite fuera mientras no se decida otra cosa.

**Pendiente y conviene no olvidarlo:** segundo factor en el acceso, exportación
completa de una historia (el paciente tiene derecho a pedirla) y borrado con
sus plazos.

## Aviso de dependencias

`npm audit` señala `esbuild` dentro de `drizzle-kit`. Es una herramienta de
desarrollo y el fallo afecta a su servidor local; no viaja a producción.
