# 14 — Tool-neutral, task-scoped progress and seamless handoff protocol

**Goal:** a different contributor, using any development environment, can resume exactly where work stopped using Git and repository files alone. Continuity is attached to **task IDs**, not to models, services, worker slots or chat sessions.

## Durable state and precedence

| File | Purpose | Update rule |
| --- | --- | --- |
| `AGENTS.md` | Universal contributor safety/working rules | Reviewed architectural change only |
| `docs/00-SOURCE_OF_TRUTH.md` | Locked product decisions and precedence | Reviewed decision changes |
| `tasks/BACKLOG.md` | Stable task IDs, dependencies, acceptance criteria | Reviewed planning change |
| `tasks/progress/CL-###.md` | **Canonical per-task progress and handoff**, regardless of who works on it | Every claim, checkpoint, interruption, review, takeover |
| `tasks/HANDOFF_TEMPLATE.md` | Format for reproducible checkpoint notes | Shared reference |
| `PROJECT_PROGRESS.md` | Verified integrated milestones only | Integration/release maintainer after merge and evidence review |
| `docs/13-ADR_AND_OPEN_DECISIONS.md` | Technical decisions requiring approval | Reviewed decision update |

**Never infer status from conversational context.** A summary is stale until supported by a merged commit, a test report, or other recorded evidence. The task record is the working truth for unmerged work; the project summary is the release/integration truth.

## Task lifecycle

1. **Inspect:** read AGENTS, project snapshot, backlog, task record, dependencies, current remote branches/PRs and recent commits.
2. **Claim:** record a task-specific branch (`task/CL-XXX-short-label`) and an accepted remote claim/PR or coordinator acknowledgement. **A local record cannot prevent a second contributor from claiming the same task.** If no shared coordination mechanism is available, mark the claim as *provisional* and do not start conflicting work.
3. **Prepare:** identify exact files, contracts and tests. Check latest integration branch before writing code.
4. **Implement:** work in limited, reviewable commits. Never erase prior checkpoint history. Do not rewrite someone else's concurrent changes.
5. **Verify:** record each exact command, environment, PASS/FAIL/NOT RUN, and evidence path/CI reference. Include negative/security tests when applicable.
6. **Checkpoint:** update `tasks/progress/CL-XXX.md` at meaningful steps, when interrupted/blocked, and before handing off. Include branch, commit or `not-committed`, changed files and next command.
7. **Handoff:** append a dated `## History` entry and complete `## Handoff` in the same task file. Commit and push if permitted. Keep an explicit uncommitted-files list if the work was interrupted before a commit.
8. **Takeover:** replacement contributor reads *the same task record*, fetches the recorded branch/commit, runs its last verification command, confirms differences, then appends a new checkpoint. No fixed worker identity is required.
9. **Review/merge:** reviewer checks implementation, threat boundaries and evidence. Only **after merge** should the integrator update `PROJECT_PROGRESS.md` with linked commit/test facts. `merged` and `verified` are separate statuses.

## Canonical metadata

Each `tasks/progress/CL-XXX.md` starts with:

```yaml
---
task_id: CL-040
status: not-started
updated_utc: 2026-11-18T00:00:00Z
branch: unassigned
last_commit: none
claim_ref: none
---
```

Valid statuses: `not-started`, `in-progress`, `blocked`, `review`, `merged`, `verified`. All fields are required; the record contains `## Summary`, `## Files changed`, `## Verification`, `## Blockers`, `## Next action`, `## Handoff`, `## History`. Include an actual UTC timestamp and a true Git commit SHA or `not-committed`. **Never invent commit hashes, test results or external PR links.** `claim_ref` may be `none` before claim; use a real URL/issue/PR/ticket reference after claim.

## Example of a useful checkpoint

```markdown
## Handoff
- Status: in-progress
- Working branch: task/CL-040-domain-ui
- Latest real commit: abcdef123... (use actual SHA; this string is illustrative)
- Review or claim reference: <actual PR or issue URL>
- What works: domain list and one-field form render from the typed demo adapter
- What remains: Settings tab DNS mode staging, validation and mobile snapshots
- Changed files: apps/dashboard/src/routes/domains/+page.svelte, ...
- Verification: `pnpm check` -> PASS on branch/commit; `pnpm test:e2e` -> NOT RUN (test fixture pending)
- Known failure: reproduce by following exact steps and record expected vs observed
- Exact next action: open +page.svelte, implement staged Manual/Managed state; run `pnpm check`
```

This is a *format example*, not a claim that the example implementation exists.

## Parallel work and conflicts

- One active branch/accepted claim per task. Different tasks may proceed in parallel only when dependencies and shared-file boundaries permit it.
- Share typed contracts by review; avoid two contributors independently changing auth schemas, global tokens or Caddy configuration.
- A stale claim should be **reconciled** via repository PR/issue history and an explicit takeover checkpoint. Do not silently set it to unassigned based on elapsed time.
- If the branch cannot be fetched, record the last confirmed commit, what artifacts remain, and which checks must be rerun. Start a new branch only after coordinating the replacement claim.
- Preserve task history through replacements. Do not create a duplicate task file for each contributor.

## Standard commands

```bash
python3 scripts/validate_progress.py
python3 scripts/taskboard.py list
python3 scripts/taskboard.py resume CL-040
python3 scripts/validate_progress.py --base origin/main
```

The last command checks the committed comparison between base and HEAD. Any implementation change must include a changed `tasks/progress/CL-XXX.md`; if one PR works on several task IDs, update **each affected task**. This is a structural gate, not proof that reported progress is true. Use it with any Git-capable CI platform or locally; the included CI example is optional.

## Emergency resumption checklist

1. `git status --short`; `git branch --show-current`; `git log -1 --oneline`; `git fetch --all` (when available).
2. Read `PROJECT_PROGRESS.md`, target `tasks/progress/CL-XXX.md`, and the linked PR/issue.
3. Determine whether the task is unclaimed, active, blocked, merged or verified; compare remote and local state.
4. Run the last reproducible check. Record any environment gaps instead of claiming failure is fixed.
5. Check out the recorded branch or coordinate a replacement; append a truthful takeover checkpoint.
6. Continue the file/function/command in `## Next action`; update handoff before stopping.
