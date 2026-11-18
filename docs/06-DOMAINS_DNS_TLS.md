# 06 — Domains, DNS, generated service URLs and TLS

## 1. Locked user experience

- The Cloudlane dashboard installs on the **server's public IP** by default: `https://SERVER_IP` once trusted IP TLS is obtained. Domain not required; a custom panel domain can be added later without dropping IP access.
- The dashboard address and the **Application Base Domain** are **independent** settings. Example: `panel.example.com` and `apps.example.com`.
- **Domains → Add Domain** has ONE input (`example.com`) and **Add domain** button. It creates a pending Manual DNS record and opens the domain Overview; do not force DNS setup during creation.
- All domain management lives in exactly seven tabs: **Overview → DNS Records → Subdomains → Connections → SSL → Email → Settings**.
- **Domain Settings** contains Manual DNS (default) vs optional Cloudlane Managed DNS. The change is staged and verified; it is not an immediate checkbox.
- Application/domain attachment only selects an existing verified and available hostname from central registry; no duplicate add-domain/DNS UI inside app deployment.

## 2. Control-panel hostname vs service hostname

| Class | Example | Requirement |
| --- | --- | --- |
| Dashboard IP | `https://203.0.113.42` | Default; public trusted IP cert if eligible |
| Dashboard custom | `https://panel.example.com` | Optional verified DNS/HTTPS |
| App base | `apps.example.com` | Optional parent chosen from verified Domain Registry |
| Generated app | `maidfinder-api.apps.example.com` | Auto-generated after base is configured |
| App custom | `api.maidfinder.com` | Selected verified hostname, can coexist with default |
| Experimental IP-encoded fallback | `maidfinder-api.203-0-113-42.sslip.io` | Proposed **testing/preview** only; depends on third-party DNS and CA rate limits |

`*.203.0.113.42` is not a conventional valid DNS subdomain scheme. An IP certificate covers an IP literal, **not** arbitrary hostname prefixes under that literal. A default application URL cannot be guaranteed until either an owned app base domain or managed default-domain service is available; a shared IP-encoded DNS provider is a convenience fallback only if tested and made explicit.

## 3. Manual DNS mode

The existing external DNS host remains authoritative. Cloudlane maintains a **local record checklist/proposed desired state** but does not claim to publish those records. DNS Records shows record type, hostname, expected value/TTL, observed public result, mismatch instructions and verification timestamp. The owner copies values at any registrar/DNS hosting provider, even without an API.

- TXT ownership challenge must be unique, generated securely and checked against **public authoritative DNS**, not merely a locally editable zone table.
- A/AAAA records point hostnames to the right VPS (or other selected server). Cloudlane checks resolution and ownership before activating route and certificates.
- MX/SPF/DKIM/DMARC and external verification records remain visible and must not be destroyed by project domain assignment.
- Project binding requires domain verification + compatible host availability + no routing conflict.

## 4. Cloudlane Managed DNS mode

Cloudlane manages DNS from its UI only after the domain registrar delegates NS to real **independently hosted authoritative nameservers**. This feature is **not** supplied by the single local VPS or by a mock nameserver label. A production service needs primary/secondary with separate failure domains, authenticated synchronization, safe record publishing API, revisioning, backup, rollback, monitoring, tenant authorization, DNSSEC/DS validation, glue records when required, and an operational DNS SLA.

Staged migration:

```text
MANUAL_ACTIVE -> DRAFT_MIGRATION -> PREFLIGHT
             -> AWAITING_REGISTRAR_DELEGATION
             -> VERIFY_AUTHORITATIVE_SERVERS_AND_DNSSEC
             -> MANAGED_ACTIVE
       failure/cancel -> MANUAL_ACTIVE retained
```

Require a preview diff of ALL A/AAAA/CNAME/TXT/CAA/MX/SRV/etc records and domain-level delegations, including SPF/DKIM/DMARC, existing mail and verification entries. Preserve previous NS access until cached delegation stabilizes. Do not say `Managed DNS enabled` if no actual nameserver infrastructure is deployed. Manual mode remains supported regardless of whether optional managed DNS is available.

## 5. Application base-domain setup

From verified Domain Registry choose `apps.example.com`, then instruct owner to configure `*.apps.example.com` A/AAAA toward correct server (and base record separately if the apex itself is required). The controller allocates collision-free service slugs (e.g. `maidfinder-api`) and records exact hostname bindings. Caddy routes by hostname and environment to the current **healthy active** release.

For SSL, per-host certificates through ACME are an MVP-friendly option. A wildcard certificate is a separate choice requiring DNS-01 support/privileges, not something we can obtain from HTTP-01 alone. Validate CAA restrictions and respect CA rate limits. Reference https://caddyserver.com/docs/automatic-https.

## 6. IP HTTPS and renewal

Let's Encrypt IP certificates are publicly available, short-lived (~160 hours), and require ACME short-lived profile support. Renewal must be automated, monitored and tested at the actual installer/Caddy version combination. A fallback internal/self-signed certificate is **not** browser-trusted by default. See `04-INSTALLATION.md`.

## 7. Data model and endpoints

Entities: `domain_zones`, `dns_records`, `domain_hostnames`, `domain_bindings`, `dns_mode_transitions`, `dns_checks`, `tls_certificates`, `certificate_events`. Model ownership verification separately from NS delegation and route readiness; they are not interchangeable.

```http
POST /api/v1/domains                         # one-field creation
GET  /api/v1/domains
GET  /api/v1/domains/:domainId
POST /api/v1/domains/:domainId/verify
GET  /api/v1/domains/:domainId/dns-records
POST /api/v1/domains/:domainId/dns-records  # behavior depends on active mode
POST /api/v1/domains/:domainId/dns-mode-transitions
POST /api/v1/domains/:domainId/dns-mode-transitions/:id/verify
POST /api/v1/services/:serviceId/domain-bindings
DELETE /api/v1/services/:serviceId/domain-bindings/:bindingId
GET /api/v1/certificates/:id/status
```

Each route needs owner authorization, atomic conflict checking, sanitized errors and audit events. A DNS transition must not silently detach existing service/domain associations.

## 8. Acceptance tests

- Add Domain has one field and defaults to Manual DNS; seven tabs and Settings mode selection preserved.
- Manual verify fails if public challenge is absent/wrong, even if mock/local record exists.
- Managed verify fails until authoritative nameservers are independently healthy and delegation matches, including DNSSEC.
- Existing email/DNS records and bindings survive staged switch or cancellation.
- Conflicting hostnames cannot be bound to two apps; custom binding attempts by non-owners rejected.
- Caddy config validation/atomic reload and certificate lifecycle tests succeed, including failed renewals and IP changes.
- Cloudlane remains usable by server IP when all custom domains are absent or have DNS errors.
