# ADR-015 — Versioned agent envelope

Status: proposed; not approved for operational use
Date: 2026-11-18
Tasks: CL-003; required reviews CL-005, CL-052
Review: security/transport/cryptographic review pending

CL-005 now provides a concrete proposed verifier profile in [ADR-017](017-security-boundaries.md) and [negative acceptance cases](../security/SECURITY_ACCEPTANCE.md). These are review material only; this ADR and the draft v1 schemas remain unapproved for operational use.

## Proposal

Use a separate commandVersion=1 schema with command/server/workspace/resource IDs, desired generation, idempotency key, issued/expiry timestamps, a typed operation-specific payload and detached authorization material. Allowed operations are start/stop/inspect candidate and promote a verified route binding. Payloads contain immutable digests, resource IDs, bounded limits and named volume IDs at allowlisted container mount points; no generic executable, shell, host path, Docker socket or arbitrary proxy destination.

This milestone validates structure and relative timestamp ordering only. It does not authenticate signatures, decide trusted keys, validate current time/replay/ownership, provision a socket, resolve bindings, start containers or change routing. A syntactically valid command is untrusted and must never be dispatched on that basis.

The detached signature algorithm and encoding are deliberately not selected here: `authorization` is a bounded, opaque envelope with an explicit scheme identifier. CL-005/052 must choose and review a concrete signing/canonicalization, credential rotation, local transport, max lifetime, replay and authorization design before implementing an agent. Reject unsupported schemes at the future verifier, not through schema acceptance alone.

## Compatibility and evidence

HTTP and agent versions evolve separately. Any future command/field/algorithm change needs compatibility and rolling-upgrade notes. The generated JSON Schema is an interchange description; cross-field/runtime policy checks remain explicit receiver responsibilities. Negative tests reject unknown operations, host mounts and arbitrary payload keys. No Go agent or authentication gate is claimed.
