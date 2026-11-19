# CL-005 design and regression evidence

Recorded 2026-11-19 (Africa/Nairobi). Scope: threat-model/ADR/review documents only. The parallel CL-004/006 correction changes CI policy and a browser test selector; CL-005 introduces no authentication, signature verification, installer, privileged execution or workload isolation code.

| Check | Actual result |
| --- | --- |
| Source/requirement review | Inspected canonical docs, CL-003 contracts, NestJS implementation, static dashboard boundaries, development Caddy config, existing negative tests and installer/agent placeholders |
| Threat traceability | T01–T18 each map to accountable backlog tasks and N01–N18 negative acceptance cases |
| New Markdown references | Local links in threat model, acceptance matrix and ADR-017 resolve |
| `npm run check` | PASS; types, generated drift, boundaries, CI policy, browser-test TypeScript and progress; Svelte 0 errors/warnings |
| `npm test` | PASS; 36 Node + 10 Python cases, zero failures/skips |
| `npm run lint` | PASS |
| `npm run build` through supported build helper | PASS; HTTP static output has 98 files, no demo fixtures/agent bundle or SSR runtime |
| `npm run build:preview` | PASS; explicit read-only demo output |
| `python3 scripts/validate_progress.py` | PASS |
| Hosted baseline regression | PASS; [run 44403166607](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607), 46 unit/HTTP/gate tests and 20 actual desktop/mobile browser cases; see `ci-hosted-checks.md` |
| New operational security tests N01–N18 | Planned; absent installer/auth/agent/DB/runtime features are not represented by passing placeholder tests |
| Independent security/cryptographic review | PENDING; no reviewer or approval fabricated |

The existing negative tests exercise strict API/agent structure, JSON/response limits, safe errors, caller-authority rejection, non-operational auth/deployment endpoints, module boundaries and CI gates. They do not verify real ownership/session/CSRF/MFA, command signatures/current time/replay, archive extraction, host isolation or restoration. The matrix documents precisely what each later task must prove.

`security-local/steps.json` retains successful local command/exit/time records from working-tree verification before handoff. `ci-hosted/` preserves actual hosted machine reports under their original source identity. The current design is based on import tree `ef1b3c8e13916dd56eb56cf8663339f605ba1c95`; source code reviewed for the security boundary has not gained operational features through this documentation work. Primary references and date consulted are in `docs/security/THREAT_MODEL.md`.
