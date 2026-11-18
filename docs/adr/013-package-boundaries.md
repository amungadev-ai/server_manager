# ADR-013 — Package boundaries and reviews

Status: accepted for development
Date: 2026-11-18
Tasks: CL-001, CL-002
Review: maintainer source/evidence review; independent review pending

## Context

CL-001 is integrated on main and passes a clean-checkout install, checks, tests and static build. The user authorized the next CL-002/003 milestone. Visual review is still blocked by the private preview sign-in gate; no UI parity or production security approval is inferred.

## Decision

Use the package dependency rules in `docs/PACKAGE_BOUNDARIES.md`, enforced by `scripts/check-boundaries.mjs`. `packages/contracts` contains portable schemas and types; it imports no Node-only, NestJS or application modules. It publishes ESM to the dashboard and CommonJS to the NestJS 11 API. Generated API types are committed; generated JavaScript is ignored.

Keep preview presentation types separate from validated production API shapes. The browser cannot import the agent contract, API implementation or installer. API controllers cannot import the dashboard or execute Docker/host commands. Schema parsing never proves authorization.

Task claimants maintain one canonical task record. The integration maintainer reviews commands and factual results, recording `merged` separately from `verified`. The current repository has no configured independent reviewer or enforced GitHub branch protection. Keep that limitation explicit; follow CL-004/005 before production/security sign-off.

## Alternatives

A shared application package would blur privilege boundaries. Hand-maintained duplicate request interfaces would drift. Converting the entire NestJS build to ESM is unnecessary for this milestone; dual contract outputs support existing consumers with the same source.

## Security and compatibility

No workload execution, authentication or persistent data is introduced. Existing read-only preview fixtures retain their synthetic identifiers; new HTTP entity identifiers use the versioned schema. The guard is structural and supplements review, not a complete sandbox or data-flow proof.

## Evidence

Run `npm run check:boundaries`, `npm run check`, `npm test`, and `npm run build`. Exact results are in `tasks/progress/CL-002.md`.
