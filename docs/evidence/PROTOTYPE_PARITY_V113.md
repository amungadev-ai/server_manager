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
- Remote runs `44464203685` and `44469363900`: formatting gates rejected a test method chain. The pinned formatter required a second normalization pass; the chain was normalized and its output checked again. Browser jobs correctly did not run; these runs are not visual evidence.

## First rendered findings (run 44469649364)

- 13 of 16 browser cases passed per viewport. Navigation/reload, all 37 detail tabs, domain binding/DNS staging, terminal/SQL denials, storage metadata, resource reset and assistant drag/approval exercised actual Chromium.
- The capture reached 26 paired scenes per viewport. The final three were blocked by a too-narrow accessible-name locator for the quick action; the capture now selects its full accessible name. The key-dismiss test also needed to distinguish the content action from the toast dismiss button. These were harness locator failures.
- Reference font requests were aborted because npm installed the pinned fonts in the dashboard workspace rather than root node_modules. The harness now resolves from the dashboard package and explicitly requires all six font faces to load. Initial fallback-font screenshots are diagnostic evidence, not an accepted parity baseline.
- Original rendered application overview stacks Source control and Health & networking below the deployment area; the Svelte layout is being aligned to that rendered arrangement. Dialog overlay color/spacing and text-vs-SVG arrow differences were also corrected.
- The original teal/white primary-button palette has an inherited 3.74:1 contrast issue. This correction preserves the approved palette. Accessibility verification now compares the original and the app, records both full axe reports, permits only the same source color-contrast debt and rejects new serious/critical violations. This is not an AA-compliance claim.

## Verified rendering pass

[Run 44471901204](https://github.com/amungadev-ai/server_manager/actions/runs/44471901204), source head `27f8061009384f5da36d3aa82dd92c93dae252ea`: all required checks passed, including 46 existing unit/integration/progress tests and 16 desktop plus 16 mobile browser cases. All six pinned font faces loaded in both reference and app. Each viewport captured all 29 scenes, for 58 paired scenes total.

Image review confirmed zero changed pixels above a 16/255 channel threshold in both viewports for overview, projects, project service/architecture/storage views, domains and domain overview, managed-DNS instructions, database index/overview, cron index/overview, email, server, activity, application overview and storage overview. Mobile overview, project services, application overview, domains, email and storage overview also had byte-identical PNGs in direct checks.

The review found smaller residual differences: palette display names, the selected DNS mode tint (a legacy style-attribute selector did not survive browser CSS serialization), one-pixel dialog icon sizes and MX priority spacing. These were corrected. Tab-strip scroll positions and assistant/input focus are normalized between reference and app for the final comparison; source HTML and CSS are not edited. Workspace/storage explanatory copy intentionally describes ephemeral in-memory simulation.

The final browser harness additionally compares 20 complete scenes per viewport directly against PNGs rendered from the immutable reference in the same run. It permits zero changed pixels above Playwright's 0.1 perceptual color threshold; it does not approve app-generated baselines. These expected PNGs remain in ignored test output and are retained as CI artifacts. Final gate results belong to the exact source commit shown by the PR checks.

## Direct comparison correction

Run 44474331194 passed 38 of the 40 direct screenshot assertions. Domain Settings alone exposed a missing original `align-items:center` on each DNS mode choice label row (4,657 desktop pixels and 1,233 mobile pixels). The exact inline rule was restored; comparison thresholds and coverage were kept unchanged. All non-capture browser cases and build/unit gates passed. The complete gate must pass on the correction head before publication.
