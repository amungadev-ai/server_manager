# 04 — Installation, first-run onboarding, upgrades and recovery

**Locked product outcome:** A user with a fresh Ubuntu VPS, public IP and SSH access runs one verified installer; Cloudlane becomes available on `https://SERVER_IP` with a trusted certificate **when eligible**, without requiring a custom domain. SSH tunneling is a **fallback**, not the default onboarding path.

## 1. Installation profiles / baseline

- **Primary certification target:** Ubuntu 24.04 LTS x86_64 on a dedicated VPS with public IPv4 (IPv6 to be tested). Test Ubuntu 22.04 separately before declaring support. Don't quietly promise 20.04 support without maintained OS support and test coverage.
- **Control-plane floor (unverified):** 1 vCPU, 1 GB RAM, 10 GB usable disk. Define disk preflight after actual image sizes, rollback budget and PostgreSQL WAL are measured. Fail with a human explanation rather than crashing mid-install.
- **Recommended standard:** 2–4 GB+ for local builds, databases and concurrent services.
- Install only platform dependencies. User databases, self-hosted mail, media storage and build services are opt-in.
- Prefer prebuilt, signed/provenance-stamped release artifacts and OCI images; never compile dashboard/api on the customer's 1 GB VPS.

## 2. Installer state machine

```text
NOT_INSTALLED
  -> DOWNLOADED -> SIGNATURE_VERIFIED -> PREFLIGHTING
  -> AWAITING_EXPLICIT_CONFLICT_RESOLUTION (optional)
  -> PREPARING_HOST -> INSTALLING_COMPONENTS -> MIGRATING_PLATFORM_DB
  -> STARTING_INTERNAL_SERVICES -> CONFIGURING_HTTPS
  -> READY_TO_CLAIM -> OWNER_CLAIMED -> ACTIVE

For recoverable failures: FAILED_RECOVERABLE -> REPAIR/RESUME
For unrecoverable errors: FAILED_SAFE -> DIAGNOSTICS + scoped rollback
Upgrades: ACTIVE -> BACKUP_CHECK -> UPGRADE_STAGED -> MIGRATION -> HEALTH_CHECK -> ACTIVE
```

Persist every stage with timestamp, installer release version, checksum, preflight results, component status, resumability and sanitized diagnostic code. **A stage is complete only after postcondition checks.** Installer reruns must detect existing install identity and offer resume/repair/upgrade—not destructive reinstall.

## 3. CLI and distribution (proposal)

Distribute an `install.sh` bootstrap only as a way to fetch a **version-pinned, signature-verified installer binary**. Never normalize an unreviewed `curl | bash` command as the sole installation method. A safe public document should show download, verify signature/checksum, inspect release version and run. Example **nonfunctional syntax**:

```bash
# Example CLI shape; not a command users can execute yet.
sudo ./cloudlane-installer install --version 0.x --profile starter
sudo cloudlane doctor
sudo cloudlane status
sudo cloudlane repair --dry-run
sudo cloudlane upgrade --version 0.x
sudo cloudlane uninstall --dry-run
```

A real installer should refuse unsupported architectures, incompatible software and existing install conflicts rather than mutate unrelated data.

## 4. Preflight checks

| Category | Check | Failure handling |
| --- | --- | --- |
| OS | Supported Ubuntu version/arch, systemd, kernel/network capability | Hard stop with supported versions |
| Resource | Effective RAM, CPU, free disk/inodes, swap, cgroup support | Hard stop or require selected tested profile |
| Permissions | Root via explicit sudo, secure temp dirs, private umask, persistent state directory | Hard stop |
| Network | Public IP detection and reachability, IPv4/IPv6 correctness, DNS resolution, outbound repo/ACME reachability | Show tested access path and failure category |
| Ports | 80/443; SSH port not touched; check proxies/HTTP services and firewall impacts | Explain conflict, never silently kill another web server |
| Runtime | Existing Docker version, daemon configuration, conflicting networks, published ports | Reuse if safely supported, else stop |
| Storage | Mount permissions, file system capacity, backup target configuration | No partial unsafe install |
| Dependencies | Signed release available, repository checksums, time sync | Fail closed |
| Existing instance | Instance ID, DB schema, current install/upgrade lock | Choose repair/upgrade, not duplicate initialization |

Docker on Ubuntu can interact with firewall rules in ways that bypass common UFW expectations; installer must test actual exposed ports and avoid automatic firewall resets. See https://docs.docker.com/engine/install/ubuntu/ and https://docs.docker.com/engine/network/packet-filtering-firewalls/.

## 5. Host layout and ownership (proposal)

Reserve fixed private locations, not arbitrary client-supplied host paths:

