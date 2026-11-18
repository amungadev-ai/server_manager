#!/usr/bin/env python3
"""Print task status or the canonical handoff for a specific task."""
import argparse
from pathlib import Path
import sys
from validate_progress import read_record

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('command', choices=['list', 'resume'])
parser.add_argument('task_id', nargs='?')
args = parser.parse_args()
if args.command == 'list':
    for path in sorted((root / 'tasks/progress').glob('CL-*.md')):
        metadata, errors = read_record(path)
        print(f'{path.stem}  {metadata.get("status", "invalid"):12}  {metadata.get("branch", "unassigned")}')
elif not args.task_id or not __import__('re').fullmatch(r'CL-\d{3}', args.task_id):
    parser.error('resume requires a task ID such as CL-001')
else:
    path = root / 'tasks/progress' / f'{args.task_id}.md'
    if not path.is_file():
        print('Task record not found', file=sys.stderr)
        sys.exit(1)
    print(path.read_text())
