# CL-034/035 — mandatory MFA and authentication screens

2026-11-19 (Africa/Nairobi). [PR #6](https://github.com/amungadev-ai/server_manager/pull/6) is stacked on PR #5. [ADR-020](../adr/020-mfa-recovery-and-auth-ui.md) supersedes password-only development sessions. Independent security review remains open; normal authentication stays disabled.

The candidate adds password-only challenges, encrypted TOTP enrollment, monotonic code replay checks, acknowledgement of ten once-displayed recovery codes, atomic code consumption, critical epoch/family revocation and password+fresh-TOTP regeneration. Separate Svelte auth routes preserve dashboard markup and immutable prototype CSS. HTTP/unconfigured installations reject secret entry; the static demo accepts only a read-only synthetic walkthrough. No password/seed/code/CSRF enters browser storage or URLs; QR generation stays local.

Local root recovery is a documented installer contract only. No working root recovery command, public reset, real infrastructure, Caddy/public CA, trusted proxy, key custody/rotation or backup/restore acceptance is claimed.

## Verification checkpoint

PASS local npm run check (0 Svelte errors/warnings), npm test (70 Node + 10 Python), supported HTTP build, npm run build:preview, progress validation and diff whitespace checks. [Run 44551355426](https://github.com/amungadev-ai/server_manager/actions/runs/44551355426) passes all six jobs for implementation checkpoint `a60d11bf9ebc7a5783fed3688da022dd4e930a02`: 80 unit/HTTP/progress cases, 46 real PostgreSQL/HTTPS cases, 44 actual browser cases and 40 direct prototype screenshot comparisons. Both browser projects pass all 22 cases without retries. [Retained evidence](../../evidence/mfa-auth/README.md) binds reports to the tested head/tree, archive digests and file hashes. Final PR checks cover the later evidence/hand-off and token-replay test improvement.

The hosted PostgreSQL suite uses real PostgreSQL and Node HTTPS with an explicitly trusted isolated certificate. Browser auth cases use a virtual HTTPS route-fulfillment contract fixture and real rendered Svelte UI; this proves UI requests/states and is explicitly **not** browser-to-PostgreSQL/public-TLS evidence. Existing desktop/mobile prototype comparisons continue against the immutable supplied HTML.

## Release gates

Independent CL-005/ADR-019/020 security review; installer/root recovery and encryption-key custody; actual trusted Caddy/IP/domain TLS; operational database roles; backups and key restore; real deployment/agent/VPS acceptance remain outstanding. CL-036 authenticated project CRUD is the next bounded feature batch after review of this candidate.
