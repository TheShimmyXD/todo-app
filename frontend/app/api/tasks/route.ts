// /api/tasks — list (GET, with the same `?completed=` filter as Express) and
// create (POST). Both are forwarded to the Express API; see lib/backend.ts.
import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend";

export function GET(request: NextRequest) {
  return forwardToBackend(request, "/api/tasks" + request.nextUrl.search);
}

export function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/tasks");
}
