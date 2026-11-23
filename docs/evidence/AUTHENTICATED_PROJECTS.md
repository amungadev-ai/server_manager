# CL-036 — authenticated project metadata

2026-11-19 (Africa/Nairobi). [PR #7](https://github.com/amungadev-ai/server_manager/pull/7) is stacked on the tested MFA candidate in PR #6. [ADR-021](../adr/021-authenticated-project-metadata.md) records the scoped design. Normal authentication/production activation remain disabled.

The development profile creates project plus production-environment metadata atomically, with a durable workspace/user retry key and transaction-bound success audit. Scoped list/detail/position markers and overview metadata use the server session workspace. Transactions recheck installation/user/MFA/family/session authority and serialize against rotation/logout/recovery. No agent call, workload, service, domain, DNS or server metric is created.

The existing HTTP project form and list use same-origin HTTPS, session CSRF, bounded typed responses, memory-only retry state and explicit uncertain-result handling. Demo/prototype state remains separate. The static Site cannot run the separate Nest/PostgreSQL server and keeps simulated resource operations.

## Verification checkpoint

Validated 2026-11-23 (Africa/Nairobi). PASS local type/Svelte/contract/progress/whitespace checks, 77 Node + 10 Python cases, and supported HTTP/demo builds. [Run 44701008424](https://github.com/amungadev-ai/server_manager/actions/runs/44701008424) passes all six jobs for implementation checkpoint `e5a314e03ba1ea03a9a100825fabb5925c08dc21`: 87 unit/HTTP/progress, 58 real PostgreSQL/HTTPS, 54 actual browser cases and 40 direct prototype comparisons. Desktop and mobile each pass 27 cases without retries, including all ten palette/theme form checks. [Retained evidence](../../evidence/projects/README.md) binds the reports to tested source/tree and archive/file hashes. Final PR checks cover the subsequent evidence-only handoff; no independent security approval is inferred.

Real SQL cases cover durable restart, atomic rollback, same-key concurrency, body conflict, workspace/ID/cursor/key isolation, microsecond/tie ordering, mutation/boundary/CSRF/MFA checks, authority rechecks and logout serialization. Browser contract fixtures render actual Svelte forms/list/retry/error/loading/reload states. They are explicitly synthetic route fulfillment, not real public-CA/browser-to-database evidence. Existing immutable-reference prototype comparisons stay required.

## Outstanding gates

Independent CL-005/ADR-019/020/021 security review; merge/integration approval; operational installer/root recovery, key custody/restore, trusted Caddy/IP/domain TLS, database roles, backups and agent/VPS acceptance. Project metadata does not close any provisioning or production gate. CL-080 preflight/installer design is the next bounded backlog area.
