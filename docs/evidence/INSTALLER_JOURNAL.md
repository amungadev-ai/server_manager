# CL-081 — restartable installer candidate evidence

[PR #9](https://github.com/amungadev-ai/server_manager/pull/9) is stacked on PR #8 head `d19621b52da6461f71b71697f3c6872be8cae058`. Shared claim: `c3453a468bb7761100761f72dda5a382157a0983`. Design: [ADR-023](../adr/023-restartable-platform-installation.md).

## Scope

Signed immutable-image plans, private profile/preflight/identity/secret binding, flock and fsynced atomic journal, observed stage completion, lost-ack resume, explicit repair dry-run/apply and safe refusal of data/schema/ownership drift. The non-root review driver manages only uniquely owned private Docker resources. Actual database/API loopback contracts stay unchanged inside the platform namespace; only Caddy is published on host 127.0.0.1. Admin/migrator/runtime roles are distinct and runtime DDL/ledger writes are denied. Caddy blocks plaintext owner routes. Systemd dependency/restart definitions are staged and checked offline, never enabled by this profile.

API and dashboard images are built in CI from locked dependencies and compiled HTTP output, not compiled on a target VPS. Node 24.22.3, Caddy 2.11.9 and PostgreSQL 18.7 base image manifest digests were obtained from the official registry and pinned in source. The normal API resolver, migration SQL, HTTP contracts and supplied prototype are unchanged. The final component state is awaiting_tls_and_claim, never ACTIVE or ready to claim.

## Local checks

2026-11-24: npm ci/check/test/build/lint and progress validation pass (79 Node + 10 Python). Go 1.27.4: 52 top-level + 169 subtests across 7 packages, zero failures/skips; race detector, vet, format and repeated byte-identical static builds pass. Integration-tag compilation with no selected cases is not live evidence. Docker is unavailable in this workspace; the mandatory hosted job must execute the actual stack before this candidate is handed off.

## Hosted evidence

[Run 45486627138](https://github.com/amungadev-ai/server_manager/actions/runs/45486627138) passes all **8 required jobs** on implementation head `2f2cab2c81a85e6c115ad62ab5fabf25a8084273`. Tested merge `a12618cd114853aec175d181db88f32e8225fd99` and implementation head have identical tree `332cea1bdcf6e80c569b3a07fc1821e2c036fd37`.

| Verification | Actual result |
| --- | --- |
| Unit/HTTP/progress | 79 Node + 10 Python; no failures/skips |
| Installer Go/race | 52 top-level tests + 169 subtests, 7 packages; vet/format passed; zero skips |
| Actual component integration | 1 live test + 9 subtests; real PostgreSQL 18.7, Node 24.22.3/NestJS, Caddy 2.11.9 and compiled HTTP Svelte output |
| Journal/lifecycle integration | Fresh start, idempotent resume, injected lost DB acknowledgement, read-only repair then owned restart, foreign/unrelated resource preservation, missing-data refusal |
| Identity/auth/permissions | Stable database/container identity on resume; runtime DDL/ledger writes denied; plaintext owner routes blocked; ready_to_claim stays false |
| Actual CLI / startup files | Public review CLI doctor passed; four staged systemd files passed real offline systemd-analyze verify |
| Existing PostgreSQL/HTTPS suite | 58 cases, no failures/skips |
| Actual browser execution | 27 desktop + 27 mobile; zero failures/skips/retries |
| Prototype rendering | 40 direct comparisons to the immutable supplied HTML passed |

The installer job builds the same unsigned static executable twice, byte-identically; local and hosted SHA-256 is `8996a221d763d4068176435fa1011a752e8b945163cb071bfeffdd32bdb241dd`. No publisher authentication or production provenance is implied by this reproducibility observation.

[Retained reports](../../evidence/installer-journal/README.md) verify six original archive digests, tested source/run/clean-tree fields and all included declared file hashes. Sixty-five bounded text reports include actual live execution/role/lifecycle results, image pins and four verified staged units. Binary/screenshot/trace bytes were checked inside source ZIPs but are not duplicated in Git. Files declared by browser/discovery manifests outside the upload allowlist are recorded as omissions, never claimed verified. The final documentation/evidence-only commit is covered separately by final PR checks.

The initial run 45484944587 failed its panel postcondition because an internal-only bridge does not publish host ports through Docker's gateway endpoint. The corrected private NAT bridge retains database/API loopback and host-127.0.0.1 publication, verifies effective bindings and requires Docker 28+. That failed run is not counted as completed integration acceptance. Ordinary outbound NAT is permitted; no egress firewall is claimed.

## Outstanding operational acceptance

Independent CL-005/ADR-023 and publisher trust/key custody/revocation/provenance review; native root bootstrap/Docker reuse/user and service custody; dedicated Ubuntu 24.04 VPS boot/reboot/power-loss/network/firewall and resource budgets; real trusted IP TLS/renewal or SSH fallback (CL-082); owner claim/agent/pg-boss readiness (CL-083 and implementing tasks). Read-only systemd validation is not proof of startup after reboot. Injected lost acknowledgement is not a power-loss test. Missing-data refusal is not backup restore. No operational production installer, arbitrary host shell, public auth, purge/uninstall, infrastructure purchase or production readiness is claimed.

Networking note: the review bridge permits ordinary Docker outbound NAT. Database/API still bind only to loopback inside the private platform namespace; only the panel port is published on host 127.0.0.1. An internal-only bridge cannot publish a host port through Docker’s gateway endpoint. This profile is not an egress firewall. Docker Engine 28+ is required for the documented localhost-publication boundary; older/unknown daemon versions are refused. Docker manages rules for these new owned resources; this candidate does not reset daemon settings, SSH or unrelated firewall policy. See [upstream networking behavior](https://github.com/moby/moby/discussions/53256) and [port-publication requirements](https://docs.docker.com/engine/network/port-publishing/).
