# ADR-014 — HTTP contracts and generation

Status: accepted for the development contract; v1 remains draft
Date: 2026-11-18
Task: CL-003
Review: maintainer checks; independent compatibility/security review pending

## Decision

Adopt `/api/v1` as the canonical prefix (implements the earlier ADR-P02 proposal). Define strict, bounded Zod schemas in `packages/contracts/src/api.ts` and UUID v4 identifiers in `ids.ts`. Caller-supplied IDs do not establish ownership. Create-project/domain inputs have no workspace/owner/role fields; the future authenticated API resolves those from the principal.

Reject unknown object fields, malformed identifiers, invalid pagination, malformed JSON and oversized JSON. Retryable resource mutations declare UUID Idempotency-Key headers. No operation is persisted or deduplicated in this milestone, so mutations continue returning NOT_IMPLEMENTED after shape validation.

Generate OpenAPI 3.0 from actual NestJS route metadata and the exact shared schemas used by the validation pipe. Generate TypeScript paths/components from that document. A check-only generation mode detects drift without changing files. The dashboard transport validates session, overview and error responses at runtime instead of casting arbitrary JSON.

Use consistent error codes and server-generated request IDs. Error details expose bounded schema paths/codes only, never input values, raw parser messages, passwords or claim material. Disable Swagger's request submission controls. Documentation distinguishes live health/status routes from declared unavailable operations using `x-cloudlane-implementation` and descriptions.

## Alternatives and compatibility

Separate class-validator DTOs plus frontend interfaces would duplicate definitions. A handwritten OpenAPI file would drift from controllers. Schema-first route metadata keeps one validation source while retaining NestJS. The initial scaffolding's raw health/status response shapes remain compatible. Draft resource/auth schemas may change before their implementation tasks; regenerate consumers together and document breaking changes before publishing a stable contract.

## Scope limits

Declaring a success response shape is not implementing it. No owner creation, session/CSRF/MFA policy, PostgreSQL write, queued operation or deployment is enabled. MFA/session/signature decisions remain proposed. Runtime authorization and idempotency persistence belong to their later tasks.

## Evidence and sources

- `npm run contracts:generate` / `npm run contracts:check`
- Request/response/agent adversarial tests and OpenAPI validation in CL-003 evidence.
- https://docs.nestjs.com/v11/openapi/introduction
- https://zod.dev/json-schema
- https://openapi-ts.dev/node

The generator is isolated in `tools/contract-generator` with TypeScript 5.9.3 to satisfy openapi-typescript 7 peers. The application/compiler remains TypeScript 6.0.3 for SvelteKit 3. No peer checks are bypassed.