```text
/etc/cloudlane/                 # root-only config and encrypted install identity references
/var/lib/cloudlane/             # platform DB volumes, cert state, artifacts, agent state
/var/log/cloudlane/             # bounded installer/component logs with redaction
/run/cloudlane/                 # locally protected agent IPC and pid/lock files
/opt/cloudlane/releases/<ver>/  # versioned binaries/static bundles; immutable
```

Create dedicated service users where possible; set filesystem ownership and permissions explicitly. Root is required for limited host bootstrap; dashboard/API should run unprivileged. Never bind the agent's privileged socket into customer containers. Implement systemd restart ordering and automatic recovery on reboot.

## 6. Platform installation steps

1. Create persistent install identity and a signed installation plan with known expected changes.
2. Install/reuse compatible Docker Engine; configure private networks and no public daemon API.
3. Deploy low-memory platform PostgreSQL with private binding and migrations.
4. Deploy NestJS API + bounded pg-boss worker; readiness checks.
5. Install Go agent and encrypted local control channel; register typed capabilities and server identity.
6. Install Caddy and static dashboard; route `/api/v1` privately, configure storage for persistent TLS certificates.
7. Enable `cloudlane status` health diagnostics, bounded logs, metrics and restart supervision.
8. Provision trusted HTTPS for the public panel IP if supported; only then activate publicly reachable claim workflow.
9. Generate one-time claim secret in protected storage and display it once in the installer terminal; show URL and time limit.
10. Complete owner setup in browser. Mark install ACTIVE only after auth, DB, queue, agent, Docker and Caddy checks pass.

## 7. IP-first public HTTPS

Publicly trusted IPv4/IPv6 certificates are offered by Let's Encrypt as **short-lived, ~160-hour certificates**; the ACME client must select the `shortlived` profile and automated renewal is mandatory. See https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability. The chosen Caddy version/configuration must be proven compatible with public **IP** certificates and issuance/renewal under realistic conditions. A generic Caddy internal self-signed certificate is NOT an acceptable substitution for a public trusted certificate.

- Discover public IP via multiple signals; do not trust a single external "what is my IP" service as proof of inbound reachability.
- Configure temporary ACME challenge accessibility on 80/443 without exposing owner-claim forms before TLS.
- Confirm certificate SAN includes the exact IP; check chain trusted by supported browsers.
- Persist ACME account/key/certificate storage securely and test repeated renewal well before expiry.
- Set alerts and a fallback plan for failed renewal (no warning bypass).
- IPv4/IPv6 issuance are separately verified; no assumption of unlimited CA availability.
- On IP change, preserve owner identity, re-issue certificate after validation and publish operational warnings.
- If public IP certificate is unavailable, offer a **custom hostname** and, as last secure fallback, a loopback-only setup endpoint over SSH tunnel. Never ask users to type owner credentials over plaintext public HTTP or ignore certificate warnings.

## 8. First-run browser wizard

`Claim → Owner credentials → MFA/recovery → Workspace → Optional networking → Health/Finish`

- Protected claim code printed to the terminal; short expiry; hashed on disk; single-use and bound to instance. Details in `05-AUTHENTICATION.md`.
- Owner email/password initially; confirm MFA/recovery. No public sign-up and no default administrator password.
- Workspace name, server nickname optional, default production environment creation deferred until project creation.
- Domain optional: panel stays reachable by IP; DNS Settings later handles custom panel and app base domain.
- Final health screen shows real component checks, not synthetic badges. Provide `cloudlane doctor` CLI for offline recovery.

## 9. Failure, resume, uninstall, upgrade

- **Resume:** record idempotent stage identifiers and a durable install transaction; rerun skips already healthy steps and safely retries failed ones.
- **Rollback install:** remove only Cloudlane-owned resources; never delete preexisting Docker installations, unrelated Caddy config, host files or firewall policy.
- **Backup:** keep secure off-host encrypted backups of platform data + key recovery materials; verify restore before first stable release.
- **Upgrade:** backup/restore point, version compatibility check, migrations, health verification, reinstall fallback; DB schema migrations may not be reversible, so plan forward repair/restore.
- **Uninstall:** explicit confirmation, preview of data loss, export/backup opportunity, separate remove-runtime and purge-data modes.
- **Incident recovery:** external SSH/provider console, `cloudlane doctor`, reinstall verified package, decrypt/restore backed-up state without losing service identity.

## 10. Installer tests and exit gate

Fresh installation, idempotent rerun, interrupted network, power loss mid-migration, full disk, 80/443 conflict, Docker preinstalled, failed TLS and secure tunnel fallback, expired/reused claim code, time skew, reboot service restoration, off-host restore, upgrade rollback and unsupported OS. Test on both starter and standard profiles. Do not call install "one-command production-ready" until these tests actually pass on provisioned VMs.
