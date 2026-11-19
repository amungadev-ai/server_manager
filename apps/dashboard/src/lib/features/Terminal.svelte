<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Service } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { copyText, notify } from '#lib/stores/ui.svelte.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import { serviceDetail } from '#lib/presentation.ts';
  let { service }: { service: Service } = $props();
  let role = $state('developer'),
    active = $state(false),
    expires = $state(0),
    command = $state('');
  let entries = $state<{ kind: string; text: string }[]>([]);
  let timer: ReturnType<typeof setTimeout>;
  const commands = [
    'help',
    'pwd',
    'ls',
    'ls -la',
    'whoami',
    'node --version',
    'npm --version',
    'ps',
    'date',
    'cat package.json',
    'git status',
    'env',
    'clear',
    'exit',
  ];
  const eligible = $derived(
    serviceDetail(service)?.role !== 'static' &&
      !/^(HTML|Static|Vite static|Static HTML)$/i.test(service.framework),
  );
  function end(note = 'Terminal session ended.') {
    clearTimeout(timer);
    active = false;
    notify(note);
  }
  function start() {
    if (!eligible || role === 'viewer' || infrastructure.mode !== 'demo')
      return notify('Terminal access denied. No shell was opened.', true);
    active = true;
    expires = Date.now() + 300000;
    entries = [
      {
        kind: 'system',
        text: 'Demo session started. Type help for the read-only command list. No real command execution.',
      },
    ];
    timer = setTimeout(
      () => end('Session expired. Reopen to continue.'),
      300000,
    );
  }
  function run(event: SubmitEvent) {
    event.preventDefault();
    if (!active || role === 'viewer' || Date.now() >= expires)
      return end('Session expired or permission denied.');
    const value = command.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!value) return;
    command = '';
    if (value === 'clear') {
      entries = [];
      return;
    }
    if (value === 'exit') {
      end();
      return;
    }
    entries.push({ kind: 'command', text: `app $ ${value}` });
    const outputs: Record<string, string> = {
      help: `Simulated read-only commands: ${commands.join(', ')}`,
      pwd: '/app',
      ls: 'dist  node_modules  package.json  public',
      'ls -la': 'dist  node_modules  package.json  public',
      whoami: 'app (unprivileged container identity)',
      'node --version': 'v22.x (illustrative)',
      'npm --version': '10.x (illustrative)',
      ps: 'PID  COMMAND\n  1  node dist/main.js',
      date: new Date().toUTCString() + ' (browser clock)',
      'git status':
        'Deployment artifact is immutable; not a writable Git checkout.',
      'cat package.json':
        JSON.stringify(
          {
            name: service.name,
            private: true,
            scripts: { start: 'node dist/main.js' },
          },
          null,
          2,
        ) + '\n[synthetic example]',
      env: 'Secrets protected. Environment variables are never printed by this demo.',
    };
    entries.push({
      kind: Object.hasOwn(outputs, value) ? 'output' : 'error',
      text:
        outputs[value] ??
        'Command not permitted. Only listed read-only demo commands are supported.',
    });
  }
  onDestroy(() => clearTimeout(timer));
</script>

<div class="term-banner" style="margin-bottom:17px">
  <Icon name="shield" size={19} />
  <div>
    <strong>Application container only · demonstration</strong>
    <div style="margin-top:3px">
      No VPS host shell, SSH, Docker daemon, system directories, or real command
      execution. This preview accepts only a small set of fake read-only
      commands; production sessions will require container isolation and audited
      role permissions.
    </div>
  </div>
