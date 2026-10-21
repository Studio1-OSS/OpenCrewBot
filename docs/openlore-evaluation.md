# OpenLore integration: observed evaluation

These notes summarize prior local execution against synthetic project knowledge with real Nebius Qwen model calls. Raw provider/model/tool traces, timestamped probes, credentials and machine-specific runtime data remain in the original local evidence store and are excluded from this pull request. The notes are a report of those observations, not a newly executed test result for this PR checkout or an independently reproducible benchmark dataset.

## Functional workflow

Local checks exercised separate frontend/backend/research identities, credential-resolved collection discovery, shared contract retrieval, denied private reads, rejected shared writes, contribution publication and explicit maintainer promotion. Native Codex and Claude Code integration checks used separate scoped identities and their own provider accounts; they are not counted as Nebius turns.

The browser showed the frontend identity and grants in Team Memory, successfully read shared contract v2, and failed to read a backend-only note. The note was separately verified with an authorized backend identity. Access boundaries were also checked before room admission and turns, including after connection removal. Distinct identities with equivalent grants could share a room.

## Completed two-hour observation

Run `20261019T060837Z-d20b`, October 19, 2026:

- 7,200.0 measured seconds; 361 timestamped probes spanning 7,191.87 seconds, within a 20-second sampling interval of both endpoints.
- Maximum normal gap 20.06 seconds; no gaps over 90 seconds.
- Zero unexpected probe failures, stale probe reads or private-marker disclosures. Two failed probes occurred during an intentional service outage.
- 45 completed real Nebius Qwen agent turns.
- **74 checks passed; one failed. The original overall verdict remains false.**

Initial fact accuracy was OpenLore 10/10, personal `MEMORY.md` 4/10, and no-memory 0/10. Continuing fresh retrieval was 10/11. The personal file started with the same permitted corpus, was not automatically updated after remote changes, and was manually refreshed before the final round. Its six stale answers measure that synchronization workflow; they do not establish an intrinsic accuracy advantage over a current file.

Comparison-turn median/max latency was 12.90/73.69 seconds for OpenLore, 4.65/20.52 seconds for personal memory and 4.66/19.52 seconds for no memory. Direct three-operation probes were much smaller operations (empirical p50/p95 20.07/31.06 ms); these are not equivalent performance comparisons. Provider token/cost telemetry was unavailable, regardless of UI zeros.

Expired credentials, rejected writes, concurrent-write rejection/reread recovery, writer attribution, persistence and real model retrieval after a planned service restart were exercised. Successful continuing answers cited the approved source. Fresh sessions used the app's clear/generation mechanism; raw provider thread IDs were not exported. Scope checks provide local evidence, not a claim of production containment.

## Failures and corrections retained

- An initial blind pilot guessed nonexistent `/docs` paths. The connector now supplies credential-resolved roots.
- A startup helper raced OpenLore's approximately 25-second shutdown drain while SSH remained bound. The helper now waits for actual process exit.
- Cached MCP sessions failed after restart. The client now reconnects the exact observed missing-session error, retries simple reads once, and avoids automatic mutation replay. A separate real Qwen restart check passed.
- The measured two-hour retrieval failure began with an overly narrow same-line search. The original evaluator blocked its read-only `find -exec` fallback. Independent replay showed that OpenLore does not support `-exec`; an initial guided recovery also mishandled multiple roots passed to `tree` and falsely inferred absence.
- Guidance now explains those virtual-shell limits and broader scoped searches. Separate post-guidance blind sessions passed 3/3, and an unsupported-command recovery passed. The original measured worker was not restarted or hot-patched, and its failed check remains failed. Earlier unsuccessful retests are retained locally.

The parser and recovery regression files in this PR are pre-existing work from that local integration effort. They have not been rerun in the isolated PR checkout. Prior typecheck, lint and production-build checks passed in the local implementation; that historical result does not replace running checks on the final PR branch.

## Eight-hour observation is incomplete

An initial overnight attempt was interrupted by laptop sleep/DNS failures and a provider credential subsequently returning HTTP 401. Only six direct successful probes and zero completed original model turns were recorded; gaps were approximately 815 and 954 seconds. It is not eight-hour reliability evidence.

That attempt exposed a harness attribution false positive: old history matched despite the current writer failing. Its original assertion is explicitly invalid. The local scorer was corrected to require a completed writer, a unique current decision, a new attributed commit and exact readback hash. Harness code and raw campaign artifacts are outside this focused integration PR.

A replacement provider credential then passed a separate fresh MCP read and independently attributed write. A later retry was deliberately stopped before laptop closure: 850.1 measured seconds, 18 completed model turns and 30 probes. That was an operator interruption, not an OpenLore outage. The campaign remains awaiting an explicit user resume. **No full eight-hour completion is claimed.**

## Reproduction boundary

The included minimal setup can reproduce the functional scoped-knowledge workflow. It does not launch the historical endurance campaign, silently reuse its duration, or ship its local credentials/chats. Review untrusted proposed text before promotion; access control and citations do not guarantee hallucination-free generation.
