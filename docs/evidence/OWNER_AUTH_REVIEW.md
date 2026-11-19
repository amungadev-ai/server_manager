# CL-032/033 owner authentication review candidate

2026-11-19 (Africa/Nairobi). Canonical [draft PR #5](https://github.com/amungadev-ai/server_manager/pull/5), branch `task/CL-032-033-owner-auth-review`, is stacked on PR #4 (`cf815a214a2ad184a234a10727870b9964d682d7`). Initial shared claim: `f83b6e7367077d8bcf5775043d4c94e01abbc4d1`.

## Implemented and deliberately gated

The candidate implements actual PostgreSQL claim/setup/session state and actual Argon2id verification. It is available only to a caller explicitly constructing `OwnerAuthReview` and passing it plus direct HTTPS configuration to `createApp`. The factory rejects production mode and missing TLS. Normal `main.ts` has no activation path or environment switch. Default API tests still require anonymous protected calls to receive 401 and valid login/bootstrap declarations to receive 501.

[ADR-019](../adr/019-owner-auth-review-profile.md) records proposed lifetimes, hash parameters, cookie/CSRF/Origin rules, durable throttling and family locking. There is no independent review in PR #2. No MFA, installer account claim, real Caddy/public-IP certificate path, resource mutation, production login or security sign-off is implied. Candidate owner creation reports MFA setup required; resource handlers remain unavailable. Backup rollback/installation-epoch protection requires later off-database installer/recovery state.

## Meaningful verification

| Area | Real behavior exercised |
| --- | --- |
| Claim lifecycle | Incorrect/cross-instance/expired/replaced code, bounded persisted attempts, concurrent exchange, consumed-code replay |
| Owner lifecycle | Expired/revoked setup, CSRF and caller-authority rejection, one concurrent owner/workspace, failure-injected transaction rollback, expiry recheck after hashing |
| Password/login | Native Argon2id, independent salt, Unicode/byte limits, bounded native concurrency/cost, same unknown/wrong/disabled failure, changed-hash recheck, fixation defense |
| Session | Hash-only opaque credential, database idle/absolute expiry, direct/user revocation, strict cookie-only acceptance and workspace/family constraints |
| Rotation/logout | New credential/CSRF with unchanged absolute expiry, exactly one concurrent successor, old credential limited to matching-CSRF family logout, logout/rotation race |
| Web boundary | Actual HTTPS with explicitly trusted temporary test CA, exact Host/Origin, required custom header, CSRF/session binding, duplicate cookies/CSRF, HTTP plus forged Forwarded, query credentials |
| Abuse/evidence | Shared PostgreSQL throttling across runtime instances, window expiry, bounded rejected-input state, audit/verifier redaction, cookie flags on IP and custom hosts |
| Existing product | Default-disabled API, strict contracts/build gates, unchanged desktop/mobile prototype comparisons |

The PostgreSQL runner refuses missing opt-in, remote hosts and any database name except disposable `cloudlane_ci`. It generates a fresh temporary key/certificate under ignored `test-results/auth-fixture/`; clients retain TLS verification and trust only that fixture for their requests. Private key/certificate bytes are neither committed nor uploaded. Existing pinned PostgreSQL CI service runs both migration and owner-auth files serially. No SQL emulator, mocked race or disabled TLS verification is accepted as database/transport evidence.

## Reproduce and source scope

```sh
npm ci
npm run check
npm test
npm run build
npm run build:preview
python3 scripts/validate_progress.py
```

With the documented explicit disposable-database environment, run `npm run test:postgres`. The normal CI job provisions the real PostgreSQL service and retains JUnit, actual server version and source/lockfile manifests. The initial local full pass and native-crypto tests passed; final exact commands/counts/source/run links are recorded in PR #5 and canonical task checkpoints as the candidate is verified. A prior source's successful run is never relabelled as a newer head.

## Outstanding acceptance

Independent security decisions, MFA/step-up/recovery, production password/blocklist/cost policy, trusted Caddy boundary, installer identity/printing/repair, public CA issuance/renewal, backup rollback detection/restore, real-client end-to-end auth UI and target VPS/resource/DoS evidence remain open. This evidence is for an isolated review implementation and cannot authorize production activation.

## Local implementation checkpoint

PASS current local `npm run check`, `npm test` (62 Node + 10 Python, zero failures/skips), and `npm run lint`. Both production/demo builds passed the preceding local checkpoint; hosted/package builds use final source. Native Argon2 tests include independent salt, cost ceilings, Unicode/byte bounds and two-operation admission. Prepared 21 auth PostgreSQL/HTTPS cases and 13 migration cases; their actual execution is pending at this checkpoint. Final current-source required-run evidence is recorded in PR #5 rather than inferred from preparation.
