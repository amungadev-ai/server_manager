# Cloudlane contracts

Portable Zod schemas are the validation source. NestJS route metadata references them; `npm run contracts:generate` emits OpenAPI, TypeScript paths/components and separate agent JSON Schemas. `npm run contracts:check` validates the document and rejects generated drift without rewriting outputs.

| Export                              | Consumer                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `@cloudlane/contracts/api`          | Server validation and browser response validation                         |
| `@cloudlane/contracts/client-types` | Generated OpenAPI TypeScript types                                        |
| `@cloudlane/contracts/preview`      | Dashboard presentation types; synthetic identifiers only in demo fixtures |
| `@cloudlane/contracts/agent`        | Future server/agent integration; never browser code                       |

`dist/` provides CommonJS plus ESM from the same source. JSON schemas and generated TypeScript are committed. The application compiler stays TypeScript 6; the generator's isolated TypeScript 5 dependency satisfies its supported peer range.

HTTP entity IDs are opaque UUID v4. Objects reject unknown fields. Create inputs cannot supply workspace/owner authority. Add Domain accepts one name field; Manual DNS is the future creation default, with mode changes declared separately under domain Settings. Resource retry keys are declared but not persisted/deduplicated yet.

Only liveness and unconfigured installation status are implemented. Declared auth/resource routes validate request syntax then return 501. Their documented success responses are draft contracts, not working account or infrastructure services. No database, queue, owner session or agent is created here.

Agent shape parsing does not authenticate a command. Signature scheme selection, canonicalization, trusted keys, clock/replay/ownership validation, IPC and actual execution require CL-005/052 review. JSON Schema captures field constraints; relative timestamp/usage refinements and authorization remain receiver-side requirements. See ADR-015.
