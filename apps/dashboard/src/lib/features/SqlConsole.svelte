<script lang="ts">
  import { untrack } from 'svelte';
  import type { Service } from '@cloudlane/contracts/preview';
  import { serviceDetail } from '#lib/presentation.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  let { service }: { service: Service } = $props();
  const detail = $derived(serviceDetail(service));
  const postgres = $derived(detail?.engine === 'PostgreSQL');
  const samples = $derived(
    postgres
      ? [
          'SELECT current_database()',
          'SELECT table_name FROM information_schema.tables LIMIT 5',
          'SELECT * FROM users LIMIT 5',
        ]
      : ['SELECT DATABASE()', 'SHOW TABLES', 'SELECT * FROM users LIMIT 5'],
  );
  let query = $state(untrack(() => samples[0] ?? '')),
    result = $state<{
      blocked: boolean;
      message: string;
      columns: string[];
      rows: string[][];
    } | null>(null);
  function run(event: SubmitEvent) {
    event.preventDefault();
    const text = (query || samples[0])
      .trim()
      .replace(/;$/, '')
      .replace(/\s+/g, ' ');
    const index = samples.findIndex(
      (s) => s.toLowerCase() === text.toLowerCase(),
    );
    if (index < 0) {
      result = {
        blocked: true,
        message:
          'Only the listed read-only sample queries are permitted. No query was executed.',
        columns: [],
        rows: [],
      };
      return;
    }
    result = {
      blocked: false,
      message: 'Synthetic preview rows; no SQL was executed.',
      columns:
        index === 0
          ? [postgres ? 'current_database' : 'DATABASE()']
          : index === 1
            ? [postgres ? 'table_name' : `Tables_in_${detail?.database}`]
            : ['id', 'email', 'status'],
      rows:
        index === 0
          ? [[detail?.database ?? 'demo']]
          : index === 1
            ? [['users'], ['bookings'], ['profiles']]
            : [
                ['1', 'alex@example.test', 'active'],
                ['2', 'taylor@example.test', 'active'],
                ['3', 'sam@example.test', 'pending'],
              ],
    };
  }
</script>

<div class="term-banner" style="margin-bottom:17px">
  <Icon name="shield" size={18} />
  <div>
    <strong>Read-only database console · simulation</strong>
    <div style="margin-top:3px">
      This is a canned SQL preview, not a database connection. In production the
      SQL console needs separate database credentials, scoped permissions,
      session expiry, query limits and auditing.
    </div>
  </div>
</div>
<div class="sql-cards">
  <div class="card">
    <div class="row space">
      <div>
        <h3 class="section-title">{detail?.engine} console</h3>
        <p class="muted xs">{detail?.database} · production</p>
      </div>
      <Badge label="Read-only demo" tone="info" />
    </div>
    <div class="divider"></div>
    <form onsubmit={run}>
      <label class="form-label" for="sqlQuery">Query editor</label><textarea
        id="sqlQuery"
        class="sql-editor"
        maxlength="300"
        bind:value={query}
        spellcheck="false"
        placeholder={samples[0]}></textarea>
      <div class="row space" style="flex-wrap:wrap;margin-top:11px">
        <button class="btn btn-primary" type="submit">
          <Icon name="play" size={14} /> Run preview
        </button><span class="muted xs">
          SELECT-only samples · no actual queries
        </span>
      </div>
    </form>
    {#if result}<div class="divider"></div>
      <div class="row space">
        <h3 class="section-title">Result</h3>
        <Badge
          label={result.blocked
            ? 'Not permitted'
            : `${result.rows.length} rows`}
          tone={result.blocked ? 'warning' : 'success'}
        />
      </div>
      <p class="muted xs" style="margin:10px 0">{result.message}</p>
      {#if !result.blocked}<div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                {#each result.columns as column}<th>{column}</th>{/each}
              </tr>
            </thead><tbody>
              {#each result.rows as row}<tr>
                  {#each row as value}<td class="mono">{value}</td>{/each}
                </tr>{/each}
            </tbody>
          </table>
        </div>{/if}{/if}
  </div>
  <div class="col" style="gap:17px">
    <div class="card">
      <h3 class="section-title">Example queries</h3>
      <div class="col" style="margin-top:14px;align-items:flex-start">
        {#each samples as sample}<button
            class="term-command-chip"
            onclick={() => (query = sample)}
          >
            {sample}
          </button>{/each}
      </div>
    </div>
    <div class="card">
      <h3 class="section-title">Database administration</h3>
      <p class="muted small">
        For full database administration, use the engine-specific administration
        tool with separate authentication and database privileges.
      </p>
      <div style="margin-top:14px">
        <button
          class="btn"
          onclick={() => openDialog('dbAdmin', { service: service.id })}
        >
          <Icon name="external" size={15} /> Open {postgres
            ? 'pgAdmin'
            : 'phpMyAdmin'} preview
        </button>
      </div>
      <p class="hint">No SQL is executed by this dashboard.</p>
    </div>
  </div>
</div>
