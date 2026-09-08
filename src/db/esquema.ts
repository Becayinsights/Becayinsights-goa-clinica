/* El modelo de datos de la clínica.
 *
 * Dos decisiones que conviene entender antes de leer:
 *
 * 1. Lead y paciente son la misma tabla. Cuando alguien pide valoración entra
 *    como `lead`; cuando viene a consulta, cambia de estado. Separarlos en dos
 *    tablas obligaría a copiar la persona al convertirla y a arrastrar dos
 *    identificadores para siempre.
 *
 * 2. Todo lo clínico cuelga del paciente y no de la cita. Una cita puede
 *    anularse, moverse o duplicarse; la historia no. La cita es el sitio donde
 *    se hizo algo, no su dueña.
 */
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean,
  date, index, uniqueIndex, time,
} from "drizzle-orm/pg-core";

/* ─────────────────────────── Acceso ─────────────────────────── */

export const rol = pgEnum("rol", ["doctor", "recepcion"]);

export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  /* scrypt: sal y derivada juntas, en un solo campo. Ver src/lib/clave.ts */
  clave: text("clave").notNull(),
  nombre: text("nombre").notNull(),
  rol: rol("rol").notNull().default("doctor"),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

/* La sesión se guarda con el testigo ya resumido: si alguien lee la tabla, no
   se lleva credenciales válidas, igual que con las contraseñas. */
export const sesion = pgTable("sesion", {
  id: text("id").primaryKey(),                       // sha256 del testigo
  usuarioId: uuid("usuario_id").notNull().references(() => usuario.id, { onDelete: "cascade" }),
  expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  agente: text("agente"),
}, (t) => [index("sesion_usuario").on(t.usuarioId)]);

/* Quién vio qué. Con datos de salud esto no es telemetría: es la prueba de
   quién accedió a una historia y cuándo, y hay que poder enseñarla. */
export const auditoria = pgTable("auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").references(() => usuario.id, { onDelete: "set null" }),
  accion: text("accion").notNull(),                  // ver | crear | editar | borrar | entrar | salir
  entidad: text("entidad").notNull(),                // paciente | cita | nota | documento | foto | cobro
  entidadId: uuid("entidad_id"),
  detalle: text("detalle"),
  cuando: timestamp("cuando", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("auditoria_entidad").on(t.entidad, t.entidadId), index("auditoria_cuando").on(t.cuando)]);

/* ─────────────────────────── Personas ─────────────────────────── */

export const estadoPaciente = pgEnum("estado_paciente", ["lead", "paciente", "inactivo"]);
export const origen = pgEnum("origen", ["web", "instagram", "recomendacion", "consulta", "otro"]);

export const paciente = pgTable("paciente", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  apellidos: text("apellidos"),
  email: text("email"),
  telefono: text("telefono"),
  fechaNacimiento: date("fecha_nacimiento"),
  documento: text("documento"),                      // DNI/NIE, solo si hace falta facturar
  estado: estadoPaciente("estado").notNull().default("lead"),
  origen: origen("origen").notNull().default("web"),
  /* Lo que contó al pedir cita, tal cual lo escribió. */
  motivo: text("motivo"),
  notas: text("notas"),
  /* Alergias y antecedentes se piden en la primera consulta y condicionan
     cualquier indicación, así que viven arriba y no enterrados en una nota. */
  alergias: text("alergias"),
  antecedentes: text("antecedentes"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("paciente_estado").on(t.estado),
  index("paciente_creado").on(t.creadoEn),
  index("paciente_telefono").on(t.telefono),
]);

/* ─────────────────────────── Catálogo ─────────────────────────── */

export const area = pgEnum("area", ["estetica", "capilar", "cirugia"]);

/* El catálogo se siembra desde content/tratamientos.json de la web: el precio
   y el nombre viven en un solo sitio y no hay dos verdades que se contradigan.
   Lo que añade la clínica es lo que la web no necesita saber: cuánto dura la
   cita y si se puede reservar online. */
export const tratamiento = pgTable("tratamiento", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  area: area("area").notNull(),
  precioTexto: text("precio_texto"),                 // "Desde 4.500 €"
  precioCents: integer("precio_cents"),              // para los cobros
  duracionMin: integer("duracion_min").notNull().default(30),
  reservableOnline: boolean("reservable_online").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
  orden: integer("orden").notNull().default(0),
});

/* ─────────────────────────── Agenda ─────────────────────────── */

export const estadoCita = pgEnum("estado_cita", [
  "solicitada",   // la pidió el paciente desde la web y falta confirmarla
  "confirmada",
  "hecha",
  "no_asistio",
  "cancelada",
]);

/* Las franjas en las que se pasa consulta. La agenda pública sale de restar a
   estas franjas las citas y los bloqueos: no hay una tabla de huecos libres,
   porque una tabla de huecos se desincroniza en cuanto cambias un horario. */
export const horario = pgTable("horario", {
  id: uuid("id").primaryKey().defaultRandom(),
  diaSemana: integer("dia_semana").notNull(),        // 1 lunes … 7 domingo (ISO)
  desde: time("desde").notNull(),
  hasta: time("hasta").notNull(),
  activo: boolean("activo").notNull().default(true),
});

