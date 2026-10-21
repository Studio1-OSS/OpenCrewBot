# OpenLore Team Memory

OpenLore is an optional shared knowledge service. Each connected bot uses an OpenLore identity with its own collection grants. Personal `MEMORY.md` remains the bot's local notes; it is not synchronized with shared documents.

## What is included

- An OpenLore preset in Connections, with credential-resolved identity and collection checks.
- Per-bot assignment of OpenLore connections using the existing MCP connection picker.
- A Team memory inspector showing the selected bot's identity, grants, permitted Markdown documents, document reads and recent command outcomes.
- Agent instructions containing actual accessible collection roots. Document contents are retrieved on demand, through MCP.
- Structured command-result handling: a nonzero OpenLore `exit_code` displays as a failure even when the MCP transport succeeds.
- Recovery for the observed missing-session transport error: reconnect and replay one simple read/metadata request once. Writes and shell compositions are not replayed automatically.
- Server-computed bot and room access boundaries, intended to prevent earlier private conversation context from being reused after a change of collection grants.
- Credential rotation that checks the replacement token's identity and grants against the connection's verified profile.

The inspector's metadata/document requests use OpenLore's authenticated HTTP shell endpoint. Agent tool calls use MCP. Both use the credential assigned to that connection; browser responses do not include tokens.

## Connect an existing OpenLore service

1. Provision separate identities and collection grants in OpenLore. This integration was exercised with OpenLore **v0.7.5**.
2. In OpenCrewBot, open **Connections → Add an MCP server → Use OpenLore preset**.
3. Set the actual service's `/mcp` URL and the bot identity's bearer token. The default preset is `http://localhost:48080/mcp`.
4. The connection test resolves `whoami`, `lore docsets` and MCP tools. Resolve any authentication or endpoint error before using the bot.
5. Assign the connection in the bot's **Details**. Use a separate connection/token per identity. Never assign the maintainer credential to a model.
6. Open **Team memory**, inspect the displayed identity and collections, then read an actual returned path. Ask the bot to retrieve a project fact and cite its source.

Connection credentials stay in OpenCrewBot's server-side application settings. Protect and back up its local data directory as sensitive storage. The existing loopback/local-operator application security model remains in effect.

## Reproduce the local synthetic example

Requirements: the application's existing Node/pnpm requirements, Python 3, `curl`, `tar`, and `ssh-keygen`. Use a real `NEBIUS_API_KEY` in ignored `.env.local` for actual model calls. Without it the application's existing mock mode is not evidence of a real provider or retrieval run.

```sh
pnpm install
python3 showcase/manage.py setup
python3 showcase/manage.py start
# Start OpenCrewBot on the seed helper's default app port:
pnpm dev --port 3300
# In another terminal:
python3 showcase/seed.py
```

`setup` downloads checksum-verified OpenLore v0.7.5, generates local SSH keys and 24-hour tokens, and configures six identities. The helper stores credentials under ignored `showcase/runtime/` (directory mode 0700; token files 0600). Binaries remain under ignored `.local/`. OpenLore uses HTTP/MCP port **48080** and SSH port **42222**. Keep those service ports on a trusted host/network; this example is not an Internet deployment configuration.

The seed helper creates three bots and separate rooms through the real application API. It does not make provider requests. Override the application address with `OPENCREWBOT_SHOWCASE_URL` if needed. Rerunning setup preserves existing knowledge; rerunning seed preserves existing demo bots and refreshes their credentials when the verified identity/grants match.

| Identity role | `/shared` | Own team collection | Other team collection | `/contributions` |
|---|---|---|---|---|
| Frontend | Read | `/frontend`: read/write | Denied | Publish |
| Backend | Read | `/backend`: read/write | Denied | Publish |
| Research | Read | None | Denied | Publish |
| Maintainer | Read/write | Read/write | Read/write | Read/write |

OpenLore `publish` grants are not a private draft store: contributors can read the shared contribution collection. Submit only material appropriate for that audience. Keep private investigation notes in the team collection.

### Example handoff

1. Ask Frontend Engineer to read `/shared/api-contract.md`. Ask it to read `/backend/incident-note.md`; that read should fail under the frontend identity. A scoped not-found result does not prove global absence.
2. Ask Backend Engineer to read its architecture and save a team decision to `/backend/upgrade-decision.md`.
3. Ask Research Contributor to submit customer-safe contract changes using `publish /contributions/api-contract-v2.md`. The example uses a deliberately prepared synthetic candidate; the helper does not establish that an arbitrary proposal is safe.
4. As the local operator, inspect and explicitly promote the proposal:

   ```sh
   python3 showcase/manage.py review
   # Run only after reviewing the candidate:
   python3 showcase/manage.py promote
   ```

5. Ask the frontend bot in a fresh conversation to retrieve `/shared/api-contract.md` again. The updated resolution is shared through OpenLore, without copying the backend conversation.

Promotion is an explicit local helper operation using the maintainer identity. This integration does not implement a native OpenLore nominated-review API. Normal setup never resets the shared contract; the separate `reset-contract` command is an explicit synthetic replay operation.

Stop the owned example service with `python3 showcase/manage.py stop`. It waits for process exit because OpenLore may drain while still holding its SSH listener. Do not run setup, seed or promotion against an active local evaluation without reviewing its state first.

## Existing installations and permission changes

No additional npm dependency is introduced. The local database adds `team_memory_operations` through its existing additive schema initialization. Existing MCP connections default to generic behavior. To enable OpenLore-specific handling, create an OpenLore connection using the preset and assign it to a suitable bot.

Use new bots and new team rooms when changing access profiles. Bots with a pinned Team Memory boundary refuse changes that would reuse their previous private context under different grants. Rooms require equivalent effective grants; distinct identities with matching grants may share a room. Existing rooms without a stored boundary are treated as unscoped, so create a new room for the scoped bots. An unreachable service or changed scope can block a turn until the connection is repaired.

After an identity token expires, rerun the example setup and seed helpers, or use **Refresh token** on a verified connection. Rotation requires the same resolved identity and permissions. A different identity/access profile needs a new connection and bot. Removing a connection does not erase the bot's pinned conversation boundary.

## Discovery and recovery

OpenLore v0.7.5 exposes a limited virtual shell. The model receives guidance to discover real roots, use one root per `tree` call, broaden empty searches and avoid unsupported `find -exec`. Narrow phrase searches can miss terms split across lines. A failed search is not evidence that a fact does not exist.

A lost MCP session is reconnected only for the exact observed missing-session transport error. Simple reads can retry once. After a write failure, inspect document contents/history and reconcile before requesting a new write. Authentication failures and ordinary command rejections are surfaced directly.

## Evaluation and scope

See [observed evaluation and retained limitations](openlore-evaluation.md). The existing parser/session-recovery regression sources are included; run them explicitly with `pnpm test:openlore`.

This remains a trusted local-operator application, not production multiuser isolation, adversarial model containment or general DLP. The owner can inspect all bots. Retrieved knowledge and proposed contributions can contain private text; scope controls do not revoke information already copied into an allowed document. Operation previews and conversations are local data requiring appropriate protection.
