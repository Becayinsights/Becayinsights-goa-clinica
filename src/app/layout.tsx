import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GOA · Clínica",
  description: "Panel de gestión de la consulta del Dr. Bengoa.",
  /* Un panel con historias clínicas no se indexa jamás. */
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
