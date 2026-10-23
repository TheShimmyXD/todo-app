// Read-side helpers for the task list: the status filter taken from the URL and
// the Prisma queries behind the page. Kept apart from the page so the filter
// rules live in one place (see README, "Cómo se agrega un filtro").
import "server-only";
import { getPrisma } from "@/lib/prisma";

/** Status filter as it appears in the URL: `?completed=true|false`, absent = all. */
export type StatusFilter = "all" | "pending" | "completed";

/**
 * Turns the raw `completed` search param into a filter. Mirrors the Express API
 * (`GET /api/tasks?completed=`); any other value falls back to "all" instead of
 * failing, because it only comes from a link or a hand-typed URL.
 */
export function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  if (value === "true") return "completed";
  if (value === "false") return "pending";
  return "all";
}

/** Tasks for the given filter, newest first (served by the composite index). */
export function listTasks(filter: StatusFilter) {
  return getPrisma().task.findMany({
    where: filter === "all" ? undefined : { completed: filter === "completed" },
    orderBy: { createdAt: "desc" },
  });
}

/** Number of tasks per filter, for the tab counters. */
export async function countTasks(): Promise<Record<StatusFilter, number>> {
  const groups = await getPrisma().task.groupBy({ by: ["completed"], _count: { _all: true } });
  const completed = groups.find((g) => g.completed)?._count._all ?? 0;
  const pending = groups.find((g) => !g.completed)?._count._all ?? 0;
  return { all: completed + pending, pending, completed };
}
