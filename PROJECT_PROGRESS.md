# Cloudlane — integration progress

Recorded: 2026-11-24 (Africa/Nairobi). Foundation/CI is integrated; prototype and API/PostgreSQL foundations are ready for review in PR #3/#4; the owner-auth/MFA candidates are prepared for independent review in PR #5/#6. No production release, independent security approval or live resource operation is claimed.

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
| MFA and authentication screens | CL-034/035 implementation candidate in PR #6; normal activation and independent security review remain gated |
| Authenticated project metadata | CL-036 development candidate in PR #7; scoped persistence in the review profile, normal activation disabled |
| Installer preparation | CL-080 / PR #8 preflight/offline verification; CL-081 / PR #9 adds durable journal, owned-resource resume/repair and an isolated component installation candidate. Native boot, release trust and public activation remain gated |
| Agent, pg-boss and real resources | Not implemented; no VPS, Docker, TLS, DNS, mail or storage operation is claimed |

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

## MFA and authentication UI development batch

[PR #6](https://github.com/amungadev-ai/server_manager/pull/6), branch `task/CL-034-035-mfa-auth-screens`, is stacked on PR #5. CL-034/035 now have an implementation candidate: mandatory encrypted TOTP, once-displayed single-use recovery codes, challenge/CSRF/epoch/session revocation and separate `/setup`, `/login`, `/recover`, `/auth/security` screens. [ADR-020](docs/adr/020-mfa-recovery-and-auth-ui.md) and [evidence](docs/evidence/MFA_AUTH_UI_REVIEW.md) record the exact checks and limits. Password-only review sessions are superseded. The dashboard stays faithful to the supplied prototype; the Site auth flow is explicitly a read-only synthetic walkthrough. Local root recovery remains contract-only. Independent security review and production activation remain open; CL-036 authenticated project CRUD is the next feature batch.

## Authenticated project metadata development batch

CL-036 / [PR #7](https://github.com/amungadev-ai/server_manager/pull/7), branch `task/CL-036-authenticated-projects`, is stacked on PR #6. It adds transactional project plus production-environment metadata, durable idempotency, scoped list/detail/cursors and an honest project-only overview. HTTP project screens use the API, preserve prototype styling and handle ambiguous retries without duplicate success claims. The static Site remains a simulation. [ADR-021](docs/adr/021-authenticated-project-metadata.md), [evidence](docs/evidence/AUTHENTICATED_PROJECTS.md) and the canonical task record identify actual checks. Normal authentication, independent security approval, workload provisioning and production activation remain closed. Installer preflight/design (CL-080) is the next bounded backlog area; review dependencies before executing host work.

Validated on 2026-11-23 (Africa/Nairobi): implementation checkpoint `e5a314e03ba1ea03a9a100825fabb5925c08dc21` passes all six jobs in [run 44701008424](https://github.com/amungadev-ai/server_manager/actions/runs/44701008424): 87 unit/HTTP/progress, 58 PostgreSQL/HTTPS, 54 actual browser cases and 40 direct prototype comparisons. [Retained reports](evidence/projects/README.md) preserve tested source/tree and artifact/file hashes. Final PR checks cover the later evidence-only handoff. Independent security review and production activation remain open.

## Installer preparation development batch

CL-080 / [PR #8](https://github.com/amungadev-ai/server_manager/pull/8), branch `task/CL-080-installer-preflight`, is stacked on PR #7. [ADR-022](docs/adr/022-installer-preflight-and-release-trust.md) and [installer instructions](installer/README.md) define read-only diagnostics, existing-state preservation and independently anchored exact-version local artifact verification. No installation/service/network mutation, production signing key, authenticated bootstrap, agent or UI change is included. The required installer job runs Go race tests, vet, format, reproducible builds and actual host diagnostics. Independent CL-005 review, publisher operations and dedicated-VPS acceptance remain pending; CL-081 is the next installation implementation batch. Exact results belong to the canonical CL-080 record and batch evidence.

Validated on 2026-11-23 (Africa/Nairobi): CL-080 implementation head `4c1d78c72cb847f8e6e6171b87915b30c2b708be` passes all 7 required jobs in [run 45166802363](https://github.com/amungadev-ai/server_manager/actions/runs/45166802363): 88 unit/HTTP/progress, 58 PostgreSQL/HTTPS, 24 Go tests plus 107 subtests, 54 actual browser cases and 40 prototype comparisons. [Retained reports](evidence/installer/README.md) bind source/tree and archive/file hashes. Independent review and all operational installer/release/VPS gates remain open.

## Restartable installer development batch

CL-081 / [PR #9](https://github.com/amungadev-ai/server_manager/pull/9), branch `task/CL-081-installer-journal`, is stacked on PR #8. [ADR-023](docs/adr/023-restartable-platform-installation.md) and [batch evidence](docs/evidence/INSTALLER_JOURNAL.md) describe signed plans, protected atomic journal/secrets, identity-preserving retries/repair and real isolated Docker component startup. Only a host-loopback review endpoint is published. Systemd definitions are staged and checked offline, not enabled on the host. The mandatory live platform job covers real PostgreSQL/Caddy/API/static behavior; local Go evidence does not substitute for it. Independent security/publisher review, dedicated-VPS bootstrap/boot/reboot, trusted IP TLS/renewal and owner-claim/agent identity remain open. The prototype and normal default-deny API are unchanged.
