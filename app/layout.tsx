import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestor de boletas de honorarios",
  description: "Calcula horas extras de personal de salud para boletas de honorarios, permite llevar registros y exportar detalles en Excel.",
  applicationName: "Gestor Boletas Honorarios",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app.png",
    shortcut: "/app.png",
    apple: "/app.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d7c66",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
