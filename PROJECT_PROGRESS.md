# Cloudlane — integration progress

Recorded: 2026-11-19 (Africa/Nairobi). Foundation/CI is integrated; prototype and API/PostgreSQL foundations are ready for review in PR #3/#4; the isolated owner-auth candidate is prepared for independent review in PR #5. No production release, independent security approval or live resource operation is claimed.

| Area | Current state |
| --- | --- |
| Monorepo and toolchain | CL-001 integrated; pinned Node 24.22.3/npm 11.9.0 |
| Package boundaries and draft contracts | CL-002/003 implemented; review pending |
| CI and desktop/mobile harness | CL-004/006 integrated through PR #1; branch-protection administration remains outstanding |
| Prototype v1.13 parity | PR #3 corrects the Svelte rendering, screens, forms and sample state. Its required run passes 32 browser cases and 40 direct source screenshot comparisons. Resource actions remain simulated |
| API authorization foundation | CL-030/PR #4 adds global default-deny policy, a disabled session resolver, request-local server-derived context and safe readiness. It issues/accepts no owner sessions |
| PostgreSQL foundation | CL-031/PR #4 adds atomic checksummed migrations and installation/user/session/workspace/project/environment tables. Initial hosted SQL run passes 13 cases, with retained hashed reports. Corrected driver configuration passes 65 local unit/HTTP/progress cases; final combined checks/review are tracked by PR #4 |
| Security threat model | Separate draft PR #2; independent review remains pending |
| Owner claim and login | CL-032/033 isolated development candidate in PR #5; default API authentication remains disabled pending independent security review |
| MFA, auth UI and project CRUD | CL-034–036 remain later gates; no production auth, recovery or mutation is claimed |
| Installer, agent, pg-boss and real resources | Not implemented; no VPS, Docker, TLS, DNS, mail or storage operation is claimed |

The [private dashboard preview](https://cloudlane-foundation.spiritedghat4.chatgpt.site) hosts static Svelte output. It cannot host the separate Nest/PostgreSQL platform. Authentication and resource data are never persisted in browser localStorage; UI preferences only.

## Canonical review branches

- [PR #3: prototype fidelity](https://github.com/amungadev-ai/server_manager/pull/3), `task/prototype-v1.13-parity`, tested head `2aecfde1257cd317d18d242fb96e8c309a79c519`. Published Site source `92f39bb748a56bed6af727e0ecb02a76fa88602a`. [Audit](docs/evidence/PROTOTYPE_PARITY_V113.md).
- [PR #4: CL-030/031 API and persistence](https://github.com/amungadev-ai/server_manager/pull/4), `task/CL-030-031-api-persistence`, stacked on PR #3 to preserve the approved UI. Shared claim commit `4828c21c0cf66b6676ec8aee89e4772b1055434e`. [Batch evidence](docs/evidence/API_PERSISTENCE_BATCH.md), [ADR-018](docs/adr/018-api-persistence-foundations.md) and canonical task records contain exact checks/limits. Final PR checks identify the actual tested implementation head.
- [PR #2: security proposal](https://github.com/amungadev-ai/server_manager/pull/2), `task/CL-005-security-threat-model`, remains a separate draft. Its protocol/crypto decisions have not been approved or silently merged into the backend branch.

## Earlier integration evidence

CL-002/003 implementation checkpoint: `2444ea50b2490f3081649d1be02ee28255f201aa`, with its original 31-test evidence in `evidence/contracts-checks.md`.

CL-004/006 integrated through [PR #1](https://github.com/amungadev-ai/server_manager/pull/1), main `104c0974434221e9385bcd336ed5a3daab5ac9e1`, matching tested branch tree `704bac37300715d12b570a44859c0a85116fbdbf`. [Run 44432013149](https://github.com/amungadev-ai/server_manager/actions/runs/44432013149) passed five jobs, 46 unit/HTTP/progress tests and 20 browser cases. That evidence remains scoped to its source. Branch protection is an administrator handoff; no enforcement is claimed.

The prototype batch later passed [run 44476534033](https://github.com/amungadev-ai/server_manager/actions/runs/44476534033): all required jobs, 46 unit/HTTP/progress tests, 32 actual browser cases and 40 direct source screenshot comparisons. Tests load the immutable source HTML with pinned fonts/clock/viewport; no app-generated expected baseline is used. Existing source contrast debt and intentional accessibility/session-memory differences remain documented.

## Next gate

PR #4 passes all six required jobs in run 44490126404 (65 unit/HTTP/progress, 13 PostgreSQL, 32 browser and 40 prototype comparisons). Review the CL-032/033 candidate and ADR-019 in PR #5 using its actual PostgreSQL/HTTPS evidence; resolve CL-005 independently before activation. Project mutation requires CL-036 workspace authorization tests. Production acceptance still needs installation, role provisioning, trusted TLS, backup/restore, agent and VPS evidence. Task states are not promoted to merged/verified by scaffolding or preview publication.

## Owner authentication review candidate

[PR #5](https://github.com/amungadev-ai/server_manager/pull/5), branch `task/CL-032-033-owner-auth-review`, is stacked on PR #4. It implements a concrete claim/login/session development candidate under [ADR-019](docs/adr/019-owner-auth-review-profile.md). [Evidence](docs/evidence/OWNER_AUTH_REVIEW.md) and canonical task records distinguish local/hosted checks from outstanding independent review, MFA, installer/Caddy/TLS and production-VPS gates. The normal API entry point exposes no switch to activate the candidate.

The CL-032/033 implementation checkpoint `30e611aa238a6b781c234be18b611c82d0e197f6` passes all six jobs in [run 44534915294](https://github.com/amungadev-ai/server_manager/actions/runs/44534915294): 72 unit/HTTP/progress, 34 real PostgreSQL/HTTPS, 32 browser and 40 source screenshot comparisons. [Retained evidence](evidence/owner-auth/README.md) verifies source and artifact hashes. Independent review and production activation remain open.
