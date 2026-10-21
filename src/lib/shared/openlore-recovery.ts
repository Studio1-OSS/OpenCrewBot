/** Recognize the observed pre-execution transport rejection, never a command failure. */
export function lostOpenLoreSession(error: unknown): boolean {
  return error instanceof Error && /^Error POSTing to endpoint:\s*session not found\s*$/i.test(error.message);
}

/** Conservative replay policy: one simple read or metadata request, no shell composition. */
export function readOnlyOpenLoreCall(name: string, input: unknown): boolean {
  if (name.endsWith("_list_commands")) return true;
  if (!name.endsWith("_shell") || !input || typeof input !== "object") return false;
  const command = (input as { command?: unknown }).command;
  if (typeof command !== "string" || /[;|&<>`\n\r]|\$\(/.test(command)) return false;
  return /^(?:whoami|pwd|ls|tree|cat|head|grep)(?:\s|$)/.test(command.trim()) || /^lore\s+docsets\s*$/.test(command.trim());
}

export function recoverOpenLoreSession<Args extends unknown[], Result>(
  execute: (...args: Args) => Promise<Result>,
  reconnect: () => Promise<void>,
  canReplay: (input: Args[0]) => boolean,
): (...args: Args) => Promise<Result> {
  return async (...args) => {
    try { return await execute(...args); }
    catch (error) {
      if (!lostOpenLoreSession(error)) throw error;
      await reconnect();
      if (!canReplay(args[0])) {
        throw new Error("OpenLore session was lost and has been reconnected. The operation was not replayed. Read the current document, reconcile any changes, then request the write again.");
      }
      // A second failure is surfaced directly; never enter a retry loop.
      return execute(...args);
    }
  };
}
