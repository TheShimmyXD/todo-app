// Error handling for the whole API. Every error response has the same shape:
//   { "error": { "code": "TASK_NOT_FOUND", "message": "...", "details": [...] } }
// Routes throw an HttpError (or let any other error bubble up; Express 5 forwards
// rejected promises on its own) and `errorHandler`, registered last in src/app.ts,
// is the only place that turns errors into responses.
import type { ErrorRequestHandler, RequestHandler } from "express";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Registered after every route: any request that reaches it matched nothing.
export const notFoundHandler: RequestHandler = (req) => {
  throw new HttpError(404, "NOT_FOUND", `Route ${req.method} ${req.path} does not exist`);
};

// Errors raised by express.json() while reading the body carry a `type` field.
function bodyParserError(error: unknown): HttpError | null {
  if (typeof error !== "object" || error === null || !("type" in error)) return null;
  if (error.type === "entity.parse.failed") {
    return new HttpError(400, "INVALID_JSON", "The request body is not valid JSON");
  }
  if (error.type === "entity.too.large") {
    return new HttpError(413, "PAYLOAD_TOO_LARGE", "The request body is too large");
  }
  return null;
}

// The four arguments are what tells Express this is an error handler.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const httpError = error instanceof HttpError ? error : bodyParserError(error);

  if (httpError) {
    const { status, code, message, details } = httpError;
    res.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });
    return;
  }

  // Unexpected error: log it in full for the team, but never send the stack or the
  // original message to the client, since they can expose internals.
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server" } });
};
