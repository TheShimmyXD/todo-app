// Browser-side client for the task mutations. Every write goes to the app's own
// `/api/tasks` routes (Route Handlers that forward to Express), never to Prisma:
// Express is the only writer. Errors come back in the Express format
// `{ error: { code, message, details? } }` and are turned into Spanish messages
// for the UI here, so the components only have to display `ApiError.message`.

/** Longest values the API accepts (same limits as the database columns). */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

/**
 * A task as the API returns it (JSON). It matches Express's response; the only
 * difference with the Prisma `Task` used on the server is `createdAt`, which
 * travels as an ISO 8601 string and is not converted back to `Date` here
 * because the UI re-reads the list from the server after every change.
 */
export type ApiTask = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
};

type ErrorBody = {
  error?: { code?: string; message?: string; details?: { field?: string }[] };
};

const FIELD_MESSAGE: Record<string, string> = {
  title: `El título es obligatorio y admite hasta ${TITLE_MAX} caracteres.`,
  description: `La descripción admite hasta ${DESCRIPTION_MAX} caracteres.`,
};

const CODE_MESSAGE: Record<string, string> = {
  VALIDATION_ERROR: "Revisa los datos de la tarea.",
  INVALID_JSON: "La solicitud no es válida.",
  TASK_NOT_FOUND: "La tarea ya no existe. Recarga la página.",
  PAYLOAD_TOO_LARGE: "El texto es demasiado largo.",
  DATABASE_UNAVAILABLE: "La base de datos no responde. Intenta de nuevo en unos segundos.",
  INTERNAL_ERROR: "El servidor tuvo un error. Intenta de nuevo.",
  // Added by the Route Handlers when Express itself cannot be reached.
  BACKEND_UNAVAILABLE: "El servicio de tareas no está disponible. Intenta de nuevo en unos segundos.",
  BACKEND_TIMEOUT: "El servicio de tareas tardó demasiado en responder. Intenta de nuevo.",
};

/** A failed API call, with a message ready to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Builds the user-facing message: the field rule for validation errors, the
 * message for a known `code`, or a generic one with the status (for example an
 * HTML error page from a proxy in front of the app).
 */
function toApiError(status: number, body: ErrorBody | null): ApiError {
  const code = body?.error?.code;
  const field = body?.error?.details?.find((d) => d.field && FIELD_MESSAGE[d.field])?.field;
  const message =
    (field && FIELD_MESSAGE[field]) ||
    (code && CODE_MESSAGE[code]) ||
    `El servidor respondió con un error (${status}).`;
  return new ApiError(message, status, code);
}

/** Sends the request and returns the raw response if it succeeded (2xx). */
async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Revisa tu conexión.", 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw toApiError(response.status, body);
  }
  return response;
}

export async function createTask(input: { title: string; description: string }): Promise<ApiTask> {
  const response = await request("/api/tasks", { method: "POST", body: JSON.stringify(input) });
  return (await response.json()) as ApiTask;
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<ApiTask> {
  const response = await request(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ completed }),
  });
  return (await response.json()) as ApiTask;
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
