ALTER TABLE "acto" ADD COLUMN "recordar_en" date;--> statement-breakpoint
ALTER TABLE "acto" ADD COLUMN "recordado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "paciente" ADD COLUMN "numero" serial NOT NULL;--> statement-breakpoint
CREATE INDEX "acto_recordar" ON "acto" USING btree ("recordar_en");