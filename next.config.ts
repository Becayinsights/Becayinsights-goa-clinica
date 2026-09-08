import type { NextConfig } from "next";

/* Cabeceras de seguridad. En un sistema con datos de salud no son un extra:
   evitan que el panel se pueda enmarcar desde otro sitio, que el navegador
   adivine tipos de contenido y que la URL salga como referente hacia fuera. */
const cabeceras = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  poweredByHeader: false,
  /* PGlite solo se usa en desarrollo; que no entre en el paquete del servidor. */
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  async headers() {
    return [{ source: "/:ruta*", headers: cabeceras }];
  },
};

export default config;
