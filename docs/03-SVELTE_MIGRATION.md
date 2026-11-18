# 03 — Svelte 5 / SvelteKit UI conversion plan

**Decision:** Use Svelte 5 + SvelteKit compiled into static assets served by Caddy. The browser requests `/api/v1/*` from the NestJS API on the **same origin**. Do not require a SvelteKit Node SSR process on the VPS. Verify `@sveltejs/adapter-static` config on a pinned supported release: https://svelte.dev/docs/kit/adapter-static.

## 1. Starting point and parity rule

The original v1.13 HTML combines markup, CSS, JavaScript events, demo state, fake network operations and localStorage. **It is a specification/reference, not a component library to copy wholesale.** Extract reusable visual tokens and interaction behavior, replace global DOM mutation with Svelte components and typed stores, and replace simulated infrastructure actions with API adapters when they exist. Maintain a `demo` mode until each backend is connected.

**Feature parity:** same Cloudlane brand; Overview, Projects, Domains (seven tabs), Databases, Email, Cron Jobs, Activity & Logs, Server, Settings; Projects → Services/Architecture/Storage; service detail tabs; default app URLs; compact card layouts; draggable small Assistant; light/dark and five palettes. The existing sidebar does not include workspace switcher or prototype-mode card.

## 2. Suggested monorepo tree (proposal)

```text
cloudlane/
├── AGENTS.md
├── PROJECT_PROGRESS.md
├── agents/ and docs/ and tasks/
├── apps/
│   ├── dashboard/                 # SvelteKit app, adapter-static build
│   │   ├── src/routes/
│   │   │   ├── (public)/login/
│   │   │   ├── (public)/setup/
│   │   │   └── (authenticated)/
│   │   │       ├── +layout.svelte
│   │   │       ├── overview/
│   │   │       ├── projects/[projectId]/
│   │   │       ├── domains/[zoneId]/
│   │   │       ├── databases/ email/ cron-jobs/
│   │   │       ├── activity/ server/ settings/
│   │   │       └── services/[serviceId]/
│   │   └── src/lib/{components,design,api,stores,types,features}/
│   └── api/                       # NestJS, TypeScript, OpenAPI
├── packages/
│   ├── contracts/                 # JSON schemas, generated types
│   └── design-tokens/             # Palette/token definitions
├── agent/                         # Go server agent
├── installer/                     # Signed, versioned CLI/build artifacts
├── deploy/                        # Caddy, Docker, systemd/compose templates
├── tests/                         # End-to-end/integration/security suites
└── .github/workflows/
```

SvelteKit routing syntax is not an assertion that the directories already exist. The workstream responsible for scaffolding may adjust exact structure via a documented ADR.

## 3. Static build behavior

Use SvelteKit's static adapter and a documented SPA fallback for dynamic/private routes if necessary. Do **not** publicly prerender authenticated content or include user secrets in generated assets. All authenticated data is loaded at runtime after a session check. Configure Caddy to serve static content and direct deep links to the SPA fallback *only for dashboard routes*; never swallow `/api/v1` failures or customer-app hostnames.

- `GET /api/v1/auth/session` determines authenticated state and owner role; the UI must not trust `localStorage` booleans.
- `GET /api/v1/installation/status` provides public-safe install status only, no claim token.
- API failure/403/401 cause explicit UI states; do not optimistically mark provisioning complete.
- State should be scoped by workspace/project/service ID, not by global mutable variables.
- Use fetch client with `credentials: include`, CSRF headers where required, request cancellation, typed errors and pagination.
- Route data loading should support refresh/deep links, sparse networks, expired sessions and back/forward navigation.

## 4. Design tokens and component system

Source: `docs/REFERENCE_DESIGN_SYSTEM.md` plus `source-blueprints/Cloudlane_Design_System_Integration_v1.10.md`. Implement semantic tokens (background/raised/overlay/sunken; text/secondary/muted; primary/tint; danger/success/warning/info); all five palettes have light/dark variants. Keep consistent control height, focus ring, responsive spacing and data density as in v1.13. Extract:

`AppShell`, `SidebarNav`, `Topbar`, `PageHeading`, `Breadcrumbs`, `Button`, `IconButton`, `Field`, `Select`, `Dialog`, `Tabs`, `StatusBadge`, `Card`, `CompactProjectTile`, `CompactDomainCard`, `Table`, `EmptyState`, `Toast`, `Pagination`, `ConfirmationDialog`, `AssistantLauncher`, `AssistantDrawer`.

Do not import Drevanta's application navigation; only reuse the uploaded design-system guidance already integrated with the Cloudlane look. Avoid hardcoding light-only colors inside components. Respect reduced motion, keyboard operability and WCAG contrast.

## 5. Screen migration batches

| Batch | Components/pages | Data mode | Exit tests |
| --- | --- | --- | --- |
| A — Shell | Sidebar, topbar, routing, palette preferences, alerts, modal, mobile navigation | demo fixtures | Same nav, no mobile overflow, palette persistence |
| B — Essential | Overview, Projects and project details, Domains index + seven tabs | typed mock adapter | v1.13 visual match, one-field Add Domain, mode under Settings |
| C — App lifecycle | Create New, ZIP/GitHub forms, services, logs, history, rollback, variables | typed mocks then real | Form validation, error/reset states, pipeline progress |
| D — Resources | Databases, users/privileges, cron, email, storage, file explorer | typed mocks then real | isolated permissions, mobile cards, no host-file exposure |
| E — Admin | Activity, server health, Settings, API keys, assistant, access controls | real auth/session | forbidden actions blocked by API and reflected in UI |

Agents should not wait for all backend modules: define an `InfrastructureApi` interface, a `DemoInfrastructureApi` fixture implementation and a `HttpInfrastructureApi` that uses generated contracts. Demo mode is explicitly labeled in developer/test builds; do not ship simulated operational success in a production installation.

## 6. Design and quality rules

- Visual snapshots at desktop ~1440px and mobile ~390px; verify additional 950px/700px breakpoints.
- Compact Overview metrics (mobile number restrained), Project tiles about v1.13 density, Domain cards similarly compact.
- Activity description inline instead of stacked where space allows, responsive wrap on narrow screens.
- Floating Assistant uses pointer/touch drag with bounded coordinates, persists position in **non-sensitive UI storage only**, and differentiates drag from click.
- All icon-only controls have accessible labels; modals trap focus; tables include headers and responsive alternatives.
- Optimistic updates must roll back on failed server requests; permission changes end terminal sessions immediately.

## 7. Demo state migration

The HTML's `localStorage` seed is *not* a real database migration. Instead derive typed fixtures from sample projects (e.g. Maid Finder) with synthetic usernames and storage metadata only. Test data resets must be confined to development and tests. Never seed demo administrator tokens/passwords in production.

## 8. Completion gate

`npm/pnpm` versions locked; `check`, lint, unit, component and Playwright e2e pass; accessibility baseline and screens visually reviewed; `build` emits static assets with no SSR runtime dependency; production Caddy serves all deep links and API from same HTTPS origin; no functional parity regressions. Assign tokens/components, feature pages, typed API adapters, and visual/accessibility tests through their task IDs; review shared interfaces before simultaneous changes.
