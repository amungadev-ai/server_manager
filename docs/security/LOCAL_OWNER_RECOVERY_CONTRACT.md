# Local owner recovery — installer contract

CL-034, ADR-020. **Proposed interface; no executable recovery command is shipped.** The development profile supports password plus a saved single-use recovery code. Losing the password, authenticator and codes requires future local administrator recovery. No public reset or email dependency exists.

The installer must provide a root-only command bound to one installed Cloudlane identity. It must verify effective root and installation identity, acquire the auth-maintenance lock, and require explicit local confirmation. A remote HTTP caller, forwarded identity header or mounted application container must never grant this authority.

The command must generate a short-lived, random, single-use recovery grant through a protected local channel. Store only its purpose/installation-bound verifier, expiry, attempts and consumed state. Never set a default password, print an existing secret, accept a password as a command-line argument, write a reusable credential to logs, or expose a general host shell API. The proposed command spelling is intentionally unspecified until the installer defines its socket, service account and key custody.

Redemption must atomically invalidate existing grants, setup leases, password challenges, session families and recovery codes. Reset the password with the normal Argon2id policy and require fresh authenticator enrollment plus acknowledgement of newly generated recovery codes before any owner session can be issued. Password reset alone cannot restore resource authority. A failed transaction must leave no partial owner credentials or default access.

Audit only installation/user/request identifiers, action, outcome and time. Confirmed owner recovery must remain possible without mail or DNS credentials. The encryption key must be root-owned outside PostgreSQL; installation identity, protected transport, key rotation and encrypted backup/restore must be tested on an actual installation before release.

Required acceptance: non-root denial; wrong installation/expired/replayed grant denial; simultaneous redemption with one winner; disabled/maintenance-state default denial; revocation of every old session and challenge; no password-only bypass; lost response restart; unavailable database/key failure; redacted terminal/service logs; root-owned file/socket permissions; restore with correct and incorrect wrapping keys. These are outstanding installer/security gates, not passing tests claimed by this batch.
