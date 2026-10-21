import { handle } from "@/lib/server/http";
import { teamMemory } from "@/lib/server/openlore";

export async function GET(request: Request, ctx: RouteContext<"/api/bots/[id]/team-memory">) {
  const { id } = await ctx.params;
  const query = new URL(request.url).searchParams;
  return handle(() => teamMemory(id, query.get("server") ?? undefined, query.get("path") ?? undefined));
}