export const bloqueo = pgTable("bloqueo", {
  id: uuid("id").primaryKey().defaultRandom(),
  inicio: timestamp("inicio", { withTimezone: true }).notNull(),
  fin: timestamp("fin", { withTimezone: true }).notNull(),
  motivo: text("motivo"),
}, (t) => [index("bloqueo_inicio").on(t.inicio)]);

export const cita = pgTable("cita", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id").notNull().references(() => paciente.id, { onDelete: "cascade" }),
  tratamientoId: uuid("tratamiento_id").references(() => tratamiento.id, { onDelete: "set null" }),
  inicio: timestamp("inicio", { withTimezone: true }).notNull(),
  duracionMin: integer("duracion_min").notNull().default(30),
  estado: estadoCita("estado").notNull().default("solicitada"),
  pedidaEnWeb: boolean("pedida_en_web").notNull().default(false),
  motivo: text("motivo"),
  notas: text("notas"),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("cita_inicio").on(t.inicio),
  index("cita_paciente").on(t.pacienteId),
  index("cita_estado").on(t.estado),
]);

/* ─────────────────────────── Historia ─────────────────────────── */

/* Lo que se hizo de verdad, que no siempre es lo que se citó. */
export const acto = pgTable("acto", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id").notNull().references(() => paciente.id, { onDelete: "cascade" }),
  citaId: uuid("cita_id").references(() => cita.id, { onDelete: "set null" }),
  tratamientoId: uuid("tratamiento_id").references(() => tratamiento.id, { onDelete: "set null" }),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  /* Producto, lote y caducidad: en inyectables hay que poder trazar qué se
     puso a quién si un lote se retira. */
  producto: text("producto"),
  lote: text("lote"),
  zonas: text("zonas"),
  dosis: text("dosis"),
  notas: text("notas"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("acto_paciente").on(t.pacienteId), index("acto_fecha").on(t.fecha)]);

export const nota = pgTable("nota", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id").notNull().references(() => paciente.id, { onDelete: "cascade" }),
  citaId: uuid("cita_id").references(() => cita.id, { onDelete: "set null" }),
  autorId: uuid("autor_id").references(() => usuario.id, { onDelete: "set null" }),
  texto: text("texto").notNull(),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("nota_paciente").on(t.pacienteId)]);

export const tipoDocumento = pgEnum("tipo_documento", ["consentimiento", "informe", "analitica", "otro"]);

export const documento = pgTable("documento", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id").notNull().references(() => paciente.id, { onDelete: "cascade" }),
  actoId: uuid("acto_id").references(() => acto.id, { onDelete: "set null" }),
  tipo: tipoDocumento("tipo").notNull().default("consentimiento"),
  nombre: text("nombre").notNull(),
  /* La referencia en el almacén, nunca una URL pública: el fichero se sirve por
     una ruta que antes comprueba la sesión. */
  clave: text("clave").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  firmadoEn: date("firmado_en"),
  subidoEn: timestamp("subido_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documento_paciente").on(t.pacienteId)]);

export const momento = pgEnum("momento", ["antes", "despues", "evolucion"]);

export const foto = pgTable("foto", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id").notNull().references(() => paciente.id, { onDelete: "cascade" }),
  actoId: uuid("acto_id").references(() => acto.id, { onDelete: "set null" }),
  momento: momento("momento").notNull().default("antes"),
  clave: text("clave").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  tomadaEn: timestamp("tomada_en", { withTimezone: true }).notNull().defaultNow(),
  /* Guardar la foto y poder publicarla son dos permisos distintos. Por defecto,
     no. */
  publicable: boolean("publicable").notNull().default(false),
}, (t) => [index("foto_paciente").on(t.pacienteId)]);

/* ─────────────────────────── Dinero ─────────────────────────── */

export const metodoPago = pgEnum("metodo_pago", ["efectivo", "tarjeta", "transferencia", "bizum", "financiado"]);

/* Registro de cobros, no facturación fiscal: qué se hizo, cuánto se cobró y
   cómo se pagó. La factura, mientras no lo decidamos, se emite fuera. */
export const cobro = pgTable("cobro", {
  id: uuid("id").primaryKey().defaultRandom(),
  pacienteId: uuid("paciente_id").notNull().references(() => paciente.id, { onDelete: "cascade" }),
  actoId: uuid("acto_id").references(() => acto.id, { onDelete: "set null" }),
  fecha: date("fecha").notNull(),
  concepto: text("concepto").notNull(),
  importeCents: integer("importe_cents").notNull(),
  metodo: metodoPago("metodo").notNull().default("tarjeta"),
  notas: text("notas"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("cobro_paciente").on(t.pacienteId), index("cobro_fecha").on(t.fecha)]);

/* Un intento de entrada por minuto y correo: sin esto, la única puerta del
   sistema se puede probar a ciegas toda la noche. */
export const intento = pgTable("intento", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  cuando: timestamp("cuando", { withTimezone: true }).notNull().defaultNow(),
  logrado: boolean("logrado").notNull().default(false),
}, (t) => [index("intento_email").on(t.email, t.cuando)]);
