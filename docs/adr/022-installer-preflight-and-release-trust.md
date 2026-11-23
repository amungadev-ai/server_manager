# ADR-022 — Read-only host preflight and pinned release trust

Status: proposed development candidate; independent security review pending
Date: 2026-11-23
Task: CL-080
Decision owner: task claimant recorded in CL-080
Review: pending; no publisher key or production release exists

## Context

The primary certification target in `docs/04-INSTALLATION.md` is a dedicated Ubuntu 24.04 LTS x86_64 VPS. Its 1 vCPU / 1 GB RAM / 10 GB disk floor is explicitly unverified. CL-080 prepares diagnostics and distribution trust; CL-081 owns host mutation, journal, resume and service installation. CL-005 independent review is still outstanding. Development of this isolated candidate does not approve that proposal or enable installation.

## Decision

Use a dependency-free Go module in `installer/`, pinned to Go 1.27.4. Expose only `preflight`, offline `verify`, `version` and help. There is no install, repair, shell, download, override-root, skip-check or force command. Host collection uses fixed read-only Linux paths, bounded parsers and filesystem metadata; it never invokes a subprocess, connects to Docker or changes host state.

Preflight rejects unsupported OS/architecture, missing systemd PID 1, known containers, unavailable/malformed observations, reserved TCP 80/443 or UDP 443 bindings, existing Cloudlane paths, existing proxy/runtime markers and unsafe/read-only platform parent directories. It reports RAM/available RAM/swap, logical CPUs, data-filesystem bytes/inodes and cgroup-v2 controller observations. Provisional resource floors yield a warning, never a certified capacity claim. Existing install markers are checked by metadata only: no identity, credential, database or journal content is read. Reruns never initialize or reset identity.

The report always has `ready_to_install: false`. Deferred checks cover effective resource budgeting, host/network namespace and dedicated-VPS assurance, actual inbound public IP/IPv6/DNS/repository/ACME reachability, firewall/Docker policy, secure staging/root mutation/journaling and clock synchronization. A clean snapshot is `incomplete`; conflicts or unknown mandatory observations produce `blocked`. Preflight cannot eliminate races; CL-081 must acquire its protected lock and repeat checks immediately before every relevant mutation, verify postconditions and preserve a durable journal.

The offline verifier is a candidate for a *previously trusted verifier*, not a self-authenticating bootstrap. It requires all of: an independently authenticated raw 32-byte Ed25519 public key, its separately pinned lowercase SHA-256 fingerprint, an explicitly selected exact three-component version, an exact-byte manifest and detached raw 64-byte signature, and a local regular artifact. No trust key, version or executable is fetched. Trusting a key supplied beside an untrusted download defeats this boundary.

Manifest v1 is a flat UTF-8 JSON object with exactly these required fields: `schema` (1), `product` (`cloudlane-installer`), `version` (canonical numeric `major.minor.patch`), `platform` (`linux-amd64`), `filename` (`cloudlane-installer_<version>_linux_amd64`), lowercase `sha256`, integer `size` (1..134217728), and canonical UTC-second `issued_at` / `expires_at`. Reject duplicate/unknown/missing/null fields, trailing JSON, oversized metadata, unsupported platform, wrong filename/version/key/digest/size/signature, future issuance beyond five minutes, expired metadata and a lifetime over 30 days. Sign the ASCII prefix `CLOUDLANE-RELEASE-MANIFEST-V1` followed by one LF byte and the **original manifest bytes**, including any final newline. No JSON reserialization/canonicalization is performed. This protocol is separate from the proposed agent-envelope protocol in ADR-015/017.

Successful verification authenticates only that local artifact against that key, version and current-time window. It neither executes nor extracts the artifact, nor validates OCI images, dependencies, provenance, host readiness or release revocation. Report `scope: offline-artifact-only` and `ready_to_install: false`. This also avoids a verify-then-execute race: execution is not implemented.

## Distribution and activation gates

Before any public installer command: independently review the protocol/bootstrap verifier and key custody; provision an offline publisher root with documented fingerprint distribution, key rotation/revocation and emergency compromise procedure; publish reviewed version-pinned verifier/packages with independent authentication; sign immutable manifests and artifacts; bind source/build provenance and all component/image digests; define trusted revocation metadata and persistent monotonic rollback protection; verify dependency repositories and clock health. No generated test key may become a production trust anchor. CI never signs production artifacts or receives infrastructure credentials.

The eventual bootstrap must download as an unprivileged user into private, non-symlink staging, authenticate the verifier through the independent trust channel, verify all bytes, then hand verified immutable inputs to a narrowly privileged installer. Do not advertise `curl | bash`. CL-081 must resolve custody, secure ownership, concurrent execution, crash/power-loss recovery and descriptor-safe execution before implementing this handoff. CL-082 proves trusted IP TLS/renewal or secure tunnel fallback; CL-083 owns claim/agent identity. `docs/04-INSTALLATION.md` remains the complete product contract.

## Alternatives

Shell-driven host discovery would add subprocess/quoting and distribution dependencies; fixed Go readers are easier to bound and test. An unsigned checksum authenticates no publisher. Fetching a key from the artifact channel gives no independent trust. A full TUF/Sigstore distribution system would address additional rotation/revocation/provenance concerns but requires operational identities and a separate reviewed design. The small offline verifier is deliberately insufficient for public release until those gates are resolved.

## Security and resources

Do not emit host addresses, hostnames, process arguments, file contents, instance IDs or exception text. Diagnostics contain fixed check codes/messages, bounded numbers and normalized runtime platform only. The `/proc/net` snapshot is scoped to the process network namespace, so even free ports cannot prove public availability. Known container detection is conservative, not proof that a host is dedicated. No production RAM/disk floor, arm64/22.04 support or privileged operation is certified here.

## Compatibility

This adds no HTTP/browser API, database migration, agent capability or dashboard change. The supplied prototype remains untouched. JSON reports are versioned separately from the signed manifest. Ubuntu 24.04 amd64 is the only candidate target; other targets fail closed. Production installation and the default-deny API remain disabled.

## Acceptance evidence

Run `cd installer && go test -race -count=1 ./... && go vet ./...`, format checks, static reproducible builds and a real Linux host diagnostic smoke test. Negative fixtures cover OS/architecture/container/systemd, resources, malformed/oversized input, permissions/storage/ports/runtime/identity conflicts, time, key substitution, metadata and artifact tampering. Required hosted CI must include installer tests without an optional or skipped gate; existing PostgreSQL/browser/prototype checks continue. Exact results and environmental limits belong to `tasks/progress/CL-080.md` and the batch evidence, not this prospective checklist.

Upstream references checked 2026-11-23: [Go release/downloads](https://go.dev/dl/), [Ed25519 implementation](https://go.dev/src/crypto/ed25519/ed25519.go), [Linux proc network namespace semantics](https://man7.org/linux/man-pages/man5/proc_pid_net.5.html). These guide implementation and do not constitute Cloudlane security approval.
