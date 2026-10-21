import type { OpenLoreResult } from "./types";

/** MCP transport success and shell command success are independent. */
export function openLoreResult(value: unknown): OpenLoreResult | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.exit_code === "number") {
    return { exit_code: r.exit_code, stdout: String(r.stdout ?? r.output ?? ""), stderr: String(r.stderr ?? "") };
  }
  for (const key of ["structuredContent", "result", "output", "toolResult"]) {
    const nested = openLoreResult(r[key]);
    if (nested) return nested;
  }
  if (Array.isArray(r.content)) {
    for (const block of r.content) {
      if (typeof block?.text !== "string") continue;
      try { const nested = openLoreResult(JSON.parse(block.text)); if (nested) return nested; } catch { /* Plain text MCP content. */ }
    }
  }
  return null;
}
