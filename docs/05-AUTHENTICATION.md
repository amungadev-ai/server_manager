# 05 — Owner claim, authentication, authorization and recovery

**Status:** Proposed security implementation for the locked onboarding UX. Require threat-model review and security tests before production rollout.

## 1. Objectives and trust model

Cloudlane starts unowned and becomes an authenticated self-hosted platform operated by one owner. Public dashboard access is via HTTPS to the VPS IP or custom panel hostname, but **publicly reachable is not publicly sign-up-able**. The owner establishes the first account using a secret generated locally by the installer. Later users/teams may be invited explicitly, not self-register through a public endpoint.

**Actors:** installer operator (SSH with sudo), unclaimed visitor, claimed owner, future invited member (admin/developer/viewer), API key owner, Go agent, external GitHub webhook sender. None of these share credentials. An AI plan uses the initiating user's permissions.

## 2. Installation/claim state machine

```text
UNCLAIMED / HTTPS_READY
  -> CLAIM_ISSUED (short-lived, one-time)
  -> CLAIM_VERIFIED / SETUP_TRANSACTION_OPEN
  -> OWNER_CREATED / PASSWORD_SET
  -> MFA_ENROLLMENT / RECOVERY_CODES_ACKNOWLEDGED
  -> CLAIM_CONSUMED -> AUTHENTICATED_ACTIVE

Expired claim -> CLAIM_EXPIRED -> administrator explicitly regenerates via CLI
Claim denied -> rate-limit/audit, owner unchanged
Interrupted owner creation -> protected resumable transaction; no second hidden owner
```

### Claim code generation and handling (proposed controls)

- Generate at least 128 bits of cryptographically secure entropy; show in the installer terminal only once, never embed in dashboard JS or QR URL sent to third parties.
- Store a keyed/hash representation in root-protected installation state, with TTL (e.g. 20 minutes), usage counter, instance ID binding and a transactional one-time-consume flag. TTL and attempts must be configurable via reviewed security policy.
- Submit it only to a trusted HTTPS origin; never via URL query string, browser history, analytics, referrer or logs. Rate limit by source and by instance; audit attempts with token redacted.
- Validate claim and owner creation within a transaction/lease to prevent concurrent double-claim. Unclaimed status endpoint returns only coarse `unclaimed/claimed` and safe platform version; no verifier, email or secret data.
- After claiming, permanently disable first-owner open signup until an administrator deliberately invokes a **separately authenticated recovery** CLI path.
- If HTTPS cannot be established, bind setup server to `127.0.0.1` and require SSH tunnel; do not expose first-owner form as public HTTP.

## 3. First-run UI pages

1. **Welcome / secure access check:** display actual `https://SERVER_IP`, certificate readiness, product identity, no security warning bypass.
2. **Claim this installation:** claim secret input, expiry explanation, attempt limits, recovery CLI help. `POST /api/v1/bootstrap/claim`.
3. **Create owner:** email, password and confirmation, password manager/autofill support; account created only after claim validated.
4. **Protect account:** enroll TOTP MFA (or passkey if implemented), verify code once, download/print one-time recovery codes; require acknowledgement.
5. **Workspace setup:** choose friendly workspace; optional server nickname; defer domains.
6. **Ready:** real health checks, panel access address, admin help, sign in/out.

**Open decision:** TOTP vs passkeys as required first release. Suggested MVP is password + optional/passkey-ready TOTP, but at least MFA setup must be prominently offered and enforced for high-risk actions; production policy decided by security ADR.

## 4. Login sessions (proposal)

- Validate credentials server-side; modern memory-hard password hash such as Argon2id with benchmarked parameters, salts and optional server-side pepper stored outside DB. Do not hand-roll crypto.
- Prefer **opaque, rotating, server-stored session handles** delivered in `Secure; HttpOnly; SameSite=Lax/Strict; Path=/` cookies. Set the correct cookie host/path for IP and optional hostname. Use anti-CSRF strategy for state-changing cookie-auth requests, and strict Origin/Host checks.
- Rotate session identity on login, privilege elevation and sensitive account changes; revoke on logout and password/recovery changes. Store only session hash plus metadata/expiry on the server.
- Rate limit failed logins and claims, monitor unusual activity, avoid account/email enumeration, support temporary lockout/backoff without offering a denial-of-service vector.
- Use short idle timeouts plus configurable absolute lifetime; require reauthentication/MFA for credentials, admin email, agent access, infrastructure deletion, API key generation and DNS/SSL critical operations.
- Never persist bearer auth tokens, plaintext passwords, S3 credentials or private keys in browser localStorage. Non-sensitive palette preferences and launcher position may persist there.
- Protect API from CORS credential wildcarding and CSRF. A static frontend needs backend enforcement on every call; hiding buttons is insufficient.

