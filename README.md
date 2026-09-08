# GOA · Clínica

Panel de gestión de la consulta del Dr. Bengoa: agenda, pacientes, historia
clínica, consentimientos y cobros. Es el reverso de la web (`Goaweb`): la web
capta, esto gestiona.

**Estado: etapa 1 de 4.** Funciona el acceso, la ficha de paciente, la historia
y la agenda. Falta lo que está listado abajo.

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

## Lo que falta

**Etapa 2 — reservas online.** Página pública de reserva, huecos calculados
restando citas y bloqueos a las franjas de `horario`, y la solicitud entrando
como `cita` en estado `solicitada`. Freno por IP y teléfono obligatorio, o la
agenda se llena de citas falsas.

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
