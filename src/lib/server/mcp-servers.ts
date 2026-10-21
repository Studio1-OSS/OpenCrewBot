// Your own MCP servers (GitHub's remote server, a company server, anything
// that speaks MCP over HTTP). Tokens are stored server-side in the app's
// database and never sent to the browser.
import { randomUUID } from "node:crypto";
import { MCPClient } from "@mastra/mcp";
import type { ToolsInput } from "@mastra/core/agent";
import type { McpServer } from "@/lib/shared/types";
import { getSetting, setSetting } from "./db";
import { InputError } from "./errors";
import { OPENLORE_SHELL_GUIDANCE } from "@/lib/shared/openlore-guidance";
import { readOnlyOpenLoreCall, recoverOpenLoreSession } from "@/lib/shared/openlore-recovery";

export interface StoredServer {
  kind?: "generic" | "openlore";
  verifiedIdentity?: string;
  verifiedCollections?: string;
  id: string;
  name: string;
  url: string;
  /** Sent as `Authorization: Bearer <token>`. */
  token?: string;
  /** Extra headers, e.g. a toolset filter. Values can be secret too. */
  headers?: Record<string, string>;
}

const KEY = "mcp.servers";

export async function stored(): Promise<StoredServer[]> {
  return (await getSetting<StoredServer[]>(KEY)) ?? [];
}

function toPublic(s: StoredServer): McpServer {
  return { id: s.id, name: s.name, kind: s.kind ?? "generic", url: s.url, hasToken: Boolean(s.token), headerNames: Object.keys(s.headers ?? {}) };
}

export async function listServers(): Promise<McpServer[]> {
  return (await stored()).map(toPublic);
}

/** Tool names are prefixed with the server key, so keep it short and safe. */
export function serverKey(id: string): string {
  return `mcp_${id}`;
}

function validate(input: { name?: string; url?: string }) {
  if (!input.name?.trim()) throw new InputError("Give the server a name.");
  try {
    const url = new URL(input.url ?? "");
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw new InputError("Use an https:// URL (http is only allowed for localhost).");
    }
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("That doesn't look like a URL.");
  }
}

export async function addServer(input: { name: string; url: string; token?: string; headers?: Record<string, string>; kind?: "generic" | "openlore" }): Promise<McpServer> {
  validate(input);
  const server: StoredServer = {
    id: randomUUID().slice(0, 6),
    kind: input.kind === "openlore" ? "openlore" : "generic",
    name: input.name.trim().slice(0, 40),
    url: input.url.trim(),
    token: input.token?.trim() || undefined,
    headers: Object.fromEntries(Object.entries(input.headers ?? {}).filter(([k, v]) => k.trim() && v.trim())),
  };
  await setSetting(KEY, [...(await stored()), server]);
  return toPublic(server);
}

export async function removeServer(id: string): Promise<void> {
  await setSetting(
    KEY,
    (await stored()).filter((s) => s.id !== id),
  );
}

function clientFor(servers: StoredServer[], id: string): MCPClient {
  return new MCPClient({
    id,
    timeout: 30_000,
    servers: Object.fromEntries(
      servers.map((s) => [
        serverKey(s.id),
        {
          url: new URL(s.url),
          requestInit: {
            headers: { ...(s.headers ?? {}), ...(s.token ? { Authorization: `Bearer ${s.token}` } : {}) },
          },
        },
      ]),
    ),
  });
}

/** Connect once and report how many tools the server offers. */
export async function testServer(id: string): Promise<{ tools: number; identity?: string; collections?: string }> {
  const server = (await stored()).find((s) => s.id === id);
  if (!server) throw new InputError("That server doesn't exist.");
  const client = clientFor([server], `test-${id}-${Date.now()}`);
  try {
    const inspected = server.kind === "openlore" ? await (await import("./openlore")).inspectOpenLore(server) : null;
    const tools = Object.keys(await client.listTools()).length;
    if (inspected) {
      await setSetting(KEY, (await stored()).map((s) => s.id === id ? { ...s, verifiedIdentity: inspected.identity, verifiedCollections: inspected.collections } : s));
      return { tools, ...inspected };
    }
    return { tools };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/** Tools from the given servers for one bot. The returned close() disconnects them. */
export async function mcpTools(ids: string[], clientId: string): Promise<{ tools: ToolsInput; close: () => Promise<void>; errors: string[] }> {
  const servers = (await stored()).filter((s) => ids.includes(s.id));
  if (servers.length === 0) return { tools: {}, close: async () => {}, errors: [] };
  const tools: ToolsInput = {};
  const errors: string[] = [];
  const clients: MCPClient[] = [];
  // One client per server, so one unreachable server doesn't take the others down.
  for (const server of servers) {
    const client = clientFor([server], `${clientId}-${server.id}`);
    clients.push(client);
    try {
      const connected = await client.listTools();
      if (server.kind === "openlore") {
        for (const [name, tool] of Object.entries(connected)) {
          if (name.endsWith("_shell")) tool.description = `${tool.description ?? ""}\n${OPENLORE_SHELL_GUIDANCE}`;
          if (!tool.execute) continue;
          tool.execute = recoverOpenLoreSession(
            tool.execute.bind(tool),
            () => client.reconnectServer(serverKey(server.id)),
            (input) => readOnlyOpenLoreCall(name, input),
          );
        }
      }
      Object.assign(tools, connected);
    } catch (error) {
      errors.push(`${server.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { tools, errors, close: async () => void (await Promise.all(clients.map((c) => c.disconnect().catch(() => {})))) };
}


/** Refresh a credential without changing the identity behind existing private conversations. */
export async function refreshServerToken(id: string, token: string): Promise<void> {
  if (typeof token !== "string" || !token.trim()) throw new InputError("Enter the new identity token.");
  const server = (await stored()).find((s) => s.id === id);
  if (!server || server.kind !== "openlore") throw new InputError("Choose an OpenLore connection.");
  if (!server.verifiedIdentity || !server.verifiedCollections) throw new InputError("Verify this connection first, or create a fresh connection and bot.");
  const next = { ...server, token: token.trim() };
  const { inspectOpenLore } = await import("./openlore");
  const inspected = await inspectOpenLore(next);
  if (inspected.identity !== server.verifiedIdentity || inspected.collections !== server.verifiedCollections) throw new InputError("The new token changes this connection's identity or permissions. Create a fresh bot for the new profile.");
  await setSetting(KEY, (await stored()).map((s) => s.id === id ? next : s));
}
