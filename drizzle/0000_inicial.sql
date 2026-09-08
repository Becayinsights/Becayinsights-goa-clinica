CREATE TYPE "public"."area" AS ENUM('estetica', 'capilar', 'cirugia');--> statement-breakpoint
CREATE TYPE "public"."estado_cita" AS ENUM('solicitada', 'confirmada', 'hecha', 'no_asistio', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."estado_paciente" AS ENUM('lead', 'paciente', 'inactivo');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago" AS ENUM('efectivo', 'tarjeta', 'transferencia', 'bizum', 'financiado');--> statement-breakpoint
CREATE TYPE "public"."momento" AS ENUM('antes', 'despues', 'evolucion');--> statement-breakpoint
CREATE TYPE "public"."origen" AS ENUM('web', 'instagram', 'recomendacion', 'consulta', 'otro');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('doctor', 'recepcion');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('consentimiento', 'informe', 'analitica', 'otro');--> statement-breakpoint
CREATE TABLE "acto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"cita_id" uuid,
	"tratamiento_id" uuid,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"producto" text,
	"lote" text,
	"zonas" text,
	"dosis" text,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" uuid,
	"detalle" text,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bloqueo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"motivo" text
);
--> statement-breakpoint
CREATE TABLE "cita" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"tratamiento_id" uuid,
	"inicio" timestamp with time zone NOT NULL,
	"duracion_min" integer DEFAULT 30 NOT NULL,
	"estado" "estado_cita" DEFAULT 'solicitada' NOT NULL,
	"pedida_en_web" boolean DEFAULT false NOT NULL,
	"motivo" text,
	"notas" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cobro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"acto_id" uuid,
	"fecha" date NOT NULL,
	"concepto" text NOT NULL,
	"importe_cents" integer NOT NULL,
	"metodo" "metodo_pago" DEFAULT 'tarjeta' NOT NULL,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"acto_id" uuid,
	"tipo" "tipo_documento" DEFAULT 'consentimiento' NOT NULL,
	"nombre" text NOT NULL,
	"clave" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"firmado_en" date,
	"subido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"acto_id" uuid,
	"momento" "momento" DEFAULT 'antes' NOT NULL,
	"clave" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"tomada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"publicable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dia_semana" integer NOT NULL,
	"desde" time NOT NULL,
	"hasta" time NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	"logrado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nota" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"cita_id" uuid,
	"autor_id" uuid,
	"texto" text NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paciente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"apellidos" text,
	"email" text,
	"telefono" text,
	"fecha_nacimiento" date,
	"documento" text,
	"estado" "estado_paciente" DEFAULT 'lead' NOT NULL,
	"origen" "origen" DEFAULT 'web' NOT NULL,
	"motivo" text,
	"notas" text,
	"alergias" text,
	"antecedentes" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesion" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"agente" text
);
--> statement-breakpoint
CREATE TABLE "tratamiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"area" "area" NOT NULL,
	"precio_texto" text,
	"precio_cents" integer,
	"duracion_min" integer DEFAULT 30 NOT NULL,
	"reservable_online" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tratamiento_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"clave" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol" DEFAULT 'doctor' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "acto" ADD CONSTRAINT "acto_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acto" ADD CONSTRAINT "acto_cita_id_cita_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."cita"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acto" ADD CONSTRAINT "acto_tratamiento_id_tratamiento_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamiento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_tratamiento_id_tratamiento_id_fk" FOREIGN KEY ("tratamiento_id") REFERENCES "public"."tratamiento"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobro" ADD CONSTRAINT "cobro_acto_id_acto_id_fk" FOREIGN KEY ("acto_id") REFERENCES "public"."acto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_acto_id_acto_id_fk" FOREIGN KEY ("acto_id") REFERENCES "public"."acto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foto" ADD CONSTRAINT "foto_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foto" ADD CONSTRAINT "foto_acto_id_acto_id_fk" FOREIGN KEY ("acto_id") REFERENCES "public"."acto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nota" ADD CONSTRAINT "nota_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nota" ADD CONSTRAINT "nota_cita_id_cita_id_fk" FOREIGN KEY ("cita_id") REFERENCES "public"."cita"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nota" ADD CONSTRAINT "nota_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acto_paciente" ON "acto" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "acto_fecha" ON "acto" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "auditoria_entidad" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "auditoria_cuando" ON "auditoria" USING btree ("cuando");--> statement-breakpoint
CREATE INDEX "bloqueo_inicio" ON "bloqueo" USING btree ("inicio");--> statement-breakpoint
CREATE INDEX "cita_inicio" ON "cita" USING btree ("inicio");--> statement-breakpoint
CREATE INDEX "cita_paciente" ON "cita" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "cita_estado" ON "cita" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "cobro_paciente" ON "cobro" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "cobro_fecha" ON "cobro" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "documento_paciente" ON "documento" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "foto_paciente" ON "foto" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "intento_email" ON "intento" USING btree ("email","cuando");--> statement-breakpoint
CREATE INDEX "nota_paciente" ON "nota" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "paciente_estado" ON "paciente" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "paciente_creado" ON "paciente" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX "paciente_telefono" ON "paciente" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "sesion_usuario" ON "sesion" USING btree ("usuario_id");