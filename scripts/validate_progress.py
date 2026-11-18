#!/usr/bin/env python3
"""Validate canonical task records and require a record change with code changes."""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import re
import subprocess
import sys

STATUSES = {'not-started', 'in-progress', 'blocked', 'review', 'merged', 'verified'}
FIELDS = {'task_id', 'status', 'updated_utc', 'branch', 'last_commit', 'claim_ref'}
SECTIONS = {'Summary', 'Files changed', 'Verification', 'Blockers', 'Next action', 'Handoff', 'History'}


def read_record(path: Path) -> tuple[dict[str, str], list[str]]:
    if path.is_symlink():
        return {}, [f'{path.name}: task records cannot be symlinks']
    content = path.read_text()
    errors: list[str] = []
    metadata: dict[str, str] = {}
    match = re.match(r'^---\n(.*?)\n---\n', content, re.S)
    if not match:
        return {}, [f'{path.name}: missing YAML frontmatter']
    for line in match.group(1).splitlines():
        if ':' in line:
            key, value = line.split(':', 1)
            metadata[key.strip()] = value.strip()
    for key in FIELDS:
        if not metadata.get(key):
            errors.append(f'{path.name}: missing {key}')
    if metadata.get('task_id') != path.stem:
        errors.append(f'{path.name}: task ID does not match filename')
    if metadata.get('status') not in STATUSES:
        errors.append(f'{path.name}: invalid status')
    try:
        timestamp = metadata['updated_utc']
        if not timestamp.endswith('Z'):
            raise ValueError('UTC timestamp required')
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except (KeyError, ValueError):
        errors.append(f'{path.name}: invalid updated_utc')
    if not re.fullmatch(r'(none|not-committed|[0-9a-f]{40})', metadata.get('last_commit', '')):
        errors.append(f'{path.name}: invalid last_commit')
    if metadata.get('status') != 'not-started':
        for field, absent in [('branch', 'unassigned'), ('last_commit', 'none'), ('claim_ref', 'none')]:
            if metadata.get(field) == absent:
                errors.append(f'{path.name}: active checkpoint requires {field}')
    headings = set(re.findall(r'^## (.+)$', content, re.M))
    for heading in SECTIONS - headings:
        errors.append(f'{path.name}: missing section {heading}')
    return metadata, errors


IMPLEMENTATION_ROOTS = ('apps/', 'packages/', 'agent/', 'installer/', 'deploy/', 'scripts/', 'tests/', 'tools/', '.github/')
ROOT_IMPLEMENTATION = {'package.json', 'package-lock.json', '.node-version', '.npmrc', '.gitignore', 'tsconfig.base.json', 'prettier.config.js', 'playwright.config.ts'}


def committed_changes(root: Path, base: str) -> tuple[list[tuple[str, str]], str | None]:
    resolved = subprocess.run(['git', 'rev-parse', '--verify', '--end-of-options', f'{base}^{{commit}}'], cwd=root, capture_output=True, text=True)
    if resolved.returncode:
        return [], 'Could not resolve the comparison base to a commit.'
    comparison = subprocess.run(['git', 'diff', '--name-status', '--no-renames', '-z', f'{resolved.stdout.strip()}...HEAD', '--'], cwd=root, capture_output=True, text=True)
    if comparison.returncode:
        return [], 'Could not compare base with HEAD.'
    entries = comparison.stdout.rstrip('\0').split('\0') if comparison.stdout else []
    if len(entries) % 2:
        return [], 'Invalid Git name-status output.'
    return list(zip(entries[0::2], entries[1::2])), None


def validate(root: Path, base: str | None = None, required_tasks: tuple[str, ...] = ()) -> list[str]:
    records = sorted((root / 'tasks/progress').glob('CL-*.md'))
    errors = []
    metadata_by_task = {}
    if not records:
        errors.append('No canonical task records found')
    for path in records:
        metadata, record_errors = read_record(path)
        metadata_by_task[path.stem] = metadata
        errors.extend(record_errors)
    backlog = root / 'tasks/BACKLOG.md'
    if backlog.exists():
        task_ids = set(re.findall(r'\[`(CL-\d+)`\]', backlog.read_text()))
        for task_id in task_ids - {path.stem for path in records}:
            errors.append(f'{task_id}: backlog task has no progress record')
    if required_tasks and not base:
        errors.append('--task requires --base for a committed change comparison')
    if base:
        changed, error = committed_changes(root, base)
        if error:
            errors.append(error)
        else:
            implementation = any(path.startswith(IMPLEMENTATION_ROOTS) or path in ROOT_IMPLEMENTATION for _, path in changed)
            updated = {
                Path(path).stem for status, path in changed
                if status in {'A', 'M'} and re.fullmatch(r'tasks/progress/CL-\d{3}\.md', path)
                and metadata_by_task.get(Path(path).stem, {}).get('status') not in {None, 'not-started'}
            }
            if implementation and not updated:
                errors.append('Implementation changes require a changed, active tasks/progress/CL-###.md; deletion, rename or an untouched not-started record does not satisfy the gate')
            for task_id in required_tasks:
                if not re.fullmatch(r'CL-\d{3}', task_id) or task_id not in updated:
                    errors.append(f'{task_id}: declared task requires its own changed checkpoint')
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', help='Compare committed changes against this Git ref')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--task', action='append', default=[], help='Require a checkpoint update for this declared task; repeat for multiple tasks')
    args = parser.parse_args()
    errors = validate(args.root, args.base, tuple(args.task))
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'PASS: task records valid{", progress change gate passed" if args.base else ""}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
