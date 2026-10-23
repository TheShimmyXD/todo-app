// Root layout shared by every page: document language, metadata and base styles.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "To-Do App",
  description: "Lista de tareas del equipo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-slate-800 antialiased">{children}</body>
    </html>
  );
}
