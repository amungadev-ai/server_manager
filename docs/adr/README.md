# Architecture decisions

Locked product decisions remain in `docs/13-ADR_AND_OPEN_DECISIONS.md`. This directory records scoped implementation decisions and their evidence. It does not supersede locked UX or close security review gates.

| Decision | Status | Task |
| --- | --- | --- |
| [ADR-013: Package boundaries and reviews](013-package-boundaries.md) | Accepted for development | CL-002 |
| [ADR-014: HTTP contracts and generation](014-contracts-and-generation.md) | Accepted for development; v1 contract is draft | CL-003 |
| [ADR-016: CI and test evidence](016-ci-and-test-evidence.md) | Accepted for development; hosted execution pending | CL-004, CL-006 |
| [ADR-015: Agent envelope](015-agent-envelope.md) | Proposed; no execution or cryptographic implementation | CL-003, later CL-005/052 |
| [ADR-018: API access policy and PostgreSQL migrations](018-api-persistence-foundations.md) | Implemented for development review; operational auth/security gates pending | CL-030, CL-031 |

| [ADR-019: Isolated owner authentication](019-owner-auth-review-profile.md) | Proposed development candidate; production activation disabled | CL-032, CL-033 |

New decisions use `TEMPLATE.md`. Record context, scope, alternatives, compatibility, security/resource effects and reproducible acceptance evidence. Changes to a locked product decision need an explicit product-owner decision. Security-sensitive protocols need the designated security review and negative-path tests before becoming operational.

The task claimant records the implementation. A maintainer checks integration evidence. A separate reviewer is required before declaring security-sensitive work production-ready. No individual reviewer or GitHub approval is invented when one has not been configured.
