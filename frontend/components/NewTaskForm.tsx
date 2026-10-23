"use client";
// Form to add a task. Client Component because it keeps the typed values and
// the request state. On submit it calls the API, clears the fields and asks the
// server to re-render the page (`router.refresh()`), so the new task and the
// counters come from the database instead of being patched in the browser.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, DESCRIPTION_MAX, TITLE_MAX, createTask } from "@/lib/api";

const FIELD =
  "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none " +
  "focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

export function NewTaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Escribe un título para la tarea.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createTask({ title: trimmed, description: description.trim() });
        setTitle("");
        setDescription("");
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "No se pudo agregar la tarea.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6" aria-label="Nueva tarea" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título *"
          aria-label="Título"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-task-error" : undefined}
          maxLength={TITLE_MAX}
          required
          disabled={isPending}
          className={FIELD + " sm:flex-1"}
        />
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          aria-label="Descripción"
          maxLength={DESCRIPTION_MAX}
          rows={2}
          disabled={isPending}
          // One line next to the title on wider screens, two lines on phones.
          className={FIELD + " resize-none sm:h-[42px] sm:flex-1"}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Agregando…" : "Agregar tarea"}
        </button>
      </div>
      {error && (
        <p id="new-task-error" role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
