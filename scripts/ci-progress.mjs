import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export function comparisonBase(eventName, event = {}) {
  if (eventName === 'pull_request') return event.pull_request?.base?.sha;
  if (eventName === 'merge_group') return event.merge_group?.base_sha;
  if (eventName === 'push') return event.before;
  return undefined;
}
export function progressCommand(eventName, event = {}) {
  const base = comparisonBase(eventName, event);
  if (
    ['pull_request', 'merge_group'].includes(eventName) &&
    !/^[a-f0-9]{40}$/.test(base ?? '')
  )
    throw new Error('The event is missing a valid comparison base SHA.');
  if (base && !/^[a-f0-9]{40}$/.test(base))
    throw new Error('Invalid comparison base SHA.');
  // The initial push has an all-zero before SHA; validate every task record then.
  return [
    'scripts/validate_progress.py',
    ...(base && !/^0{40}$/.test(base) ? ['--base', base] : []),
  ];
}
if (process.argv[1]?.endsWith('ci-progress.mjs')) {
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    : {};
  const args = progressCommand(process.env.GITHUB_EVENT_NAME ?? 'local', event);
  const result = spawnSync('python3', args, { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
