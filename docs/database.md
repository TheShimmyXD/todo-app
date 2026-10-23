# Base de datos

PostgreSQL 18 corre en Docker (servicio `db` de `docker-compose.yml`). El esquema se define en un solo lugar, `backend/prisma/schema.prisma`, y se aplica con migraciones de Prisma. La API de Express escribe con SQL parametrizado sobre esa misma tabla; Next.js la lee con Prisma.

## La tabla `tasks`

| Columna | Tipo | Regla | Por qué |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | Identificador no adivinable. Lo genera PostgreSQL, así funciona igual si la fila la inserta Prisma o un `INSERT` a mano. |
| `title` | `varchar(200)` | `NOT NULL` | Obligatorio y con largo acotado; la API valida el mismo máximo antes de llegar a la base. |
| `description` | `text` | `NOT NULL DEFAULT ''` | Opcional para el usuario, pero siempre es un texto (nunca `null`) para que el frontend no tenga que distinguir dos casos. |
| `completed` | `boolean` | `NOT NULL DEFAULT false` | Toda tarea nace pendiente. |
| `created_at` | `timestamptz(6)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Con zona horaria, para ordenar sin ambigüedad. En el código se expone como `createdAt`. |

Índices:

- `tasks_pkey`: clave primaria sobre `id`.
- `tasks_completed_created_at_idx`: btree sobre `(completed, created_at DESC)`.

## Por qué el índice es compuesto

La consulta principal de la aplicación es «tareas de un estado, de la más reciente a la más antigua»:

```sql
SELECT * FROM tasks WHERE completed = $1 ORDER BY created_at DESC;
```

Un índice solo sobre `completed` aporta poco: una columna booleana tiene dos valores, así que cada valor abarca una gran parte de la tabla y PostgreSQL suele preferir leerla entera. Al agregar `created_at DESC` como segunda columna, el índice además entrega las filas de cada estado **ya ordenadas**, y la base puede ahorrarse el ordenamiento.

### Medición

Con 20 000 tareas de prueba (80 % completadas, 20 % pendientes), `EXPLAIN ANALYZE` en PostgreSQL 18.6:

| Consulta | Plan con el índice | Tiempo | Sin el índice |
|---|---|---|---|
| Pendientes (4 000 filas) | Bitmap Index Scan sobre el índice + Sort | 2,0 ms | Seq Scan (descarta 16 000 filas) + Sort: 3,8 ms |
| Completadas (16 000 filas) | Index Scan, **sin Sort** | 3,5 ms | — |

Cómo leerlo:

- Con este volumen las diferencias son de milisegundos; lo importante es la forma del plan, que se mantiene al crecer la tabla: el índice evita recorrer las filas que no cumplen el filtro y, cuando lo usa como Index Scan, también evita ordenar.
- La vista «todas» (`ORDER BY created_at DESC` sin filtro) no aprovecha este índice, porque su primera columna es `completed`. Si esa vista llegara a ser lenta, la solución sería un índice aparte sobre `created_at DESC` o paginar los resultados.

Para repetir la medición sin dejar datos, se puede correr dentro de una transacción que se deshace:

```sql
BEGIN;
INSERT INTO tasks (title, completed, created_at)
SELECT 'Task ' || g, g % 5 <> 0, now() - g * interval '1 minute'
FROM generate_series(1, 20000) g;
ANALYZE tasks;
EXPLAIN ANALYZE SELECT * FROM tasks WHERE completed = false ORDER BY created_at DESC;
ROLLBACK;
```

## Migraciones

Las migraciones viven en `backend/prisma/migrations/` y se versionan en Git. La primera, `20261023192118_init`, crea la tabla `tasks` y sus dos índices.

Todas las órdenes se corren desde `backend/`, con la base levantada (`docker compose up -d db`). Prisma lee `DATABASE_URL` del `.env` de la raíz del repositorio (lo carga `backend/prisma.config.ts`); si la variable ya está definida en el entorno, por ejemplo dentro de Docker, esa tiene prioridad.

| Orden | Cuándo usarla |
|---|---|
| `npm run db:deploy` | Aplicar las migraciones pendientes. Es la que se usa en una base nueva, en CI y en producción: no crea migraciones ni borra datos. |
| `npm run db:status` | Ver qué migraciones están aplicadas y cuáles faltan. |
| `npm run db:migrate -- --name <cambio>` | Solo en desarrollo: crea una migración nueva a partir de los cambios en `schema.prisma` y la aplica. |

### Cómo cambiar el esquema

1. Edita `backend/prisma/schema.prisma`.
2. Corre `npm run db:migrate -- --name <descripcion_corta>` (por ejemplo, `add_due_date`). Prisma escribe el SQL en una carpeta nueva dentro de `migrations/`.
3. Revisa el `migration.sql` generado antes de hacer commit: es lo que se ejecutará en las demás bases.
4. Haz commit del schema y de la carpeta de la migración juntos.

Nunca se edita una migración que ya está en `main`, ni se cambian las tablas a mano: cualquier corrección va en una migración nueva.

## Consola SQL

```bash
docker compose exec db psql -U todo -d todo     # usuario y base de .env
\d tasks                                         # estructura de la tabla
```
