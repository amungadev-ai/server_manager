# Restricted Go agent — not implemented

The foundation reserves this package boundary. CL-052 owns authenticated typed IPC, resource scope, expiry/idempotency and rejection of generic host shell or unsafe mounts. No runnable privileged agent or accepted protocol exists yet. Choose/pin a supported Go toolchain with implementation; a Go compiler is unavailable in the current workspace.

CL-003 now supplies a proposed portable command/result schema in `packages/contracts/src/agent.ts` and generated JSON Schemas under `packages/contracts/schema/`. See ADR-015. These are non-executing shape definitions; no signature, clock/replay, ownership, socket or Docker operation is implemented.
