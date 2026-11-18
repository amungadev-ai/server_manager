# ADR-016 — CI gates and test evidence

Status: accepted for development
Date: 2026-11-18
Tasks: CL-004, CL-006
Review: maintainer implementation review; hosted execution and independent review pending

## Decision

Use a read-only GitHub Actions workflow for push, pull request, merge queue and manual runs. Separate progress checks, build/unit/contract verification and desktop/mobile browser jobs. One stable required gate must fail if any prerequisite fails, is cancelled or is skipped. Keep forked PR code away from credentials and privileged triggers.

Build HTTP and explicit demo dashboard outputs once for browser fixtures. The harness serves immutable copies on loopback: demo UI, HTTP UI with a typed test-only API fixture, and HTTP UI connected to the actual unconfigured NestJS API. No fixture signs in to a real Cloudlane instance or claims PostgreSQL/deployment behavior. Mutations stay unavailable. Browser tests cover rendered navigation/search/dialog contracts, mobile overflow, appearance persistence, response failures and initial accessibility checks.

Store machine-readable unit reports, browser HTML/JSON/JUnit reports, screenshots, failure traces and a source/toolchain manifest as short-lived artifacts. Evidence must say whether a browser actually ran. Test discovery or HTTP fixture tests are not browser success. No baselines are auto-approved as visual parity.

The managed workspace's preview relay is unavailable. Do not install a browser or run an alternative local browser-control path here. Validate test discovery, workflow logic and loopback HTTP/unit behavior; execute browser tests on the configured CI runner or a supported local development environment.

## GitHub activation

The current source repository is the private Site source, not a configured GitHub Actions repository. The connected GitHub search returned no accessible Cloudlane repository. The workflow and branch-protection checklist can be prepared and validated here; hosted runs, actual artifact uploads and enforced rules remain unverified until a real repository is selected. No repository, PR, workflow run or reviewer identity is invented.

## Compatibility and evidence

Keep the existing static SvelteKit / NestJS boundary and read-only preview behavior. The progress gate handles additions, modifications, deletions, renames, tools and root configuration changes. Missing/deleted checkpoints cannot satisfy it. CI evidence is linked from the canonical CL-004/006 records.

Primary implementation references:

- https://playwright.dev/docs/ci
- https://playwright.dev/docs/test-reporters
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://docs.github.com/en/pull-requests/reference/status-checks
