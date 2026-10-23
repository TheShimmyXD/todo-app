// /api/tasks/:id — update (PUT) and delete (DELETE), forwarded to the Express
// API (see lib/backend.ts). Express validates the id: a malformed or unknown
// one comes back as its own 400 or 404.
import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/backend";

async function taskPath(ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return "/api/tasks/" + encodeURIComponent(id);
}

export async function PUT(request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  return forwardToBackend(request, await taskPath(ctx));
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  return forwardToBackend(request, await taskPath(ctx));
}
