# Security negative-test and review matrix

Task: CL-005. Status: review proposal, 2026-11-19 (Africa/Nairobi). Threat IDs refer to [THREAT_MODEL.md](THREAT_MODEL.md). Accountable tasks identify responsibility without inventing an individual reviewer. Each implementing task must link a real commit, command/environment and retained report before its acceptance box can be checked.

“Existing” below means a limited scaffold regression, not satisfaction of the future operational case. Tests for missing installer/auth/agent/runtime features are explicitly planned; this document does not add pretend passing tests for them.

| Case / threats | Negative experiment and required outcome | Implementing task / evidence state |
| --- | --- | --- |
| N01 / T01 | Tamper artifact/manifest, substitute digest, unknown/revoked key, unsigned version or forbidden downgrade; reject before root/host mutation. Trusted-key rotation and network failure preserve a safe recovery path. | CL-080/086; planned, real VM/release fixtures required |
| N02 / T02 | Existing unrelated Docker/Caddy/firewall state, concurrent installer, symlink/temp-path substitution, crash/resume or purge without ownership; no unrelated resource changes, journal recovery is deterministic. | CL-080/081/084; planned, disposable VM snapshots required |
| N03 / T03 | Missing/expired/mismatched IP certificate, failed renewal, forged Host/Forwarded headers or public HTTP; no public secret-entry path. Verify trusted SAN/chain and real tunnel fallback; failed health is visible. | CL-082/035/093; planned, external TLS/network checks required |
| N04 / T04 | Race two claim transactions/processes; try wrong, expired, reused, cross-instance and regenerated claim/setup handles; exactly one owner, no disclosure, bounded denial/audit. Repeat after crash and old-backup restore. | CL-031/032/083/093; planned, real PostgreSQL races required |
| N05 / T05 | Session fixation, expired/revoked cookie, sibling-origin CSRF including login/logout, missing/null Origin, MFA/recovery replay and forged callback; reject, rotate/revoke as specified, never leak account state. Verify host-only cookie flags on IP/custom origins and benchmark throttling. | CL-033/034/035/093; planned. `apps/api/test/app.test.mjs` currently proves operational auth remains 501 only |
| N06 / T06 | Anonymous/wrong-workspace resource ID, forged owner/role fields, stale/downgraded actor/API key and AI capability; deny every route/job/stream and leave state unchanged. Test resources that exist elsewhere without leaking their existence. | CL-030/036/052/090; planned. Existing API/contract tests reject caller authority fields and HTTP adapter rejects invalid session responses; no ownership policy is implemented |
| N07 / T07 | SQL fragments in every persisted input, unregistered queue handler, tampered job scope, app access to platform DB or overprivileged SQL console; parameter binding/policy deny and preserve data. | CL-031/051/060/063; planned, real DB/network evidence required |
| N08 / T08 | Modify each signed field/proof; unknown/wrong/revoked key or scheme; duplicate keys, number/encoding ambiguities, oversized frame, expired/future command, time rollback, replay across processes/restart; deny before effects. Node/Go shared vectors must agree. | CL-052/090; planned. `packages/contracts/test/contracts.test.mjs` tests shape/relative time only; no signature/current-time/replay test currently exists |
| N09 / T09 | Validly signed command for another installation/resource/volume or excessive profile; injected shell, host paths, Docker options, host namespaces, devices or arbitrary route destination; agent independently denies. Demonstrate limits under a compromised API signer. | CL-052/053/074; planned. Existing schema/API tests reject generic operations/unsafe mount fields/injected payloads; no Docker boundary is exercised |
| N10 / T10 | Absolute/parent/encoded archive paths, duplicate/case-colliding entries, symlinks/hardlinks/devices, extraction race, compressed/expanded byte and inode bombs; quarantine/reject and never write outside exclusive staging. Malicious build cannot read platform keys/control sockets. | CL-050/053/056/094; planned. E2E static fixture-server traversal tests cover the test server only, not archive extraction |
| N11 / T11 | From a real compromised workload/builder, attempt host gateway/private/self IP, IPv6/mapped IPv4, metadata, agent/Docker/Caddy sockets, platform DB, other app network/volume and host mounts; required destinations remain unreachable and management sockets inaccessible. | CL-052/060/081/090; planned, packet/socket and filesystem evidence required |
| N12 / T12 | Concurrent uploads/jobs, CPU/fork/log/disk/inode bombs, container OOM and cancellation; bounded admission protects DB/agent/renewal, reports actual failure and recovers. Test starter/standard profiles with measured budgets. | CL-051/087/094; planned. Existing HTTP body/stream limits are limited regression evidence |
| N13 / T13 | Unverified/expired domain binding, reserved panel host, cross-resource upstream, unhealthy candidate, stale generation and simultaneous promotion; reject or CAS exactly once, preserve previous healthy route on config failure. | CL-043/044/052/053; planned, live Caddy/DNS fixtures required |
| N14 / T14 | Callback/health/storage endpoint targets loopback/private/link-local/metadata/self, IPv6 variants, redirects and DNS rebinding; enforce destination policy on every connection and network egress. Valid permitted endpoints still work. | CL-053/061/070/090; planned, controlled DNS/redirect fixtures required |
| N15 / T15 | Feed recognizable synthetic secrets and active HTML/SVG/file names into logs, audit, traces, URLs, env errors and previews; no credential leakage or panel-origin script execution. Cross-workspace object grants and expired signed requests fail. | CL-033/056/070/071/072/090; planned. Existing safe-error and production fixture-exclusion tests cover only their narrow paths |
| N16 / T16 | Worker/agent dies after effect but before acknowledgment; duplicate/stale/cancelled jobs and forged observed state; reconcile rather than repeat, reject stale generation, bind audit/result to command/resource. | CL-051/052/053; planned, durable queue/agent crash injection required |
| N17 / T17 | Clean-host encrypted restore, missing/wrong key, modified backup, incompatible migration, old sessions/claim/replay ledger and lost volume; reject unsafe restore or recover through local authenticated procedure without reviving access. Record actual RPO/RTO. | CL-034/085/086/091; planned, disposable clean VPS required |
| N18 / T18 | PR/source tries to access infrastructure secrets or skip gates; forged/replayed/wrong-repo webhook; AI output asks for shell/escalated action; deny out-of-scope operations and retain safe audit. Dependency/image/key revocation response is exercised. | CL-004/055/090/096; existing progress/boundary/CI-policy tests cover limited repository gates; hosted settings, webhook and AI security cases require separate evidence |

