# CL-081 — restartable installer candidate evidence

[PR #9](https://github.com/amungadev-ai/server_manager/pull/9) is stacked on PR #8 head `d19621b52da6461f71b71697f3c6872be8cae058`. Shared claim: `c3453a468bb7761100761f72dda5a382157a0983`. Design: [ADR-023](../adr/023-restartable-platform-installation.md).

## Scope

Signed immutable-image plans, private profile/preflight/identity/secret binding, flock and fsynced atomic journal, observed stage completion, lost-ack resume, explicit repair dry-run/apply and safe refusal of data/schema/ownership drift. The non-root review driver manages only uniquely owned private Docker resources. Actual database/API loopback contracts stay unchanged inside the platform namespace; only Caddy is published on host 127.0.0.1. Admin/migrator/runtime roles are distinct and runtime DDL/ledger writes are denied. Caddy blocks plaintext owner routes. Systemd dependency/restart definitions are staged and checked offline, never enabled by this profile.

API and dashboard images are built in CI from locked dependencies and compiled HTTP output, not compiled on a target VPS. Node 24.22.3, Caddy 2.11.9 and PostgreSQL 18.7 base image manifest digests were obtained from the official registry and pinned in source. The normal API resolver, migration SQL, HTTP contracts and supplied prototype are unchanged. The final component state is awaiting_tls_and_claim, never ACTIVE or ready to claim.

## Local checks

2026-11-24: npm ci/check/test/build/lint and progress validation pass (79 Node + 10 Python). Go 1.27.4: 49 top-level + 164 subtests across 7 packages, zero failures/skips; race detector, vet, format and repeated byte-identical static builds pass. Integration-tag compilation with no selected cases is not live evidence. Docker is unavailable in this workspace; the mandatory hosted job must execute the actual stack before this candidate is handed off.

## Hosted evidence

Pending implementation source. Do not substitute parent, claim-only, fake-backend or discovery results. Required CI includes existing real PostgreSQL/HTTPS and desktop/mobile prototype checks plus the live private component job. The handoff must bind exact head/merge tree/run, artifact archive digests and retained file hashes.

## Outstanding operational acceptance

Independent CL-005/ADR-023 and publisher trust/key custody/revocation/provenance review; native root bootstrap/Docker reuse/user and service custody; dedicated Ubuntu 24.04 VPS boot/reboot/power-loss/network/firewall and resource budgets; real trusted IP TLS/renewal or SSH fallback (CL-082); owner claim/agent/pg-boss readiness (CL-083 and implementing tasks). Read-only systemd validation is not proof of startup after reboot. Injected lost acknowledgement is not a power-loss test. Missing-data refusal is not backup restore. No operational production installer, arbitrary host shell, public auth, purge/uninstall, infrastructure purchase or production readiness is claimed.
