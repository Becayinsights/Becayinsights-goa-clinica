import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/esquema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/goa" },
} satisfies Config;
