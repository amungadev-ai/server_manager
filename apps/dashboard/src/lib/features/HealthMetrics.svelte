<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  const server = $derived(infrastructure.data?.server);
  const values = $derived(
    server
      ? [
          {
            name: 'CPU usage',
            value: server.cpuPercent,
            detail: `${(server.cpuPercent / 100).toFixed(2)} / 1 vCPU`,
          },
          {
            name: 'Memory usage',
            value: Math.round(
              (server.memoryUsedMb / server.memoryTotalMb) * 100,
            ),
            detail: `${server.memoryUsedMb} MB / ${server.memoryTotalMb.toLocaleString('en-US')} MB`,
          },
          {
            name: 'Disk usage',
            value: Math.round((server.diskUsedGb / server.diskTotalGb) * 100),
            detail: `${server.diskUsedGb} GB / ${server.diskTotalGb} GB`,
          },
        ]
      : [],
  );
</script>

{#if server}<div class="metrics">
    {#each values as metric}<div class="metric">
        <div class="metric-label">
          <span class="muted">{metric.name}</span><span class="metric-value">
            {metric.value}%
          </span>
        </div>
        <div
          class="progress"
          role="meter"
          aria-label={metric.name}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={metric.value}
        >
          <span style:width="{metric.value}%"></span>
        </div>
        <div class="hint">
          {metric.detail}{infrastructure.mode === 'demo' ? ' · simulated' : ''}
        </div>
      </div>{/each}
  </div>{:else}<p class="muted small">
    No server metrics have been reported. Connect a server to view measured
    resource usage.
  </p>{/if}
