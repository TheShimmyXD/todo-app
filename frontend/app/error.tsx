"use client";
// Error boundary for the home page. If reading the tasks fails (for example the
// database is down), Next.js renders this instead of the page, inside the root
// layout. `retry()` re-fetches and re-renders the page from the server.
import { useEffect } from "react";

export default function HomeError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    // Shown in the browser console. In production the message is generic; the
    // `digest` matches the full error in the server log.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-4 text-2xl font-bold">Mis tareas</h1>
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">No se pudieron cargar las tareas.</p>
        <p className="text-sm">Puede que la base de datos no esté disponible. Intenta de nuevo en unos segundos.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
