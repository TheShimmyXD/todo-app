# To-Do App

Aplicación de tareas para un equipo: crear, listar, filtrar (todas, completadas y pendientes), editar, marcar como completada y eliminar tareas. El backend es una API REST en Express y TypeScript sobre PostgreSQL; el frontend es una aplicación Next.js con Prisma; todo se levanta con Docker Compose.

> Estado: en construcción. Las secciones marcadas como *pendiente* se completan a medida que se agrega cada parte.

## Tecnologías utilizadas

| Capa | Tecnología | Versión |
|---|---|---|
| Entorno | Node.js (LTS) | 24.x |
| Lenguaje | TypeScript | 5.9.3 |
| Backend | Express | 5.3.0 |
| Acceso a datos (escrituras) | node-postgres (`pg`) | 8.23.1 |
| Validación | Zod | 4.6.7 |
| Esquema, migraciones y lecturas | Prisma ORM (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) | 7.10.1 |
| Frontend | Next.js (App Router) + React | 16.4.3 + 19.3.0 |
| Estilos | Tailwind CSS | 4.3.3 |
| Pruebas | Vitest + Supertest | 5.0.5 + 7.3.1 |
| Calidad | ESLint + typescript-eslint | 9.39.5 + 8.72.0 |
| Base de datos | PostgreSQL (imagen `postgres:18.6-alpine`) | 18.6 |
| Contenedores | Docker + Docker Compose | 29.x + 2.40 |

Las versiones están fijadas sin rangos (`^`) para que todo el equipo instale exactamente lo mismo. TypeScript se mantiene en la línea 5.9 porque typescript-eslint todavía no admite TypeScript 7, y Prisma se mantiene en la última versión estable (7.10.1), no en la candidata 8.

## Arquitectura

*Pendiente.* Resumen del diseño: Prisma es el dueño del esquema y de las migraciones; Express es el único que escribe en la base y valida los datos; Next.js lee con Prisma desde sus Server Components y envía las escrituras a Express a través de sus Route Handlers.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `.env.example` | Plantilla de todas las variables de entorno (ver más abajo). |
| `.editorconfig` | Codificación, finales de línea e indentación comunes para cualquier editor. |
| `.gitignore` | Dependencias, salidas de compilación y archivos `.env` locales que nunca se versionan. |

## Variables de entorno

Copia la plantilla y ajusta los valores: `cp .env.example .env`. El archivo `.env` está en `.gitignore`; solo se versiona `.env.example`.

| Variable | Quién la usa | Para qué |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Contenedor de PostgreSQL | Usuario, contraseña y base que se crean al iniciar el contenedor. |
| `POSTGRES_PORT` | Docker Compose | Puerto de la máquina donde se publica PostgreSQL. |
| `DATABASE_URL` | Prisma y el pool de Express | Cadena de conexión a la base. |
| `API_PORT` | Express | Puerto en el que escucha la API. |
| `BACKEND_URL` | Route Handlers de Next.js | URL base de la API a la que se reenvían las escrituras. Solo existe en el servidor. |

## Instalación

*Pendiente.*

## Comandos para correr el proyecto

*Pendiente.*

## Decisiones técnicas tomadas

*Pendiente.*

## Base de datos

*Pendiente.*

## Despliegue en Ubuntu desde cero

*Pendiente.*