</div>
<div class="term-two">
  <div class="card">
    <div class="row space" style="gap:12px;flex-wrap:wrap">
      <div>
        <h3 class="section-title">Application Terminal</h3>
        <p class="muted xs">{service.name} · production · isolated app user</p>
      </div>
      <Badge
        label={active ? 'Demo session active' : 'Not connected'}
        tone={active ? 'success' : 'warning'}
      />
    </div>
    <div class="divider"></div>
    <div class="row space" style="flex-wrap:wrap;gap:12px;margin-bottom:15px">
      <label class="form-label">
        Preview role<select
          class="term-select"
          aria-label="Select demo terminal permission role"
          bind:value={role}
          onchange={() => {
            if (role === 'viewer') end('Viewer has no terminal access.');
          }}
        >
          <option value="viewer">Viewer · no terminal access</option><option
            value="developer"
          >
            Developer · permitted
          </option><option value="admin">Administrator · permitted</option>
        </select>
      </label>
      <div class="col" style="align-items:flex-start">
        <span class="muted xs">Session limits</span><span class="strong small">
          5 minutes · application-scoped
        </span>{#if active}<span class="muted xs">
            Expires at {new Date(expires).toLocaleTimeString()}
          </span>{/if}
      </div>
    </div>
    {#if !eligible}<div class="notice">
        This static-site service has no interactive application process in the
        demo. Review its deployment artifacts and logs instead.
      </div>{:else if role === 'viewer'}<div class="notice">
        <Icon name="lock" size={16} /> Terminal access denied for Viewer. Logs and
        application metrics remain available.
      </div>{:else if !active}<div class="term-console">
        <div class="term-toolbar">
          <span class="mono small">app@{service.name}:~$</span><Badge
            label="Waiting for approval"
            tone="warning"
          />
        </div>
        <div class="term-screen">
          <span class="system">
            Terminal is disabled by default. Start a short-lived, container-only
            demo session to inspect supported commands. No actual shell will be
            opened.
          </span>
        </div>
      </div>
      <div class="term-actions">
        <button class="btn btn-primary" onclick={start}>
          <Icon name="terminal" size={15} /> Start demo session
        </button>
      </div>
      <p class="hint">
        By starting, you acknowledge that a real terminal can access files and
        secrets allowed by the container identity. Production access needs an
        explicit permission grant.
      </p>{:else}<div class="term-console">
        <div class="term-toolbar">
          <span class="row">
            <span class="dot"></span><span class="mono small">
              app@{service.name}:/app
            </span>
          </span><span class="muted xs">
            Expires {new Date(expires).toLocaleTimeString()}
          </span>
        </div>
        <div class="term-screen" role="log" aria-live="polite">
          {#each entries as entry}<div class={entry.kind}>
              {entry.text}
            </div>{/each}
        </div>
        <form class="term-command" onsubmit={run}>
          <label for="terminalCommand">app $</label><input
            id="terminalCommand"
            bind:value={command}
            maxlength="160"
            autocomplete="off"
            spellcheck="false"
            placeholder="Type help or pwd"
            aria-label="Demo shell command"
          /><button class="btn btn-primary btn-small" type="submit">
            Run demo
          </button>
        </form>
      </div>
      <div class="term-actions">
        <button class="btn btn-small" onclick={() => end()}>
          End session
        </button><button
          class="btn btn-small"
          onclick={() => end('Session expired. Reopen to continue.')}
        >
          Simulate expiry
        </button><button
          class="btn btn-small"
          onclick={() => copyText(entries.map((e) => e.text).join('\n'))}
        >
          Copy transcript
        </button><button class="btn btn-small" onclick={() => (entries = [])}>
          Clear output
        </button>
      </div>{/if}
  </div>
  <div class="col" style="gap:17px">
    <div class="card">
      <h3 class="section-title">Safe preview commands</h3>
      <p class="muted xs" style="margin:8px 0 15px">
        Only these examples return simulated results.
      </p>
      <div class="row" style="flex-wrap:wrap;gap:7px">
        {#each commands.filter((c) => !['env', 'clear', 'exit'].includes(c)) as item}<button
            class="term-command-chip"
            onclick={() => (command = item)}
          >
            {item}
          </button>{/each}
      </div>
      <p class="hint">
        env outputs no secrets. Unknown and destructive commands are rejected.
      </p>
    </div>
    <div class="card">
      <h3 class="section-title">Access boundaries</h3>
      <div class="access-list">
        {#each ['Non-root user inside one container', 'Short-lived, scoped sessions', 'Audit start, expiry and blocked attempts', 'No VPS filesystem explorer', 'No SSH, sudo or Docker socket'] as item, index}<div>
            <Icon name={index < 3 ? 'check' : 'shield'} size={15} />
            {item}
          </div>{/each}
      </div>
      <div class="divider"></div>
      <a class="btn" href="/activity">Review activity logs</a>
    </div>
  </div>
</div>
