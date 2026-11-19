# Cloudlane v1.13 prototype correction

Status: implementation and rendered comparison in progress. This is not a claim of complete pixel or behavioral parity, and it is not an operational infrastructure release.

## Authority and provenance

- User-supplied original: `Cloudlane_Interactive_Prototype_v1.13 (1).html`.
- Immutable repository reference: `reference-cloudlane-v1.13.html`.
- Both are 307,135 bytes, SHA-256 `f94204ed5e52ae58a80deea46d4fe6edba6626d8b0e36005f6fb9d9765a68f6d`.
- Corrections follow the effective final override chain in that file, including v1.13 density/mobile rules, v1.10 palettes, v1.9 Add Domain, v1.8 DNS transitions and v1.7 storage.
- Review branch: `task/prototype-v1.13-parity`; [PR #3](https://github.com/amungadev-ai/server_manager/pull/3). The separate CL-005 security proposal is not merged by this change.

## Source-backed corrections

| Area | Previous mismatch | Correction |
| --- | --- | --- |
| Visual system | Recreated styles, different density and fonts | Original complete CSS cascade, exact SVG paths and locally bundled pinned fontsource 5.2.8 Latin faces |
| Navigation | Workspace switcher/counts and extra appearance/footer UI | Grouped v1.13 sidebar, brand, header, breadcrumbs and simulation label |
| Overview/projects | Invented fixtures and project-card content | Four projects, nine services, original metrics/activity/health, first three overview cards, exact compact project structure |
| Projects | Noninteractive service list and missing detail route | `/services/:id`, endpoint and Manage links, Services/Architecture/Storage views, suggested private relationships and bucket grants |
| Resource indexes | Unavailable placeholders | Database, cron, email, server and object-storage views from the original |
| Service details | Missing screens | Application nine tabs, database six, cron three and storage six; deployment history/logs, simulated terminal/SQL, variables, artifacts, volumes, buckets, object explorer and grants |
| Domains | Different gallery and incomplete tabs | Original metrics/gallery, seven domain sections, central hostname selection and DNS mode only in Settings |
| Settings | Appearance alone | Six settings tabs; original appearance matrix in Preferences, integrations, demo keys, security and external SSH guidance |
| Dialogs | Unavailable substitutes | Original create choices, inline project creation, ZIP/GitHub choices, resource forms, one-field Add Domain, staged DNS transition and scoped storage/database forms |
| Assistant | Centered modal | Original right drawer, contextual suggestions, review/approval/simulation, draggable bounded launcher and normalized UI preference |

## Deliberate implementation boundaries

These are implementation constraints, not accidental design changes:

- Dashboard remains Svelte 5 with static SvelteKit output. No iframe, injection of the reference application, legacy DOM event router or copied prototype runtime is used in the product.
- Every resource mutation is confined to the explicit demo build and in-memory preview model. Reload restores fixtures. The prototype's localStorage infrastructure and credential persistence is intentionally not reproduced; localStorage contains UI preferences only. Relevant explanatory copy says so.
- Production HTTP responses continue through validated contracts. No demo fallback, invented server telemetry or successful unimplemented mutation is supplied.
- Storage shows metadata only; no real KYC images, file preview/download, provider credentials or file bytes are retained. ZIP scanning is bounded, local central-directory inspection only; it is not the production extractor or builder.
- Database strings and API keys are conspicuously nonfunctional examples. Native dialog semantics, links, focus restoration, keyboard handling and accessible labels replace legacy nonsemantic clickable markup.
- Real owner auth, resource persistence, deployment agent, DNS publication, mail transport, database provisioning and provider integrations remain separate gates.

## Verification protocol

The local managed preview relay was unavailable. The existing connected GitHub Playwright runner is used to render both sources in the same pinned Chromium, viewport, locale, Nairobi timezone and fixed clock. The reference HTML is hash-checked; its original pinned fonts are fulfilled from the identical installed font package without modifying its HTML or styles.

`tests/e2e/prototype.spec.ts` captures 29 matching reference/app scenes per viewport and records measured bounding boxes, typography and colors. Screenshots are evidence, not self-approved app baselines. Primary shell geometry/colors are asserted against the reference. Separate tests exercise every detail tab, central-domain transitions, terminal/SQL denials, reload isolation, storage metadata and grants, fake key revocation, and assistant drag/approval.

Required checks: type/boundary/contract/progress checks, formatting, existing 46 unit/HTTP/progress tests, separate production/demo builds with fixture-exclusion checks, and actual desktop/mobile browser execution. Final run IDs and visual findings will be appended after the rendered comparison is reviewed.

## Initial verification

- Local `npm run check`: pass, zero Svelte errors/warnings.
- Local `npm test`: pass, 36 Node plus 10 Python tests.
- Local `npm run build`: pass; production output omits preview fixtures.
- First remote run `44464203685`: formatting gate rejected a test file exported while formatting was still running. Browser jobs correctly did not run; this run is not visual evidence. The export was corrected and will be rerun.