OWASP reference: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html and https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html.

## 5. Multifactor and recovery (proposal)

- For TOTP: encrypt MFA seeds at rest, show provisioning secret once, verify initial TOTP before enabling, accept only a small clock window and reject replay, rate-limit failures.
- Generate single-use recovery codes, show once, store hashes, log use and notify owner. Codes must remain recoverable by owner, not readable by support/agents.
- Do not send recovery links via an unconfigured local mail server. Initial VPS owner recovery should use a documented local `cloudlane auth recover` CLI with OS administrator access and an audit trail.
- Security changes invalidate relevant sessions and rotate/revoke API keys when appropriate. An account recovery CLI must require local elevated privileges and generate a short-lived recovery session, never a reusable default password.
- Test complete loss-of-MFA, backup restore, clock skew and compromised session cases.

## 6. Authorization and scopes

**MVP:** a single `owner` account with strict owner-only operations. Build policy framework now for later `admin`, `developer`, `viewer`, service-scoped privileges. Role policy is not satisfied by static UI role toggles in the old demo.

| Operation | Default owner | Developer (future) | Viewer (future) |
| --- | --- | --- | --- |
| View project and ordinary logs | Allow | Project-scoped | Project-scoped read-only |
| Deploy/rollback app | Allow | With project grant | Deny |
| Connect custom hostname / change DNS | Allow | Explicit domain permission only | Deny |
| Create DB user / access DB console | Allow with step-up | Explicit DB-scoped grant | Deny |
| Start container terminal | Step-up + service permission | Explicit session grant only | Deny |
| Generate/revoke platform API key | Owner or authorized admin with step-up | Own scoped keys if policy allows | Deny |
| Host OS SSH | Outside Cloudlane | Outside Cloudlane | Outside Cloudlane |
| Approve AI mutation | Required plus underlying capability | Only permitted operations | Deny |

Every request validates actor, workspace/project/service, operation, resource state and time-bound capability; audit `allow/deny` without secrets. Agent independently rejects out-of-scope operations even if an API bug occurs.

## 7. API keys vs sessions vs agent credentials

- Browser: cookie-backed session.
- Platform API clients: independently generated, hashed API keys with explicit scopes, expiration, rotation and revocation; one-time secret display; never SSH credentials.
- Go agent: service identity with signed, short-lived scoped operation commands on private transport; cannot authenticate as a human.
- GitHub: GitHub App installation/repo-scoped credentials, verified webhook signatures, token refresh/revocation; never use a human owner's Cloudlane password.
- Storage buckets: provider-scoped delegated credentials; never reuse API keys, SSH, or agent tokens.

## 8. Proposed endpoints

```http
GET    /api/v1/installation/status          # safe unclaimed/active signal
POST   /api/v1/bootstrap/claim              # exchange one-time installer secret
POST   /api/v1/bootstrap/owner              # consume claim transaction to create owner
POST   /api/v1/auth/login
POST   /api/v1/auth/mfa/verify
GET    /api/v1/auth/session
POST   /api/v1/auth/logout
POST   /api/v1/auth/reauthenticate
POST   /api/v1/auth/recovery-codes/regenerate
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId
POST   /api/v1/api-keys                     # scoped user/API credentials
DELETE /api/v1/api-keys/:id
```

Backend must expose an OpenAPI contract and error envelope. Bootstrap endpoints are disabled once active except explicit local maintenance path; no public `POST /register`. Use idempotency and state preconditions; return 409 on stale claim state and 429 on throttling.

## 9. Threat-based tests

- Anonymous reads and mutations blocked; no route leaks secrets prior to claim.
- Two simultaneous first-owner attempts produce exactly one owner.
- Expired, guessed, replayed, cross-instance claim codes fail.
- Login rate limits, enumeration resistance and session fixation/CSRF/XSS checks pass.
- Stolen/expired/revoked cookie cannot access API. Cookie flags verified on IP and custom hostname.
- Role downgrade revokes terminal and sensitive sessions.
- MFA enrollment/recovery codes are never logged; replayed TOTP/recovery code denied.
- API key cannot call SSH/agent or bypass resource scope. Open redirects/callback origins rejected.
- Database restore does not silently recreate unclaimed install or wipe current owner.

**Production gate:** security review, automated negative tests, and manual verification on fresh VPS over real trusted TLS. No code is in this kit that passes these tests yet.
