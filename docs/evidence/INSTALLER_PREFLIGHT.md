# CL-080 — installer preparation evidence

PR: https://github.com/amungadev-ai/server_manager/pull/8  
Base: CL-036 PR #7, head `82a879a15aee324f051fd476fee6f81af106e588`  
Shared claim: `e1e13605deff7fbadc58715759fb7a38f7df0092`  
Design: [ADR-022](../adr/022-installer-preflight-and-release-trust.md)

## Implemented scope

A dependency-free Go CLI performs fixed-path read-only preflight and offline exact-version signature/artifact verification. It has no install/download/shell/override command. Preflight detects unsupported/missing evidence and known host/configuration/runtime/state/port conflicts, redacts diagnostic contents and always keeps installation readiness false. The verifier requires independent key trust and explicit version/hash/size/time/target binding. It neither executes bytes nor authenticates its own bootstrap.

No dashboard/prototype, HTTP contract, authentication activation or migration changed. The required CI aggregation now includes an unconditional pinned Ubuntu 24.04 / Go installer job, with negative tests against skipped/missing/weakened gates.

## Local verification

2026-11-23: `npm ci`, `npm run check`, `npm test` (78 Node + 10 Python), `npm run build` (HTTP output with no demo fixtures), `npm run lint` and progress validation pass. The exact Go 1.27.4 toolchain was downloaded to the workspace and its official SHA-256 checked before execution; it is not installed on the customer host.

`npm run test:installer`: 24 top-level tests + 107 subtests across 3 packages, zero failures/skips; race detector, vet, gofmt, repeated byte-identical CGO-free builds and actual read-only host CLI pass. Tests open ephemeral loopback TCP/UDP sockets and prove the collector sees actual kernel bindings. The workspace snapshot is **blocked**, not an eligible VPS. Results are development evidence, not production certification.

## Hosted verification

Pending implementation-source CI. The completed handoff will identify the actual head/merge tree, run, artifact digests and retained report hashes. Claim-only or parent runs cannot validate this implementation.

## Remaining gates

Independent CL-005/protocol/bootstrap review; publisher key custody/fingerprint distribution/rotation/revocation; trusted verifier delivery and signed immutable releases/component digests/provenance; persistent rollback policy; dedicated Ubuntu 24.04 VPS, tested resource/storage profiles, inbound/firewall/Docker behavior and clock health. CL-081 journal/resume/services, CL-082 trusted IP HTTPS/renewal or secure tunnel fallback, and CL-083 claim/agent identity are not implemented by this batch. No production readiness, release key, service mutation or infrastructure purchase is claimed.
