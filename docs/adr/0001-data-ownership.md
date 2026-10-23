# ADR 0001: Un solo schema y un solo camino de escritura

- **Estado:** aceptada
- **Fecha:** 2026-10-23

## Contexto

El enunciado pide a la vez:

- un backend en Express con TypeScript conectado a PostgreSQL;
- Prisma configurado «en el proyecto Next.js»;
- API Routes de Next.js que se conecten con el backend de Express;
- un commit llamado «Backend setup con Express y Prisma».

Tomado al pie de la letra, eso deja dos procesos con acceso a la misma tabla. Si Next escribiera con Prisma y Express con SQL, las reglas de validación y los códigos de error existirían en dos lugares, y tarde o temprano dirían cosas distintas. Si cada uno tuviera su propio schema, habría dos fuentes de verdad que se desincronizan con la primera migración.

Se evaluaron tres opciones:

1. **Prisma dueño del schema en `backend/prisma/`**, Express escribe con `pg`, Next lee con un cliente de Prisma generado desde ese schema y escribe a través de Express.
2. Prisma solo en `frontend/` y Express solo con `pg`, cada uno por su lado.
3. Un paquete `db` compartido con npm workspaces.

## Decisión

Opción 1:

- **El schema vive una sola vez**, en `backend/prisma/schema.prisma`, y solo cambia con una migración de Prisma (`backend/prisma/migrations/`).
- **Express es el único que escribe.** Valida cada petición con Zod y escribe con SQL parametrizado sobre un pool de `pg` (`backend/src/db/tasks.ts`).
- **Next.js solo lee con Prisma.** Su cliente se genera desde el schema del backend (`output` en `schema.prisma`, `frontend/prisma.config.ts`) y lo usan los Server Components (`frontend/lib/tasks.ts`).
- **Las escrituras de Next pasan por Express.** Los Route Handlers de `frontend/app/api/tasks/` reenvían método, cuerpo y respuesta sin modificarlos (`frontend/lib/backend.ts`).

La opción 2 dejaba dos modelos para sincronizar a mano. La opción 3 agregaba workspaces y un tercer paquete para una sola tabla, y complicaba los Dockerfiles.

## Consecuencias

- Las reglas de validación y los códigos de error están en un solo lugar (`backend/src/validation/`, `backend/src/middleware/errors.ts`). La interfaz solo los traduce a mensajes en español (`frontend/lib/api.ts`).
- Agregar un campo es un recorrido fijo y nunca hay que sincronizar dos modelos ([cómo agregar un campo](../adding-a-field.md)).
- Una escritura hace un salto más (navegador → Next → Express → base). Para esta aplicación es despreciable, y a cambio el navegador nunca ve la URL de Express.
- Hay que vigilar que nadie escriba con Prisma desde Next. Esta búsqueda debe salir vacía antes de cada commit:

  ```bash
  git grep -n -E 'prisma\.task\.(create|update|delete|upsert)' -- frontend
  ```

- Los dos procesos abren conexiones a la misma base: el pool de Express se limita a 10 para dejar margen a Prisma ([`api.md`](../api.md#pool-de-conexiones)).
- **Cómo se revierte:** mover `prisma/` a `frontend/` (opción 2) o a un paquete compartido (opción 3). Express no cambia, porque no usa Prisma.
