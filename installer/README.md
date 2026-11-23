# Installer preflight — CL-080 development candidate

This Go module implements **read-only diagnostics and offline artifact verification**. It has no installation, repair, download, host-shell or service-control command. Production publisher keys/releases and independent security approval do not exist yet. See [ADR-022](../docs/adr/022-installer-preflight-and-release-trust.md) and [the full installation requirements](../docs/04-INSTALLATION.md).

Use the pinned Go version in `.go-version` on Linux amd64. From the repository root:

```bash
npm run test:installer
cd installer
go run ./cmd/cloudlane-installer preflight --format json
```

Diagnostics need no sudo. Exit **0** means an incomplete snapshot with no detected blocking check, **2** means blocked, and **1** means invalid arguments or command failure. `ready_to_install` is always false. `--format text` includes the same check codes and measured resource counters. No `--root`, `--force` or `--skip` bypass exists. `CLOUDLANE_GO=/absolute/path/to/go` selects a developer toolchain for the test runner only.

Checks include Ubuntu 24.04/x86_64, systemd PID 1 and known container markers, memory/CPU/swap/data-disk/inodes, cgroup-v2 controllers, fixed parent-directory ownership/permissions/read-only mounts, TCP 80/443 and UDP 443 bindings in IPv4/IPv6, existing Cloudlane paths/lock, proxy configuration and Docker/containerd markers. Existing runtime/configuration is conservatively blocked until compatibility/reuse is designed. No Docker API, process arguments, identity/credential contents, IP address or hostname is collected or emitted. SSH is untouched. Even dangling symlink markers block a fresh install.

Observed resources are **not certified capacity**: the proposed starter floor is unverified, cgroup limits and all component/filesystem/WAL/rollback budgets need real measurements. Public reachability, namespace/dedicated-host assurance, DNS/ACME/repositories, firewall exposure, clock synchronization, secure staging, locking/journal and privileged postconditions remain deferred. A snapshot cannot reserve ports or prevent concurrent changes; CL-081 must repeat it under the installation lock.

The `verify` command requires local manifest/signature/artifact files, a previously authenticated raw Ed25519 public key, its independently pinned SHA-256 and an exact version. Run the development binary's help for flag names; [ADR-022](../docs/adr/022-installer-preflight-and-release-trust.md) specifies every byte, bound, field and time rule. Authenticating a key from the same untrusted download is insufficient. The command never executes/extracts an artifact and a successful result is scoped `offline-artifact-only`, with installation readiness false. Generated test keys are used in memory by tests and never published as trust anchors.

`npm run test:installer` requires the exact pinned Linux amd64 Go toolchain and a C compiler for race instrumentation. It runs race-enabled tests (including real loopback TCP/UDP observation), vet, gofmt, two byte-identical static builds and the actual host CLI. Ignored `test-results/installer/` contains logs, Go JSON, coverage, unsigned development binary, a sanitized host report and summary. Required CI records source/artifact hashes. Hosted Ubuntu runner evidence is not dedicated-VPS installation, arm64/22.04 support, public TLS or a tested 1 GB deployment.

CL-081 implements protected journal/resume/host services after review; CL-082 proves trusted IP HTTPS or secure tunnel fallback; CL-083 handles claim/agent identity. The dashboard/prototype and default-deny API remain unchanged by this module.
