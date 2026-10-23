-- Hand-written SQL for the tasks table, meant to be run with psql against the
-- database created by the Prisma migrations, for example:
--   docker compose exec -T db psql -U todo -d todo -v completed=true < db/queries.sql
-- The `completed` variable picks the status to filter by; it defaults to false
-- (pending tasks) when it is not given.

\if :{?completed}
\else
  \set completed false
\endif

-- 1. Tasks with a given status, newest first.
--    Served by tasks_completed_created_at_idx (completed, created_at DESC).
SELECT id, title, description, completed, created_at
FROM tasks
WHERE completed = :'completed'::boolean
ORDER BY created_at DESC;

-- 2. Number of tasks per status.
--    Starting from both possible values keeps a status with no tasks in the
--    result (count 0) instead of silently dropping the row.
SELECT s.completed, count(t.id) AS total
FROM (VALUES (false), (true)) AS s (completed)
LEFT JOIN tasks AS t ON t.completed = s.completed
GROUP BY s.completed
ORDER BY s.completed;
