# ADR-017 — Security boundaries and proposed agent verifier profile

Status: proposed; no operational approval
Date: 2026-11-19 (Africa/Nairobi)
Task: CL-005; implementing tasks CL-032/033/034/050/052/080 and their release gates
Decision owner: user-authorized CL-005 claimant; see canonical task record
Review: separate security/cryptographic review pending; no reviewer assigned

## Context

The source has strict draft HTTP/agent schemas and unavailable mutation endpoints. It has no authentication, installer, cryptographic verifier, privileged agent or isolated runtime. ADR-015 intentionally leaves the authorization scheme opaque. A concrete proposal and adversarial acceptance cases are needed before a schema-valid command can become executable. The [threat model](../security/THREAT_MODEL.md) identifies a compromised API and malicious workload as separate adversaries.

## Decision proposal

Retain the single-owner dedicated-VPS scope. Keep browser authorization in the unprivileged API, host capabilities in a restricted agent, and app/build code outside the control plane. Apply the model's proposed bootstrap/session/isolation policies only after separate review and implementing-task tests. No public multi-tenant arbitrary build execution is authorized by this ADR.

For the initial agent, evaluate this specific profile during CL-052:

| Concern | Proposed profile |
| --- | --- |
| Transport | Linux Unix-domain stream socket in a root-owned runtime directory; dedicated service identities, explicit owner/group/mode and peer-credential allowlist. No public TCP listener or customer socket mount. Length-prefixed, bounded frames and per-connection timeouts; proposed maximum command body 64 KiB. Peer identity supplements signatures and resource policy. |
| Signing | `authorization.scheme = ed25519-jcs-v1`; Ed25519 from a maintained platform/library implementation. `keyId` resolves to a locally approved installation key; commands cannot introduce keys or algorithms. Decode `proof` as canonical unpadded base64url for exactly one 64-byte signature. No fallback to another scheme. |
| Signed bytes | ASCII prefix `cloudlane-agent-command-v1`, one LF byte (`0x0A`), then UTF-8 RFC 8785 canonical JSON of the entire validated command with only `authorization.proof` removed. Include scheme, keyId, operation, every scope/ID, generation, timestamps and complete payload. Reject duplicate JSON keys, unknown fields, invalid UTF-8, non-finite/unsafe numbers and over-limit frames before dispatch; use interoperable parsers/canonicalizers rather than handwritten crypto. |
| Time | Proposed maximum `expiresAt-issuedAt` 60 seconds; `expiresAt > now`, `issuedAt <= now+5 seconds`, and positive lifetime. No expiry grace. Use strict UTC timestamp parsing and an explicit supported timestamp profile. Detect unhealthy/backwards clock state; privileged mutations stop until a separately authorized repair restores trusted time. |
| Scope | Key/policy pins installation server ID, workspace/resource capability and allowed operation/profile. Resolve volume/network/image/route IDs through the agent's trusted registry. API JSON cannot create a broader capability, arbitrary mount or proxy target. Bind expected generation and candidate ownership before effects. |
| Replay and retries | Durably reserve command ID and `(installation, workspace, resource, idempotency key)` with a digest of signed bytes before effects. Keep that namespace stable across key rotation. Identical retries return the recorded status/result or reconcile an interrupted effect; different bytes with the same command/idempotency identity reject. Serialize conflicting resource generations. Never repeat an effect merely because acknowledgment was lost. |
| Journal lifecycle | Retain deduplication records for at least the reviewed job retry/reconciliation horizon and latest resource generation; exact horizon depends on CL-051 retry policy. Do not prune until the relevant expiry and recovery constraints are satisfied. Agent state must persist across restarts. A lost/corrupt/restored journal disables mutation until local recovery reconciles installation identity, jobs and revocations. |
| Key custody/rotation | Signing private material is readable only by the authorized API/worker identity, outside browser/app volumes and DB dumps. Agent trust roots/policy are root-protected and cannot be enrolled through the same ordinary command channel. Proposed routine rotation uses explicitly enrolled next key with a bounded overlap; emergency revocation has no overlap. Local audited administrator recovery is required if trust is lost. |
| Results | Bind observations/results to command/resource/generation over the authenticated local channel; distinguish accepted, completed, failed and observed state. Treat results as untrusted if identity/channel verification fails. A future remote channel or detached result-signature design requires a separate reviewed profile. |

The profile does **not** make an API holding a signing key trustworthy. Such an API may request any operation delegated to that identity. Agent-owned policy ceilings reduce host exposure; owner-resource integrity may still be lost. A separately trusted authorization service or stronger isolation would be needed to change that trust assumption. A colocated root compromise defeats both parties.

## Alternatives

- Unix permissions alone are simpler but do not bind command contents to issuer/key/version or supply durable replay policy. Keep peer checks and add the proposed command verifier.
- A shared MAC key is simpler operationally but gives every verifier key holder command-minting ability. The asymmetric proposal separates signing custody from agent verification; compromise of the signer remains a risk.
- Remote mTLS introduces certificate enrollment and network exposure that the initial same-host deployment does not need. Revisit when multi-host management is in scope.
- Dedicated build/runtime machines or stronger sandboxing offer a different isolation boundary and cost. Evaluate them before public hostile-code hosting; a hardened shared Docker host cannot supply that approval by itself.

## Security and resources

Apply signature, scope, time, quota, replay and generation checks before any privileged effect, and persist denied/allowed audit metadata without proofs or secrets. A filesystem socket does not prevent same-host SSRF into other management listeners: protect Docker and Caddy administration separately. Rate-limit verification, cap in-flight frames/jobs and preserve control-plane disk reserves for the journal/DB. Quota values, retry horizon, secret encryption/key recovery and isolation exceptions require measured policies; broad contract field bounds are not capacity promises.

## Compatibility

This proposes a specific scheme inside ADR-015's existing draft envelope; it adds no runtime implementation and changes no generated v1 schemas. Old arbitrary scheme/proof examples remain shape tests and must never be accepted by a verifier. Before operational v1 approval, CL-052 must pin encoding/timestamp/error behavior, compatible Node/Go libraries and shared positive/negative vectors. Any incompatible deployed protocol change requires a versioned migration with trust/key/journal compatibility and rollback rules. No automatic downgrade or unsigned legacy execution is allowed.

## Acceptance evidence

Review [N08/N09/N11/N16/N17](../security/SECURITY_ACCEPTANCE.md), the baseline source and existing schema-negative tests. Required future evidence includes interoperable signing vectors; mutation of every signed field; wrong/unknown/revoked key and unsupported scheme; duplicate/ambiguous JSON; current-time boundaries; concurrent replay/crash/restart; stale generation and cross-scope resources; journal corruption/restore; socket peer/access denial; signer-compromise containment and quota exhaustion. All operational verifier/IPC cases are currently **NOT IMPLEMENTED / NOT RUN**. Existing schema tests establish structure only. See `tasks/progress/CL-005.md` for the actual verification record.
