# ADR-012 — Reproducible foundation and preview boundary

Status: accepted for the development scaffold; security-sensitive auth/agent decisions remain proposed.
Date: 2026-11-18
Task: CL-001

## Decision

Use SvelteKit 3.3.1 with its inline Vite plugin configuration, native `#lib` imports, and TypeScript 6.0.3 as required by the current framework. This satisfies the locked Svelte 5/static SvelteKit architecture.

Use npm workspaces with a committed lockfile and exact direct dependency versions. Pin the available Node runtime in `.node-version`; retain the locked static SvelteKit/NestJS boundary. The dashboard produces `dist/index.html` as its SPA fallback. NestJS listens on loopback by default. Production data is requested from the same origin at `/api/v1`.

A separate, explicit `build:preview` command enables read-only synthetic fixtures. The ordinary `build` defaults to the HTTP adapter. No demo sign-in, secret, infrastructure mutation, queue or server connection is simulated. Static hosting serves only the dashboard preview; it does not host NestJS or operate a VPS.

The initial API exposes liveness and a truthful unconfigured installation status. Session and infrastructure endpoints return typed NOT_IMPLEMENTED responses until real PostgreSQL/auth is implemented. No bootstrap credentials are accepted.

## Resource and security implications

No database or privileged workload is installed in this environment. Go agent and installer directories are scope documents only. Caddy configuration is a development integration template. Real TLS issuance, auth, upgrades and hosting must pass their backlog gates.

## References

- https://svelte.dev/docs/kit/adapter-static
- https://svelte.dev/docs/kit/single-page-apps
- https://docs.nestjs.com/v11/first-steps

Acceptance evidence is recorded in `tasks/progress/CL-001.md`; no separate reviewer or production validation is claimed.

- https://svelte.dev/docs/kit/migrating-to-sveltekit-3
