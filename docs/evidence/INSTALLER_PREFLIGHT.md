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

[Run 45166802363](https://github.com/amungadev-ai/server_manager/actions/runs/45166802363) passes all **7 required jobs** on implementation head `4c1d78c72cb847f8e6e6171b87915b30c2b708be`. Tested PR merge `26bc2381cf6aca2689aa01c4defb94f91ac3b4c5` and implementation head have identical tree `af5439e569388423a7ae9870f9834ae1ad51380c`.

| Verification | Actual result |
| --- | --- |
| Node/HTTP/progress + Python | 78 + 10, zero failures/skips |
| Real PostgreSQL/HTTPS | 58, zero failures/skips |
| Go/race tests | 24 top-level + 107 subtests across 3 packages, zero skips |
| Go quality/build | vet + gofmt passed; repeated static builds byte-identical |
| Hosted read-only CLI | Ubuntu 24.04/amd64 recognized; existing proxy/runtime/storage conflict codes block fresh installation; readiness false |
| Actual Chromium | 27 desktop + 27 mobile, zero failures/skips/retries |
| Immutable prototype | 40 direct source screenshot comparisons passed |

The unsigned development binary SHA-256 is `400dc91e2f7893efc341444b8314ac7d33b314beb96de12a78ec2e8becf48835`, identical locally and on the hosted runner. This is a reproducibility observation, not publisher authentication or release provenance.

[Retained evidence](../../evidence/installer/README.md) records five native artifact/archive SHA-256 values, source/run/merge/tree, job outcomes, included manifest-file verification and retained text-file hashes. Browser archives include screenshots/traces verified in the ZIP; only bounded text reports are retained in Git. Some browser harness/discovery files declared by manifests lie outside the explicit artifact upload allowlist; those omissions are recorded rather than claimed verified. The unsigned binary was hashed inside the ZIP but is not committed as a release. Final PR checks cover the later documentation/evidence-only handoff.

## Remaining gates

Independent CL-005/protocol/bootstrap review; publisher key custody/fingerprint distribution/rotation/revocation; trusted verifier delivery and signed immutable releases/component digests/provenance; persistent rollback policy; dedicated Ubuntu 24.04 VPS, tested resource/storage profiles, inbound/firewall/Docker behavior and clock health. CL-081 journal/resume/services, CL-082 trusted IP HTTPS/renewal or secure tunnel fallback, and CL-083 claim/agent identity are not implemented by this batch. No production readiness, release key, service mutation or infrastructure purchase is claimed.
