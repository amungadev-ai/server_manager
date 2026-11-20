# ADR-021 — authenticated project metadata

2026-11-19 (Africa/Nairobi), CL-036. **Proposed isolated development candidate**, stacked on ADR-019/020. Independent security review and production activation remain closed.

## Scope and authority

Implement project create/list/detail plus the existing overview's project metadata projection. A create transaction inserts one project, one production environment, one durable idempotency record and one success audit record. This creates database metadata only: it never queues deployment, provisions a service, invokes an agent or reports server health. Other resource mutations remain unavailable. Normal API entry-point authentication remains disabled; only the existing direct-HTTPS, non-production MFA review harness wires this store.

Every query uses the server-established user/workspace/session tuple. Headers, request bodies, IDs and pagination cursors cannot establish ownership. Transactions explicitly use Read Committed isolation. Writes recheck current owner/session/factor/installation authority inside the transaction under installation -> user -> factor -> family -> session -> workspace row locks. Rotation, logout and critical MFA revocation serialize against the same family/factor authority. Expiry is checked with database time after locking. Read transactions use the same bounded authority recheck. Foreign and absent project IDs both return 404; unknown or duplicate query fields are rejected. A failed or unavailable database fails closed with sanitized errors.

## Persistence and retry behavior

Migration 0004 is append-only; earlier migrations stay immutable. Project creation accepts the existing strict name/optional slug/description contract. Generated slugs use a bounded ASCII stem and random suffix; supplied slugs remain workspace-unique. All SQL parameters are bound. Project/environment/request/audit insertion rolls back together on failure.

The required UUID retry key is scoped to the authenticated workspace and user. Store a SHA-256 digest of the normalized request and the created project ID, then return that immutable project's original create response on retries. Same-key/same-body concurrent requests produce one project/environment. Reusing the key for a different body returns 409. No silent TTL removes retry protection. Project update/delete are out of scope; adding them requires revisiting response-snapshot/retention behavior. A workspace lock enforces a 1,000-project metadata ceiling matching the overview contract; this is not a measured VPS resource allowance.

The bounded project overview permits at most 4 MiB of response JSON to accommodate 1,000 legitimate maximum-length metadata records, including JSON escapes. Session/auth and individual project responses retain the existing 1 MiB ceiling; request bodies remain 16 KiB.

List uses deterministic ascending `(created_at, id)` keyset pagination, default 20 and maximum 100 items. The opaque, canonical base64url cursor holds a version, workspace ID and anchor project ID. It is an unsigned, non-secret position marker, never authority: reject a mismatched workspace or missing scoped anchor, and resolve timestamp precision from the database rather than JavaScript dates. Forging a marker can only skip records the current owner is already allowed to list. This avoids adding a cross-purpose signing key. Concurrent new inserts may appear on later pages; no frozen-snapshot promise is made.

The HTTPS boundary permits query strings only for GET `/api/v1/projects` with the two declared pagination fields, each once. Auth/bootstrap requests and all mutations continue to reject query strings; no query can carry credentials or override workspace scope.

## UI and evidence

Keep the supplied prototype CSS/markup and demo behavior intact. HTTP project creation/listing use same-origin HTTPS, current MFA session CSRF and a memory-only retry key. Ambiguous network/server errors keep the original body/key for a safe retry; no success toast is shown before a validated API response. Reload reads durable project metadata. No resource state, credentials or nonces enter localStorage/sessionStorage. Real project dates come from API metadata; simulation data stays isolated. Service/deployment actions remain unavailable in HTTP mode.

Required evidence: real PostgreSQL/HTTPS persistence, atomic rollback, concurrent retry/different-body collision, workspace isolation for list/detail/cursors/keys, auth/CSRF/Host/Origin/expiry/revocation rechecks and unavailable-database behavior; unit client/cursor validation; actual desktop/mobile form/list/error/reload contract fixtures and unchanged direct prototype comparisons. Browser route-fulfillment fixtures prove UI behavior, not public CA/browser-to-database transport. Production roles, Caddy, key custody, backup/restore, installer/agent/VPS acceptance and independent review remain outstanding.

Primary references: [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), [application consistency checks](https://www.postgresql.org/docs/18/applevel-consistency.html).
