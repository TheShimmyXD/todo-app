"use client";
// One row of the list with its two actions: the checkbox (complete / pending)
// and the delete button. Client Component because of the clicks and the
// request state; the data itself comes from the server (TaskList), already
// formatted, so the server and the browser render the same text.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, deleteTask, setTaskCompleted } from "@/lib/api";

export type TaskItemData = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  /** ISO date, for the `<time>` element. */
  createdAt: string;
  /** "hace 5 minutos", computed on the server. */
  createdLabel: string;
};

export function TaskItem({ task }: { task: TaskItemData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Both actions share the flow: call the API, then re-render the page from the
  // database. While the request runs the row is disabled.
  function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : fallback);
      }
    });
  }

  const time = (className: string) => (
    <time dateTime={task.createdAt} className={"text-xs text-slate-400 " + className}>
      {task.createdLabel}
    </time>
  );

  return (
    <li
      aria-busy={isPending || undefined}
      className={"flex items-start gap-3 py-3" + (task.completed ? " opacity-60" : "") + (isPending ? " animate-pulse" : "")}
    >
      <input
        type="checkbox"
        checked={task.completed}
        disabled={isPending}
        onChange={() => run(() => setTaskCompleted(task.id, !task.completed), "No se pudo actualizar la tarea.")}
        aria-label={(task.completed ? "Marcar como pendiente: " : "Marcar como completada: ") + task.title}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600 disabled:cursor-wait"
      />
      <div className="min-w-0 flex-1">
        <p className={"font-medium break-words" + (task.completed ? " line-through" : "")}>{task.title}</p>
        {task.description && <p className="text-sm break-words text-slate-500">{task.description}</p>}
        {time("sm:hidden")}
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
      {time("hidden whitespace-nowrap sm:block")}
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => deleteTask(task.id), "No se pudo eliminar la tarea.")}
        aria-label={"Eliminar: " + task.title}
        title="Eliminar"
        className="-m-1 p-1 text-slate-400 hover:text-red-600 disabled:cursor-wait"
      >
        <span aria-hidden className="text-lg sm:hidden">
          🗑
        </span>
        <span className="hidden text-sm sm:inline">Eliminar</span>
      </button>
    </li>
  );
}
