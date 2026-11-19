# Cloudlane

Foundation and API-contract implementation from the Cloudlane v2.1 guide and approved v1.13 interface. Svelte 5/SvelteKit compiles to static assets; NestJS owns the same-origin API. This is a development foundation, not an installed hosting platform.

## Run locally

Use Node **24.22.3**, npm **11.9.0**, and Python 3.10+.

```bash
npm ci
npm run check
npm test
npm run build
npm run dev
```

`npm run dev` serves read-only design fixtures. Project/domain search, navigation, native dialogs, and five light/dark palettes work. Reserved example domains and all server figures are synthetic. Creation, provisioning, terminal access, auth and deployment are unavailable.

Start the real API skeleton in a second terminal:

```bash
npm run dev:api
```

It binds to `127.0.0.1:3001`. `GET /api/v1/health` checks API liveness; `GET /api/v1/installation/status` truthfully reports an unconfigured installation. Declared auth and resource endpoints validate syntax, then return `501 NOT_IMPLEMENTED`, with no fake credentials, sessions, writes or queue success. Invalid requests return bounded, redacted JSON errors. Unknown routes return 404.

## Build modes

| Command | Dashboard data | Output |
| --- | --- | --- |
| `npm run build` | Same-origin HTTP API; no fixture fallback | `dist/` |
| `npm run build:preview` | Explicit read-only synthetic design fixtures | `dist/` |
| `npm run build:api` | Real NestJS liveness/unconfigured API | `apps/api/dist/` |

Both dashboard modes are fully static. No production SvelteKit SSR process is required. The HTTP build requests the server-owned session before workspace data and displays a connection error on failure. Only appearance preferences are persisted in localStorage. The design preview is hosted separately from the future VPS control plane.

`deploy/Caddyfile.dev` shows local same-origin API routing before dashboard fallback. It is not a production TLS or installer configuration. Never route API failures to `index.html`.

## Layout and progress

- `apps/dashboard/`: typed components, routes, isolated demo/HTTP adapters.
- `apps/api/`: NestJS scaffold and HTTP integration tests.
- `packages/contracts/`: portable runtime schemas, generated OpenAPI/client types, separate agent schema and preview types.
- `tools/contract-generator/`: isolated supported compiler/tooling for schema generation.
- `docs/adr/`: implementation decisions and review process; `docs/PACKAGE_BOUNDARIES.md` declares enforced dependency rules.
- `packages/design-tokens/`: approved palette values extracted from the reference.
- `docs/`: the original guide chapters and scoped foundation decisions.
- `tasks/progress/`: canonical checkpoint for every backlog ID.
- `agent/`, `installer/`: reserved scope documentation; no privileged implementation.

```bash
python3 scripts/taskboard.py list
python3 scripts/taskboard.py resume CL-001
python3 scripts/validate_progress.py --base origin/main
```

The progress gate is tested against a temporary Git repository: it rejects an implementation commit lacking a task checkpoint. The workflow under `.github/workflows/ci.yml` is ready for a GitHub remote; it has not been run by GitHub here. Configure branch protection and a reviewer on your chosen shared remote.

## Contracts and API reference

```bash
npm run contracts:generate
npm run contracts:check
npm run check:boundaries
npm run dev:api
```

The local NestJS API serves documentation at `http://127.0.0.1:3001/api/v1/docs` and OpenAPI JSON at `/api/v1/openapi.json`. The static preview host does not run NestJS. Swagger request submission is disabled. `x-cloudlane-implementation` labels implemented health/status endpoints and unavailable declared routes. Planned 200/201/202 schemas do not mean those operations currently succeed.

Generated files are committed at `packages/contracts/openapi/cloudlane.v1.json`, `packages/contracts/src/generated/http.ts` and `packages/contracts/schema/agent-*.v1.json`. Generation validates OpenAPI and check-only mode fails on drift without rewriting files. The HTTP dashboard consumes generated response types and validates session/overview/error JSON at runtime, with bounded response bytes and no fixture fallback.

Project/domain create bodies cannot supply owner/workspace authority. Domain creation accepts exactly one name field. UUID v4 IDs, pagination bounds, retry-key headers, unknown-field rejection and safe error envelopes are declared and tested. Real ownership, authorization, sessions, CSRF, password policy and idempotency persistence remain later implementation/security tasks.

The agent schema is independently versioned and has no execution path. Parsing it does not verify its signature, current-time expiry, replay, authorization or resource ownership. Those controls require CL-005/052 review before a real agent can run.

## Next work

CL-001 is integrated with reproducible checks. CL-002/003 add package/ADR/review conventions and the validated draft API contract; see their canonical task records for final evidence and review state. Independent review, full visual/mobile/a11y certification and effective branch protection remain open. Actual hosted CI, browser runs and report uploads are documented in the CI evidence.

CL-004/006 hosted activation is tracked in [CI evidence](evidence/ci-hosted-checks.md). CL-005's [threat model](docs/security/THREAT_MODEL.md), [security acceptance matrix](docs/security/SECURITY_ACCEPTANCE.md) and [ADR-017](docs/adr/017-security-boundaries.md) are review proposals; independent security approval and downstream operational tests remain open. CL-030 (API authorization skeleton) is the next implementation task. PostgreSQL migrations (CL-031) precede secure claim/session/MFA and authenticated project writes. A disposable supported VPS is needed for installer, IP HTTPS and actual ZIP deployment verification. See `docs/15-FIRST_VERTICAL_SLICE.md`.

## CI and desktop/mobile harness

CL-004/006 add read-only CI gates, structured unit reports and a Chromium harness with 1440×900 desktop and 390×844 mobile projects. The harness covers demo, typed HTTP fixtures and the real unconfigured API; it does not authenticate a real owner or deploy infrastructure.

```bash
npm run test:ci
npm run check:ci
npm run check:e2e
npm run test:e2e:prepare
npm run test:e2e:list
```

`--list` proves discovery only and clears stale browser evidence. Actual browser runs require a supported runner/workstation: `npm run test:e2e:ci -- --project desktop` and `--project mobile`, followed by their browser-evidence checks. The workflow installs its pinned Chromium only on CI and uploads JUnit, HTML/JSON, screenshots, failure traces and source/lockfile manifests. No browser is installed or launched to work around an unavailable managed preview relay.

The user-selected GitHub target is [amungadev-ai/server_manager](https://github.com/amungadev-ai/server_manager). Hosted runs and report uploads are recorded in [CI evidence](evidence/ci-hosted-checks.md); the canonical task records contain current repeatability/integration state. Branch protection is unapplied because the integration lacks administration access; a concrete settings payload and administrator command are prepared. See `docs/CI_AND_TESTING.md` for fixture/evidence boundaries and activation checks, and `docs/CI_ACTION_PINS.md` for verified immutable action references. The hosted design preview keeps its owner-only audience.
