# 07 — Deployment engine, workers, server agent and rollback

## 1. Product contract

ZIP uploads and GitHub repository revisions enter the **same deployment pipeline**. Node/Express/NestJS backend and static/Next.js/frontend apps are variants of application service, not separate provisioning systems. Advanced build settings are disclosed only when autodetection cannot resolve them. A deployed service must not replace an existing healthy release before readiness passes.

## 2. State machine

```text
REQUESTED → QUEUED → FETCHING → VALIDATING → DETECTING → BUILDING
         → STARTING_CANDIDATE → HEALTH_CHECKING → ACTIVATING → LIVE
                                                  │
    any active stage → FAILED / CANCELLED / TIMED_OUT
    previous LIVE retained on failure
    LIVE → ROLLBACK_REQUESTED → REACTIVATING_PREVIOUS → LIVE
```

Record stages with monotonic sequence, timestamps, correlated job ID, sanitized output and failure reason. API returns job/deployment ID immediately, not fabricated deployment success. UI subscribes to progress (SSE first; polling fallback). Successful `LIVE` means response on real routed hostname/health probe, not only container state `running`.

## 3. Source acquisition and validation

- **ZIP**: authenticated staged upload, content length/quota, part integrity, fixed staging directory, expiry, MIME-independent validation, reject path traversal (`../`, absolute paths), symlink/hardlink extraction abuses, oversized compressed/extracted data, unsafe permissions. No extraction into host arbitrary path.
- **GitHub**: GitHub App with repo-scoped installation access; signed webhook verification, replay/deduplication, revision pinning, private repo permission controls, securely stored short-lived installation tokens.
- **Revision**: immutable source artifact ref, SHA/checksum, framework detector result and user overrides. Never trust arbitrary archive commands or injected environment variables as agent shell flags.

## 4. Build isolation and resource policy

- Build in a constrained environment with no privileged host socket or control-plane secrets, CPU/RAM/pid/temporary-disk limits and bounded duration; default concurrency 1 on starter mode.
- Allow only approved buildpacks/templates or safe OCI builds. Pin builder images and versions. Network egress policy must be explicit; dependency installation often needs internet, but sensitive local networks must not be reachable.
- Prebuild dashboard and platform artifacts off-host. Off-server customer builds or prebuilt image deploys may be necessary for the 1 GB target; UI should warn about limits before starting.
- Never expose host bind mounts or customer-selected absolute paths. Persistent volumes are IDs with allowed container paths only.
- Sanitize build logs and environment output; redact credentials/PII.

## 5. Candidate, health checks and promotion

1. Create immutable release image with digest and metadata.
2. Allocate candidate container, private network and read-only config; use least-capabilities runtime.
3. Probe readiness through allowlisted internal route and timeout; handle slow boot and explicit failure.
4. Generate/validate Caddy route candidate, atomically switch upstream to healthy candidate, record active deployment ID transactionally.
5. Drain/stop previous release after grace period; preserve last healthy artifact within retention/disk budget.
6. If Caddy reload, health, DB transaction or final activation fails, route back to previous healthy release and emit a structured incident.
7. Reconciler fixes partial transitions after process/VPS restart using persisted desired/observed state.

## 6. Job model

Kinds: `deployment.create`, `deployment.rollback`, `database.provision`, `database.backup`, `cron.fire`, `domain.verify`, `dns.publish`, `server.reconcile`, `certificate.renew-check`, `storage.*` as later needed. Each has idempotency key, finite retry count with backoff, maximum duration, attempts, terminal status, audit and compensation notes. Queue delivery can repeat: commands must be safe to execute more than once.

Example typed agent command (**contract sketch, not an implemented call**):

```json
{
  "version": 1,
  "commandId": "some-uuid",
  "serverId": "server-uuid",
  "workspaceId": "workspace-uuid",
  "operation": "release.startCandidate",
  "resourceId": "deployment-uuid",
  "payload": {
    "imageDigest": "sha256:...",
    "cpuLimit": 0.25,
    "memoryLimitMiB": 160,
    "internalPort": 3000
  },
  "expiresAt": "RFC3339 timestamp"
}
```

Agent independently validates signature/authorization, operation whitelist, resource ownership, image digest, deployment state, expiry, rate limits and generated mount/network paths. Reject unknown operations and arbitrary `sh -c`, `sudo`, host file paths or Docker socket passthrough.

## 7. Application runtime operations

- App log streaming redacted and bounded; no secret leakage through errors or environment dumps.
- App terminal later and only for a specific authorized container, short expiry and audit; no generic root shell.
- Environment variables encrypted server-side; in UI read-back masked and changes trigger explicit redeploy/restart policy.
- Database private by default; external access requires restricted allowlist, TLS and high-risk confirmation.
- Cron HTTP callback has target SSRF defense (no loopback/metadata/private restricted IP unless explicitly authorized), timeout, concurrency/overlap rule, retry and clear run history.

## 8. Test matrix

ZIP good/bad paths, nested archive traversal, unsupported repo/private GitHub revision, webhook replay, interrupted build, OOM/disk exhaustion, candidate failed health, Caddy reload invalid, promotion crash before transaction, concurrent deploy race, rollback missing artifacts, restart during job, stale agent command, unauthorized cross-project command, SSH command injection and localhost metadata SSRF. Verify previous live release remains accessible through all failure stages.

## 9. First deployment milestone

The first real vertical slice should accept a tiny static HTML ZIP on a test VPS and return a working HTTPS address **only when DNS/TLS are actually configured**, plus real logs and job transitions. When custom application domain is absent, the UI may offer a clearly labeled experimental IP-encoded preview hostname if a tested provider is available; it must not pretend the panel IP can host arbitrary `*.IP` DNS subdomains.
