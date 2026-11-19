# ADR-020 — MFA, recovery codes and owner authentication screens

2026-11-19 (Africa/Nairobi), CL-034/035. **Proposed development profile; independent security review and production activation remain closed.** Extends ADR-019 and supersedes its password-only review-session behavior.

## Authentication boundary

Successful password verification now creates a separate five-minute, single-use, CSRF-bound challenge. It grants no owner/resource permission. The normal API entry point still has no activation switch; review authentication requires direct HTTPS and rejects production mode. The review runtime also requires an explicit 32-byte MFA wrapping key; no default, database-derived or browser key is permitted.

TOTP uses the maintained `otpauth` implementation of RFC 6238, a 160-bit random secret, SHA-1, six digits and a 30-second step with a ±1-step validation window. Database time selects the window. A factor row lock and monotonically increasing accepted step reject replay across requests/runtimes. TOTP secrets are AES-256-GCM encrypted with a fresh nonce and authenticated installation/user binding. Missing/wrong key or modified ciphertext fails closed. Production root-owned key-file custody, rotation and backup/restore are separate installer/security gates; keys never enter source, evidence or browser storage.

Enrollment exposes the setup secret/otpauth URI once per challenge, verifies a code, then returns ten independently random 128-bit recovery codes once. The database stores only user/generation-bound recovery verifiers. The password-stage challenge credential and CSRF nonce rotate after factor verification. The user must explicitly acknowledge saving the codes before a full session is issued. A lost enrollment response can be restarted with password verification; fresh code display invalidates older recovery generations. No endpoint retrieves plaintext saved codes.

Normal MFA verification issues a new owner cookie after checking challenge expiry, attempt ceiling, current password fingerprint, factor epoch and fresh TOTP step. Recovery-code verification also requires the password challenge, consumes the code atomically, revokes existing families and increments the factor epoch. Concurrent use has one winner. Other pending challenges and old sessions cannot survive a critical epoch change. Session rotation preserves its verified factor epoch and absolute lifetime. Password-only/legacy rows are never upgraded into full sessions.

Recovery-code regeneration requires an authenticated session, CSRF, current password and fresh TOTP. It revokes older codes/sessions and produces a new acknowledge-before-session flow. No public MFA-disable, email recovery or unauthenticated reset is added. Local administrator recovery is specified in `docs/security/LOCAL_OWNER_RECOVERY_CONTRACT.md`; the executable root/installation-identity integration remains an installer task, not a pretend working command.

All business denials persist bounded challenge attempts/audit state under the transaction rather than rolling attempts back. Global/source throttling precedes challenge work. Existing exact Host/Origin/custom-header, cookie flags, JSON limits and query-secret rejection remain enforced. Session/context authority is server-derived; clients never promote a password-stage response to owner state.

## UI

Separate `/setup`, `/login`, `/recover` and `/auth/security` routes reuse Cloudlane tokens/fonts without changing dashboard markup or prototype CSS. Forms use same-origin typed API requests and per-flow in-memory CSRF state. Passwords, setup keys, recovery codes and nonces are cleared on transitions/disposal and never enter localStorage/sessionStorage, URLs, logs or external QR services. QR codes are generated locally.

The published static demo offers a clearly labelled walkthrough using read-only synthetic values; it never accepts real credentials or pretends to create an account. HTTP builds refuse secret-entry controls on insecure origins or an unconfigured API. Actual UI contract fixtures and real PostgreSQL/HTTPS protocol tests are labelled separately; mocked browser transport does not establish real CA/Caddy/VPS acceptance. Existing direct prototype comparisons remain required.

## Evidence and gates

Append migration 0003; never rewrite 0001/0002. Required negative tests include password-only bypass, nonce/expiry/attempt/generation checks, TOTP vectors/replay, wrong encryption key/ciphertext, single-use recovery races, factor epoch revocation, regeneration step-up, no secret retrieval/storage, HTTPS/Origin/CSRF and UI state/error/focus/mobile behavior. Independent security review, operational local recovery, public TLS/Caddy, real-client deployment and backup/restore remain open.

Primary references: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), [otpauth](https://github.com/hectorm/otpauth), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
