// Browser-side client for the task mutations. Every write goes to the app's own
// `/api/tasks` routes (Route Handlers that forward to Express), never to Prisma:
// Express is the only writer. Errors come back in the Express format
// `{ error: { code, message, details? } }` and are turned into Spanish messages
// for the UI here, so the components only have to display `ApiError.message`.

/** Longest values the API accepts (same limits as the database columns). */
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;

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
 * message for a known `code`, or a generic one with the status (for example a
 * 404 HTML page when the route does not exist yet).
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

async function request(path: string, init: RequestInit): Promise<void> {
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
}

export function createTask(input: { title: string; description: string }) {
  return request("/api/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function setTaskCompleted(id: string, completed: boolean) {
  return request(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ completed }),
  });
}

export function deleteTask(id: string) {
  return request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
