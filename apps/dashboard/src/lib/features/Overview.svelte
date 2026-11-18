<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MetricCard from '#lib/components/MetricCard.svelte';
  import ProjectCard from '#lib/components/ProjectCard.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import ActivityList from './ActivityList.svelte';
  const data = $derived(infrastructure.data);
  const quickActions = [
    {
      kind: 'application',
      icon: 'rocket',
      title: 'Deploy an application',
      detail: 'From ZIP or GitHub',
      tone: '',
    },
    {
      kind: 'database',
      icon: 'database',
      title: 'Create database',
      detail: 'PostgreSQL, MySQL, MariaDB',
      tone: 'blue',
    },
    {
      kind: 'cron',
      icon: 'clock',
      title: 'Schedule a cron job',
      detail: 'HTTP callbacks or tasks',
      tone: 'gold',
    },
  ] as const;
</script>

{#if data}
  <PageHeading
    title="Good morning, builder."
    eyebrow="Your infrastructure"
    description="Everything you need to deploy, run and manage your services, in one place."
  >
    {#snippet actions()}<button
        class="button primary"
        onclick={() => (ui.modal = 'create')}
      >
        <Icon name="plus" size={16} />Create new
      </button>{/snippet}
  </PageHeading>
  <div class="grid-four">
    <MetricCard
      icon="folder"
      value={data.projects.length}
      label="Projects"
      note="Organized workspaces"
    /><MetricCard
      icon="rocket"
      value={data.services.filter(
        (s) => s.kind === 'application' && s.status === 'running',
      ).length}
      label="Live applications"
      note="Across all projects"
    /><MetricCard
      icon="database"
      value={data.services.filter((s) => s.kind === 'database').length}
      label="Databases"
      note="Provisioned services"
    /><MetricCard
      icon="clock"
      value={data.services.filter((s) => s.kind === 'cron').length}
      label="Scheduled jobs"
      note="Independent workflows"
    />
  </div>
  <div class="section-heading"><h2>Quick actions</h2></div>
  <div class="grid-three quick-grid">
    {#each quickActions as action}<button
        class="quick-action"
        onclick={() => (ui.modal = action.kind)}
      >
        <span class="resource-icon {action.tone}">
          <Icon name={action.icon} size={19} />
        </span><span>
          <strong>{action.title}</strong><small>{action.detail}</small>
        </span><Icon name="chevron" size={15} />
      </button>{/each}
  </div>
  <div class="section-heading">
    <div>
      <h2>Your projects</h2>
      <p class="section-description">A unified home for every service</p>
    </div>
    <a href="/projects" class="text-link">View all projects</a>
  </div>
  <div class="grid-three overview-projects">
    {#each data.projects as project}<ProjectCard
        {project}
        services={data.services}
      />{/each}
  </div>
  <div class="section-heading"><h2>Operations</h2></div>
  <div class="operations-grid">
    <section class="card">
      <div class="row space">
        <h3>Server health</h3>
        <Badge
          label={data.server
            ? data.server.health === 'healthy'
              ? 'Healthy'
              : data.server.health === 'degraded'
                ? 'Degraded'
                : 'Offline'
            : 'Not connected'}
          tone={data.server?.health === 'healthy'
            ? 'success'
            : data.server
              ? 'warning'
              : 'neutral'}
        />
      </div>
      {#if data.server}
        <p class="server-caption">{data.server.name} · {data.server.os}</p>
        <div class="health-metrics">
          {#each [{ label: 'CPU usage', value: `${data.server.cpuPercent}%`, percent: data.server.cpuPercent }, { label: 'Memory', value: `${data.server.memoryUsedMb} MB / ${data.server.memoryTotalMb} MB`, percent: (data.server.memoryUsedMb / data.server.memoryTotalMb) * 100 }, { label: 'Disk usage', value: `${data.server.diskUsedGb} GB / ${data.server.diskTotalGb} GB`, percent: (data.server.diskUsedGb / data.server.diskTotalGb) * 100 }] as metric}<div>
              <div class="health-label">
                <span>{metric.label}</span><strong>{metric.value}</strong>
              </div>
              <div
                class="progress-track"
                role="meter"
                aria-label={metric.label}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={metric.percent}
              >
                <span style:width="{metric.percent}%"></span>
              </div>
            </div>{/each}
        </div>
        <div class="divider"></div>
        <div class="row space health-note">
          <span>Observed resource usage</span><span>
            {data.server.observedAt.replace('T', ' ').replace('Z', ' UTC')}
          </span>
        </div>
      {:else}<p class="muted" style="margin-top:18px">
          No server metrics have been reported. Connect a server to view
          measured resource usage.
        </p>{/if}
    </section>
    <section class="card">
      <div class="row space">
        <h3>Recent activity</h3>
        <a class="text-link" href="/activity">All activity</a>
      </div>
      <ActivityList items={data.activity} />
    </section>
  </div>
{/if}
