// The list of tasks for the current filter. Rendered on the server from the
// rows Prisma returns. The checkbox and the delete button are placeholders until
// they become Client Components that call the API.
import type { Task } from "@/generated/prisma/client";
import { formatRelative } from "@/lib/format";
import type { StatusFilter } from "@/lib/tasks";

const EMPTY_MESSAGE: Record<StatusFilter, string> = {
  all: "Todavía no hay tareas. Agrega la primera.",
  pending: "No hay tareas pendientes.",
  completed: "No hay tareas completadas.",
};

type Props = {
  tasks: Task[];
  filter: StatusFilter;
};

export function TaskList({ tasks, filter }: Props) {
  if (tasks.length === 0) {
    return <p className="py-10 text-center text-slate-500">{EMPTY_MESSAGE[filter]}</p>;
  }

  const now = new Date();
  return (
    <ul className="divide-y divide-slate-200">
      {tasks.map((task) => (
        <li key={task.id} className={"flex items-start gap-3 py-3" + (task.completed ? " opacity-60" : "")}>
          <input
            type="checkbox"
            checked={task.completed}
            readOnly
            aria-label={task.completed ? "Marcar como pendiente" : "Marcar como completada"}
            className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
          />
          <div className="min-w-0 flex-1">
            <p className={"font-medium break-words" + (task.completed ? " line-through" : "")}>{task.title}</p>
            {task.description && <p className="text-sm break-words text-slate-500">{task.description}</p>}
            <time dateTime={task.createdAt.toISOString()} className="text-xs text-slate-400 sm:hidden">
              {formatRelative(task.createdAt, now)}
            </time>
          </div>
          <time dateTime={task.createdAt.toISOString()} className="hidden text-xs whitespace-nowrap text-slate-400 sm:block">
            {formatRelative(task.createdAt, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}
