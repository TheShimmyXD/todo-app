// Home page: the task list (layout chosen from the mockups: one centred column,
// new-task form, filter tabs, list). Server Component: it reads the tasks with
// Prisma on every request. With Cache Components enabled, the heading and the
// form (a Client Component) are prerendered as a static shell, and everything
// that depends on the request (the `completed` search param and the database)
// streams inside <Suspense>.
import { Suspense } from "react";
import { NewTaskForm } from "@/components/NewTaskForm";
import { StatusTabs } from "@/components/StatusTabs";
import { TaskList } from "@/components/TaskList";
import { countTasks, listTasks, parseStatusFilter } from "@/lib/tasks";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="mb-4 text-2xl font-bold">Mis tareas</h1>
      <NewTaskForm />
      <Suspense fallback={<p className="py-10 text-center text-slate-400">Cargando tareas…</p>}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Tasks({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const filter = parseStatusFilter((await searchParams).completed);
  const [tasks, counts] = await Promise.all([listTasks(filter), countTasks()]);
  return (
    <>
      <StatusTabs active={filter} counts={counts} />
      <TaskList tasks={tasks} filter={filter} />
    </>
  );
}
