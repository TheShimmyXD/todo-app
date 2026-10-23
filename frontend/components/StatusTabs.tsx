// Filter tabs (Todas / Pendientes / Completadas) with their counters.
// Plain links that change `?completed=`: the page re-renders on the server with
// the new filter, so no client JavaScript is needed here.
import Link from "next/link";
import type { StatusFilter } from "@/lib/tasks";

const TABS: { filter: StatusFilter; label: string; href: string }[] = [
  { filter: "all", label: "Todas", href: "/" },
  { filter: "pending", label: "Pendientes", href: "/?completed=false" },
  { filter: "completed", label: "Completadas", href: "/?completed=true" },
];

type Props = {
  active: StatusFilter;
  counts: Record<StatusFilter, number>;
};

export function StatusTabs({ active, counts }: Props) {
  return (
    <nav aria-label="Filtrar tareas" className="mb-2 flex border-b border-slate-200 text-sm">
      {TABS.map(({ filter, label, href }) => {
        const isActive = filter === active;
        return (
          <Link
            key={filter}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              "flex-1 py-2 text-center sm:flex-none sm:px-4 " +
              (isActive
                ? "-mb-px border-b-2 border-indigo-600 font-semibold text-indigo-700"
                : "text-slate-500 hover:text-slate-800")
            }
          >
            {label} <span className="tabular-nums">{counts[filter]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
