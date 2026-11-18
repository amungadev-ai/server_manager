# Cloudlane contributor rules

Read `docs/00-SOURCE_OF_TRUTH.md`, `PROJECT_PROGRESS.md`, `tasks/BACKLOG.md`, and the affected task record before changing code.

- Locked architecture: Svelte 5 + static SvelteKit, NestJS, PostgreSQL + pg-boss, restricted Go agent, Docker and Caddy.
- The HTML reference defines approved UI behavior. Keep fixture data separate from the HTTP adapter. Do not report simulated provisioning as live infrastructure.
- Update the canonical `tasks/progress/CL-###.md` with exact checks, limitations and the next command. Preserve history.
- Record claims as provisional until shared coordination exists. Inspect remote refs before takeovers. Never invent reviews or evidence.
- Never place credentials, sessions or infrastructure state in browser localStorage. UI preferences only.
- Changes to security-sensitive proposals require an ADR and negative-path tests before release. No generic host-shell API, public Docker socket or arbitrary host mounts.
- Run `npm run check`, `npm test`, `npm run build`, and `python3 scripts/validate_progress.py`. Use `npm ci` for reproducibility.
- Do not mark release gates complete based on scaffolding or preview data. Production installer/auth/deployment testing requires real infrastructure.
