import { createHash, randomUUID } from "node:crypto";
import type { Bot, McpServer, TeamMemoryOperation, TeamMemoryState } from "@/lib/shared/types";
import { openLoreResult } from "@/lib/shared/openlore-result";
import { db, getBot } from "./db";
import { InputError } from "./errors";
import { listServers, stored, type StoredServer } from "./mcp-servers";

export const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export async function runOpenLore(server: StoredServer, command: string) {
  const url = new URL("/api/shell", server.url);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { ...server.headers, "Content-Type": "application/json", ...(server.token ? { Authorization: `Bearer ${server.token}` } : {}) },
      body: JSON.stringify({ command }),
    });
  } catch { throw new InputError("OpenLore is unavailable. Check the server URL and start the knowledge server, then retry."); }
  if (response.status === 401 || response.status === 403) throw new InputError("OpenLore authentication failed. The credential may be expired or revoked; refresh this connection's token.");
  if (!response.ok) throw new InputError(`OpenLore request failed (${response.status}). Check the server endpoint and permissions.`);
  const parsed = openLoreResult(await response.json());
  if (!parsed) throw new InputError("OpenLore returned an unsupported command result.");
  return parsed;
}

async function checked(server: StoredServer, command: string) {
  const result = await runOpenLore(server, command);
  if (result.exit_code !== 0) throw new InputError((result.stderr || result.stdout || `OpenLore command exited ${result.exit_code}`).slice(0, 1500));
  return result.stdout.trim();
}

export async function inspectOpenLore(server: StoredServer) {
  const [identity, collections] = await Promise.all([checked(server, "whoami"), checked(server, "lore docsets")]);
  return { identity, collections };
}

export async function botLoreServers(bot: Bot): Promise<StoredServer[]> {
  const ids = new Set(bot.connections.filter((id) => id.startsWith("mcp:")).map((id) => id.slice(4)));
  return (await stored()).filter((server) => ids.has(server.id) && server.kind === "openlore");
}

/** Access equality is computed from effective grants, never a user-supplied team label. */
export async function memoryBoundary(bot: Bot): Promise<string> {
  const servers = await botLoreServers(bot);
  if (!servers.length) return "unscoped";
  const grants = await Promise.all(servers.map(async (server) => {
    const collections = await checked(server, "lore docsets");
    return `${new URL(server.url).origin}\n${collections.split("\n").slice(1).map((line) => line.trim().replace(/\s+/g, " ")).sort().join("\n")}`;
  }));
  return createHash("sha256").update(grants.sort().join("\n---\n")).digest("hex");
}

export async function roomMemoryBoundary(bots: Bot[], previous?: string): Promise<string> {
  if (bots.length === 0) return previous ?? "unscoped";
  const profiles = await Promise.all(bots.map(memoryBoundary));
  const distinct = new Set(profiles);
  if (distinct.size > 1) throw new InputError("This room would mix different Team Memory permissions. Use separate team rooms and share reviewed contract references instead.");
  const boundary = profiles[0] ?? "unscoped";
  if (previous && previous !== boundary) throw new InputError("This room already has a different memory boundary. Create a new room so earlier private messages cannot cross teams.");
  return boundary;
}

export async function recordTeamOperation(botId: string, command: string, value: unknown) {
  const result = openLoreResult(value);
  if (!result) return;
  const operation: TeamMemoryOperation = {
    id: randomUUID(), at: new Date().toISOString(), command: command.slice(0, 1000), exitCode: result.exit_code,
    preview: (result.stderr || result.stdout || "Completed").slice(0, 1200),
  };
  await (await db()).execute({ sql: "INSERT INTO team_memory_operations (id, bot_id, at, data) VALUES (?, ?, ?, ?)", args: [operation.id, botId, operation.at, JSON.stringify(operation)] });
  return operation;
}

export async function teamMemory(botId: string, serverId?: string, path?: string): Promise<TeamMemoryState> {
  const bot = await getBot(botId);
  if (!bot) throw new InputError("That bot doesn't exist.");
  const servers = await botLoreServers(bot);
  const publicServers: McpServer[] = (await listServers()).filter((s) => servers.some((allowed) => allowed.id === s.id));
  const rows = await (await db()).execute({ sql: "SELECT data FROM team_memory_operations WHERE bot_id = ? ORDER BY at DESC LIMIT 25", args: [botId] });
  const state: TeamMemoryState = { servers: publicServers, operations: rows.rows.map((r) => JSON.parse(String(r.data))) };
  const server = serverId ? servers.find((s) => s.id === serverId) : servers[0];
  if (serverId && !server) throw new InputError("This OpenLore connection is not assigned to the selected bot.");
  if (!server) return state;
  state.serverId = server.id;
  try {
    Object.assign(state, await inspectOpenLore(server));
    const files = await checked(server, "find / -type f -name '*.md'");
    state.files = files.split("\n").filter((f) => f.startsWith("/")).slice(0, 500);
    if (path) {
      if (!path.startsWith("/") || /[\u0000-\u001f]/.test(path) || path.length > 1024) throw new InputError("Choose an absolute document path.");
      const result = await runOpenLore(server, `head -c 65536 ${shellQuote(path)}`);
      const operation = await recordTeamOperation(botId, `read ${path}`, result);
      if (operation) state.operations = [operation, ...state.operations].slice(0, 25);
      if (result.exit_code !== 0) throw new InputError(result.stderr || result.stdout || "Document access refused.");
      state.document = { path, content: result.stdout };
    }
  } catch (error) { state.error = error instanceof Error ? error.message : "Couldn't read Team Memory."; }
  return state;
}
