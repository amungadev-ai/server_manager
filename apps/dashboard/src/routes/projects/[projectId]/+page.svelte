<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  const data = $derived(infrastructure.data);
  const project = $derived(
    data?.projects.find((p) => p.id === page.params.projectId),
  );
  const services = $derived(
    data?.services.filter((s) => s.projectId === project?.id) ?? [],
  );
  const kinds: Record<string, string> = {
    application: 'rocket',
    database: 'database',
    cron: 'clock',
    storage: 'storage',
  };
  let tab = $state('Services');
</script>

<svelte:head>
  <title>{project?.name ?? 'Project'} — Cloudlane</title>
</svelte:head>
<a class="back-link" href="/projects">
  <Icon name="chevron" size={13} />All projects
</a>
{#if project}
  <PageHeading
    title={project.name}
    eyebrow="Project / Production"
    description={project.description}
  >
    {#snippet actions()}<button
        class="button primary"
        onclick={() => (ui.modal = 'create')}
      >
        <Icon name="plus" size={16} />Add service
      </button>{/snippet}
  </PageHeading>
  <div class="tabs" aria-label="Project sections">
    {#each ['Services', 'Architecture', 'Storage'] as name}<button
        class="tab"
        class:active={tab === name}
        onclick={() => (tab = name)}
        aria-pressed={tab === name}
      >
        {name}
      </button>{/each}
  </div>
  {#if tab === 'Services'}
    <section class="card table-wrap">
      <table class="service-table">
        <thead>
          <tr>
            <th>Service</th><th>Type</th><th>Environment</th><th>Status</th>
          </tr>
        </thead><tbody>
          {#each services as service}<tr>
              <td>
                <div class="row">
                  <span class="resource-icon">
                    <Icon name={kinds[service.kind] ?? 'code'} size={16} />
                  </span>
                  <div class="service-name">
                    <strong>{service.name}</strong><small>
                      {service.framework}
                    </small>
                  </div>
                </div>
              </td><td style="text-transform:capitalize">{service.kind}</td><td>
                <Badge label="production" />
              </td><td>
                <Badge
                  label={service.status === 'running'
                    ? 'Running'
                    : service.status === 'active'
                      ? 'Active'
                      : service.status}
                  tone={service.status === 'failed'
                    ? 'warning'
                    : service.status === 'stopped'
                      ? 'neutral'
                      : 'success'}
                />
              </td>
            </tr>{/each}
        </tbody>
      </table>
      {#each services as service}<div class="service-card">
          <div class="row">
            <span class="resource-icon">
              <Icon name={kinds[service.kind] ?? 'code'} />
            </span>
            <div class="service-name">
              <strong>{service.name}</strong><small>
                {service.framework} · production
              </small>
            </div>
          </div>
          <Badge
            label={service.status.charAt(0).toUpperCase() +
              service.status.slice(1)}
            tone={service.status === 'failed'
              ? 'warning'
              : service.status === 'stopped'
                ? 'neutral'
                : 'success'}
          />
        </div>{/each}
    </section>
  {:else}<div class="empty-state card">
      <span class="empty-icon">
        <Icon name={tab === 'Storage' ? 'storage' : 'overview'} size={25} />
      </span>
      <h2>
        {tab === 'Storage'
          ? 'Storage, scoped to your project.'
          : 'Your services, connected.'}
      </h2>
      <p>
        {tab === 'Storage'
          ? 'External S3-compatible storage and application grants will be available once provider integrations are connected.'
          : 'The architecture view will show confirmed service connections once the resource API is connected.'}
      </p>
      <Badge label="Not available yet" />
    </div>{/if}
{:else}<div class="empty-state card">
    <h2>Project not found</h2>
    <p>This project is not part of the current workspace.</p>
    <a class="button" href="/projects">View projects</a>
  </div>{/if}
