// The list of tasks for the current filter. Server Component: it receives the
// rows Prisma returns, formats the dates once on the server and hands plain
// data to each TaskItem (the Client Component with the actions).
import type { Task } from "@/generated/prisma/client";
import { TaskItem } from "@/components/TaskItem";
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
        <TaskItem
          key={task.id}
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            completed: task.completed,
            createdAt: task.createdAt.toISOString(),
            createdLabel: formatRelative(task.createdAt, now),
          }}
        />
      ))}
    </ul>
  );
}
