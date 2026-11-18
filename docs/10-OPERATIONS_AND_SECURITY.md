# 10 — Security, observability, backups and operations

## 1. Threat inventory

1. Attacker reaches unclaimed setup endpoint or guesses claim secret.
2. Stolen session/API credential bypasses account or resource scopes.
3. Malicious ZIP/GitHub project escapes build/runtime isolation, reads agent/DB/certs or exhausts the VPS.
4. Domain takeover / DNS spoofing / unverified routing / ACME issuance abuse.
5. SQL injection or unsafe DB console command exposes customer data.
6. Cron callback SSRF touches cloud metadata, host or agent private interfaces.
7. S3 grants leak private KYC documents or signed URLs through logs.
8. Missing backup key, disk exhaustion, certificate renewal failure or broken upgrade causes outage/data loss.
9. A compromised AI tool, terminal or webhook turns suggested operations into unrestricted host commands.

Each risk needs specific mitigation, owner, tests and monitoring. Public multi-tenant arbitrary uploads require a separate isolation threat model before launch.

## 2. Secrets and access

- Prefer a dedicated envelope-encryption scheme and root-protected key material outside PostgreSQL; document rotation/recovery. Encryption alone does not compensate for an untrusted API with keys in memory.
- Never store service secrets or passwords in HTML/localStorage or unredacted job logs. Do not print them into CI output or progress files.
- Separate platform owner session, API-key scope, GitHub installation token, DB user password, bucket grant credential, agent identity and host SSH key. Revocation paths for each are mandatory.
- Add Content Security Policy, secure headers, CSRF/origin defenses, strict upload validation and security review for frontend+API integration.
- All privileged agent operations are allowlisted, authenticated, expiry-limited and logged; reject host filesystem paths and unknown commands.
- Client UI may hide forbidden controls, but API and agent must reject forbidden actions regardless.

## 3. Audit and logging

Audit fields: actor, workspace ID, resource ID, action, outcome, timestamp, correlation/request ID and contextual policy decision. Redact passwords, claim codes, recovery codes, auth cookies, API tokens, signed URLs, private media bytes and secrets. Log allowed+denied sensitive actions; apply retention and tamper resistance. Application logs are separate from Cloudlane platform security events.

Metrics: memory working set, OOM kills, CPU saturation, disk bytes/inodes, PostgreSQL size/connections, queue age/depth/retry, agent heartbeat age, Docker health, Caddy route health, certificate renewal deadline, external storage provider errors, backups and restore age. Alerts need recipient configuration that does not assume local mail is provisioned.

## 4. Backups and disaster recovery

**Must back up:** platform DB plus migration version, encrypted secret key recovery material, installation identity, Caddy/ACME state, release artifact inventory, named persistent volumes where promised, DNS zone revisions and service config. **Must distinguish:** platform metadata backup from customer DB/data backup and object-storage provider policies.

- Store encrypted backup **off the VPS** and verify integrity/retention; local-only snapshot is insufficient against VPS loss.
- Backups must not duplicate exposed plaintext secret credentials; key restore has a separately protected procedure.
- Restore drill on disposable fresh VPS must demonstrate owner can log in, projects appear, agent identity safely rebinds, secrets decrypt, DNS/certs remap, and customer DB volumes recover according to promised RPO/RTO.
- Define and test recovery point/recovery time objectives rather than inventing an SLA. Include failed DB migration and full-disk scenarios.
- Provide CLI `doctor`, `backup status`, `restore --dry-run` and scoped repairs; make destructive steps deliberate.

## 5. Installation/upgrade operations

- Keep versioned signed installer and images, published checksums, compatibility matrix and explicit migrations.
- Implement install locks, stage journal, restart supervision and repeatable repair flow.
- Preserve user data and old healthy deployment on upgrade; incompatible DB schema may require full verified restore, not naive downgrade.
- Watch public IP certificate expiry closely due to short-lived (~160-hour) validity; report renewal failure early.
- Do not modify SSH, unrelated firewall or other Docker workloads without explicit owner consent.

## 6. Starter VPS resource budget

Allocate measured memory budgets for kernel/system, PostgreSQL, NestJS+pg-boss, Caddy, Go agent, Docker daemon, container logs, one lightweight workload. Reserve disk for DB/WAL, OCI layers, source upload staging, certificates, logs, retained release and OS overhead. Define preflight headroom and admission control; refuse resource-intensive builds with actionable alternatives. Avoid unbounded staging/log files and persistent media on 10 GB root disk.

**Production readiness is contingent on profiling the entire system**; static Svelte alone does not make the API/database/runtime fit in 1 GB.

## 7. Runbook starters

### Dashboard inaccessible but SSH works

1. `cloudlane status` / `cloudlane doctor` (once implemented); inspect Caddy/service and certificate status, preserve logs.
2. Check public IP, ingress 80/443 and host firewall; do not disable firewall blindly.
3. Check TLS cert chain/expiry and renewal error; use tested repair process or custom-domain/secure tunnel fallback.
4. Verify NestJS readiness and PostgreSQL connection privately, not from an exposed management port.
5. Restore from verified backup if DB/schema corrupt; do not reset owner just to regain web access.

### Deploy stuck

Read job attempts/lease, agent heartbeat, disk and resource limits; mark stale candidate failed and retain previous live release. Replay only with same idempotency key; never duplicate active traffic binds.

### DNS breakage

Identify current authority and delegation from public resolvers. For Manual mode show records to correct at external host. For Managed mode verify all authoritative nameservers, zone revision, DNSSEC/DS and prior mail records; do not blindly overwrite.

### Compromised API key

Revoke hash server-side, invalidate sessions/related tokens according to scope, inspect audit trail, rotate affected external credentials, notify owner and document incident.

## 8. Security release gate

Use OWASP ASVS and relevant authentication/session guidance as a baseline for requirement-driven testing. Require peer review for credentials/agent/installer, dependency/SBOM scan, container hardening, HTTP authorization-negative tests, penetration exercise on single-owner exposure model, completed restore drill, resource exhaustion and IP TLS renewal tests. All failure modes remain accessible as diagnostics, not silently classified healthy.
