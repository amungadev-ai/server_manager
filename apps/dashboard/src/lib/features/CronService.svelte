<script lang="ts">
  import type { Service } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import { serviceDetail, formatDate, age } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  let { service, tab }: { service: Service; tab: string } = $props();
  const detail = $derived(serviceDetail(service));
  const runs = $derived(
    infrastructure.preview?.cronRuns.filter(
      (r) => r.serviceId === service.id,
    ) ?? [],
  );
  function run() {
    previewAction(
      (m) =>
        m.cronRuns.unshift({
          id: previewId('run'),
          serviceId: service.id,
          status: 'success',
          created: new Date().toISOString(),
          duration: '416ms',
          code: '200 OK',
        }),
      'Demo execution recorded. No HTTP request was sent.',
    );
  }
</script>

{#if tab === 'overview'}<div class="grid two-wide">
    <div class="card">
      <div class="row space">
        <h3 class="section-title">Cron configuration</h3>
        <StatusBadge status={service.status} />
      </div>
      <div class="kv" style="margin-top:14px">
        <span class="k">Schedule</span><span class="v mono">
          {detail?.schedule ?? 'Not reported'}
        </span><span class="k">Timezone</span><span class="v">
          {detail?.timezone ?? 'Not reported'}
        </span><span class="k">HTTP method</span><span class="v">
          {detail?.method ?? 'Not reported'}
        </span><span class="k">Target URL</span><span class="v mono">
          {detail?.target ?? 'Not reported'}
        </span>
      </div>
      <div class="divider"></div>
      <div class="row space">
        <span class="muted small">Job status</span><button
          class="btn"
          onclick={() =>
            previewAction((m) => {
              const d = m.services[service.id];
              d.enabled = !d.enabled;
              service.status = d.enabled ? 'active' : 'stopped';
            })}
        >
          <Icon name={detail?.enabled ? 'pause' : 'play'} size={14} />
          {detail?.enabled ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
    <div class="card">
      <h3 class="section-title">Recent execution</h3>
      {#if runs[0]}<div class="row space" style="margin-top:15px">
          <StatusBadge status={runs[0].status} /><span class="muted xs">
            {age(runs[0].created)}
          </span>
        </div>
        <div class="kv">
          <span class="k">Response</span><span class="v mono">
            {runs[0].code}
          </span><span class="k">Duration</span><span class="v mono">
            {runs[0].duration}
          </span>
        </div>{:else}<p class="muted small">Not executed yet.</p>{/if}
      <div class="divider"></div>
      <button class="btn btn-primary" onclick={run}>
        <Icon name="play" size={14} /> Run now
      </button>
    </div>
  </div>
{:else if tab === 'executions'}<div
    class="row space"
    style="margin-bottom:16px"
  >
    <h3 class="section-title">Execution history</h3>
    <button class="btn btn-primary" onclick={run}>
      <Icon name="play" size={15} /> Run now
    </button>
  </div>
  <div class="card table-frame">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Run</th><th>Time</th><th>Status</th><th>Response</th><th>
              Duration
            </th>
          </tr>
        </thead><tbody>
          {#each runs as run}<tr>
              <td class="main-cell mono">{run.id}</td><td>
                {formatDate(run.created)}
              </td><td><StatusBadge status={run.status} /></td><td class="mono">
                {run.code}
              </td><td class="mono">{run.duration}</td>
            </tr>{:else}<tr>
              <td colspan="5" class="muted">No executions yet.</td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
  </div>
{:else}<div class="card">
    <h3 class="section-title">Cron settings</h3>
    <p class="muted small">Calls are never actually sent in this prototype.</p>
    <div class="kv">
      <span class="k">Name</span><span class="v">{service.name}</span><span
        class="k"
      >
        Schedule
      </span><span class="v mono">
        {detail?.schedule ?? 'Not reported'}
      </span><span class="k">Timezone</span><span class="v">
        {detail?.timezone ?? 'Not reported'}
      </span>
    </div>
    <div class="notice" style="margin-top:16px">
      Production HTTP jobs need protected credentials, SSRF prevention, HTTPS
      verification, timeout and retry controls, and idempotency keys.
    </div>
  </div>{/if}