## Existing regression commands

Run from the repository root using the pinned Node/npm toolchain:

```bash
npm run check
npm test
npm run build
python3 scripts/validate_progress.py
```

`npm run test:ci` additionally writes Node/Python JUnit and exit-code summaries. The current suite contains 36 Node and 10 Python unit/HTTP/gate cases after the hosted-upload policy regression was added. Browser cases are a different suite and require actual browser execution; a passing test list or static build is not security execution evidence. Final command results for this task belong in `evidence/security-model-checks.md` and the canonical task record.

## Reviewer decisions and acceptance

All items are pending until a real reviewer, date, decision and evidence reference are recorded. A general “proceed” instruction authorizes preparation; it does not constitute independent security approval.

- [ ] Confirm single-owner trusted-code scope and the boundary needed before public hostile-code hosting.
- [ ] Review installer publisher-key bootstrap, rotation/revocation, rollback and host mutation ownership.
- [ ] Resolve claim/setup transaction states, attempt limits, expiry and crash/restore invariants.
- [ ] Approve browser origin/proxy/CSRF/session policy, password benchmark and MFA/recovery availability behavior.
- [ ] Review the ADR-017 signing bytes, libraries, timestamp/skew limits, local IPC, key custody, replay persistence and journal recovery. A cryptographic review must inspect interoperable test vectors before execution approval.
- [ ] Define agent-owned policy enrollment/registry authority and document compromised-signer containment and residual owner-resource risk.
- [ ] Review builder/runtime isolation, network/firewall rules including IPv6, mount/profile exceptions and measured resource budgets.
- [ ] Confirm each N01–N18 case is assigned to its implementing task, with evidence required before that feature's release; no planned test is represented as passed.
- [ ] Record remaining risk decisions and trigger the model update when commands, integrations, origins, roles or recovery behavior change.

Reviewer: **pending**. Decision/date/reference: **pending**. CL-005 is ready for review only when the document and regression evidence are committed; it is not security-approved or production-verified.
