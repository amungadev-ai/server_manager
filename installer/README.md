# Installer — CL-080/081 development candidates

This Go module implements **read-only host diagnostics, offline artifact verification and an isolated review installation**. There is no operational root installer or host-service activation command. The explicit non-root review profile uses an existing local Docker daemon, a private workspace and host-loopback publication only. Production publisher keys/releases and independent security approval do not exist yet. See [ADR-022](../docs/adr/022-installer-preflight-and-release-trust.md) and [the full installation requirements](../docs/04-INSTALLATION.md).

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

## Restartable review installation (CL-081)

[ADR-023](../docs/adr/023-restartable-platform-installation.md) specifies the signed platform plan, filesystem custody, typed Docker policy and restart semantics. `review --operation install` requires a **new** caller-owned private directory, port 1024..65535, exact release version and independently trusted plan/key/signature pins. It runs only as non-root Linux amd64 and cannot select a remote Docker host, public bind address, container name, role, mount, shell or resource override. Help lists the concrete flags; no production plan/key exists to copy into a public install command.

The journal binds review profile, native preflight snapshot, installation/plan/version/port and database UUID. Existing native-host conflicts are recorded honestly; this private Docker profile does not convert them into host-install readiness. Atomic fsynced checkpoints and an exclusive lock protect stage progression. Private passwords/environment files are created once. Runtime env metadata is visible to trusted Docker administrators; it is never emitted in reports or placed in command arguments/image layers. Lost acknowledgements are resolved by checking actual resources before retry.

Use the same signed plan and workspace with `--operation resume`. Completed-stage drift requires `--operation repair`; repair is a **read-only dry-run** until `--apply` is explicit. `--operation doctor` checks current component postconditions without writing the journal. Missing initialized database data, changed schema/UUID, unsafe files or foreign labels/configuration fail closed. There is no purge/reset/uninstall path. Keep all private workspace files; do not copy them into artifacts or Git.

The isolated database, migrator, API and Caddy share a private platform network namespace while keeping separate filesystems/PIDs. Only Caddy 8080 is mapped to host `127.0.0.1:<selected port>`. Database/API/admin ports stay unpublished; containers have non-root users, read-only root, dropped capabilities, no-new-privileges and bounded memory/PIDs/tmpfs/logs. DB admin, migrator and runtime credentials are separate; runtime DDL and migration-ledger writes are denied. Prebuilt API/static images are assembled in CI, never compiled on the target VPS.

Internal health finishes at `awaiting_tls_and_claim`, with `ready_to_claim: false`. Plaintext setup/login/recovery/auth/bootstrap routes are blocked by Caddy, and the existing frontend also refuses insecure owner authentication. The normal API resolver remains disabled. Four systemd startup definitions are staged in the private workspace and verified offline; they are not installed or enabled. Native Docker installation/reuse, privileged file/service custody, boot/reboot, actual public TLS and capacity remain review/VPS gates.

To reproduce the **disposable development integration** on a non-root Linux amd64 machine with an existing local Docker daemon, the pinned Go toolchain and systemd-analyze:

```bash
CLOUDLANE_INSTALLER_STACK_TESTS=1 npm run test:installer-stack
```

This builds precompiled API/Caddy review images from the locked dependencies, creates uniquely labelled private test resources and checks real PostgreSQL migrations, role denial, HTTP/static routing, idempotent resume, interrupted acknowledgement, repair dry-run/apply, foreign-resource preservation, missing-data refusal, actual CLI doctor and offline systemd validation. Cleanup removes only verified resources created by the test. It does not certify a dedicated VPS, host boot, power-loss recovery or the proposed 1 GB profile. Private runtime workspaces/bundles are excluded from uploaded text reports.

CL-082 proves trusted IP HTTPS/renewal or secure tunnel fallback; CL-083 handles claim/agent identity. Independent security/publisher review and dedicated-VPS acceptance are still required before any operational host installer. The supplied dashboard/prototype remain unchanged.
