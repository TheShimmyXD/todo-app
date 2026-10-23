// Server-side bridge to the Express API, used by the Route Handlers under
// app/api/tasks. The browser only talks to this app; this module forwards the
// request to `${BACKEND_URL}` and returns Express's status and body unchanged,
// so validation and error codes are decided in one place (the backend). When
// Express cannot be reached it answers in the same error format, so the UI
// handles every failure the same way.
import "server-only";

/** How long to wait for Express before giving up (the API itself answers in ms). */
const TIMEOUT_MS = 10_000;

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function backendUrl(path: string): string {
  const base = process.env.BACKEND_URL;
  if (!base) {
    throw new Error("BACKEND_URL is not set. Copy .env.example to .env at the repository root.");
  }
  return new URL(path, base).toString();
}

/**
 * Sends `request`'s method and body to `path` on the Express API and relays the
 * answer. `path` must already include the query string, if any.
 *  - Express unreachable (not running, wrong host) → 502 BACKEND_UNAVAILABLE.
 *  - No answer within TIMEOUT_MS → 504 BACKEND_TIMEOUT.
 */
export async function forwardToBackend(request: Request, path: string): Promise<Response> {
  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      method: request.method,
      // The raw text is forwarded as is: Express parses and validates it
      // (for example, malformed JSON → 400 INVALID_JSON).
      body: hasBody ? await request.text() : undefined,
      headers: hasBody ? { "Content-Type": request.headers.get("content-type") ?? "application/json" } : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return errorResponse(504, "BACKEND_TIMEOUT", "The API did not answer in time");
    }
    console.error("Express API unreachable:", error);
    return errorResponse(502, "BACKEND_UNAVAILABLE", "The API is not reachable");
  }

  // 204 (delete) must not carry a body.
  const body = response.status === 204 ? null : await response.arrayBuffer();
  const contentType = response.headers.get("content-type");
  return new Response(body, {
    status: response.status,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
}
