<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MetricCard from '#lib/components/MetricCard.svelte';
  import ProjectCard from '#lib/components/ProjectCard.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import ActivityList from './ActivityList.svelte';
  import HealthMetrics from './HealthMetrics.svelte';
  const data = $derived(infrastructure.data);
  const quickActions = [
    {
      kind: 'application',
      icon: 'rocket',
      title: 'Deploy an application',
      detail: 'From ZIP or GitHub',
      tone: 'mint',
    },
    {
      kind: 'database',
      icon: 'database',
      title: 'Create database',
      detail: 'PostgreSQL, MySQL, MariaDB',
      tone: '',
    },
    {
      kind: 'cron',
      icon: 'clock',
      title: 'Schedule a cron job',
      detail: 'HTTP callbacks or tasks',
      tone: 'gold',
    },
  ];
</script>

{#if data}
  <PageHeading
    title="Good morning, builder."
    eyebrow="YOUR INFRASTRUCTURE"
    description="Everything you need to deploy, run and manage your services, in one place."
  >
    {#snippet actions()}<button
        class="btn btn-primary"
        onclick={() => openDialog('create')}
      >
        <Icon name="plus" size={16} /> Create new
      </button>{/snippet}
  </PageHeading>
  <div class="grid four">
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
  <div class="section-head"><h2 class="section-title">Quick actions</h2></div>
  <div class="grid three">
    {#each quickActions as action}<button
        class="quicklink"
        onclick={() => openDialog(action.kind)}
      >
        <span class="status-icon {action.tone}">
          <Icon name={action.icon} size={19} />
        </span><span>
          <span class="q-name">{action.title}</span><span class="q-desc">
            {action.detail}
          </span>
        </span><span style="margin-left:auto;color:var(--muted)">
          <Icon name="chevron" size={15} />
        </span>
      </button>{/each}
  </div>
  <div class="card" style="margin-top:16px">
    <div class="row space" style="flex-wrap:wrap;gap:12px">
      <div class="row">
        <span class="status-icon gold"><Icon name="bucket" size={19} /></span>
        <div>
          <strong class="small">Object storage &amp; media</strong>
          <p class="muted xs">
            Private KYC documents, profile photos, and managed buckets—never VPS
            system files.
          </p>
        </div>
      </div>
      <a class="btn btn-small" href="/storage"> Explore storage → </a>
    </div>
  </div>
  <div class="section-head">
    <div>
      <h2 class="section-title">Your projects</h2>
      <div class="sub">A unified home for every service</div>
    </div>
    <a class="link" href="/projects">
      View all <Icon name="arrow" size={14} />
    </a>
  </div>
  <div class="grid three">
    {#each data.projects.slice(0, 3) as project}<ProjectCard
        {project}
        services={data.services}
      />{:else}<div class="card empty">No projects yet.</div>{/each}
  </div>
  <div class="section-head"><h2 class="section-title">Operations</h2></div>
  <div class="grid two-wide">
    <section class="card">
      <div class="row space">
        <h3 class="section-title">Server health</h3>
        <Badge
          label={data.server
            ? data.server.health === 'healthy'
              ? 'Healthy'
              : data.server.health
            : 'Not connected'}
          tone={data.server?.health === 'healthy' ? 'success' : 'neutral'}
        />
      </div>
      {#if data.server}<p class="muted small">
          {data.server.name} · {data.server.os}
        </p>{/if}<HealthMetrics />{#if infrastructure.mode === 'demo'}<div
          class="divider"
        ></div>
        <div class="row space">
          <span class="xs muted">Starter VPS budget</span><span
            class="xs strong"
          >
            1 vCPU · 1 GB RAM · 10 GB disk
          </span>
        </div>
        <p class="hint" style="margin-top:9px">
          On a 1 GB VPS, build heavy projects off-server; avoid concurrent
          builds and databases.
        </p>{/if}
    </section>
    <section class="card">
      <div class="row space">
        <h3 class="section-title">Recent activity</h3>
        <a class="link" href="/activity">All activity</a>
      </div>
      <ActivityList items={data.activity.slice(0, 4)} />
    </section>
  </div>
{/if}
