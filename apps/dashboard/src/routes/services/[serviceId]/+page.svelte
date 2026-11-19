<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import {
    serviceDetail,
    serviceIcon,
    serviceTone,
    serviceStatus,
    capitalize,
  } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import ApplicationService from '#lib/features/ApplicationService.svelte';
  import DatabaseService from '#lib/features/DatabaseService.svelte';
  import CronService from '#lib/features/CronService.svelte';
  import StorageService from '#lib/features/StorageService.svelte';
  let tab = $state('overview');
  const service = $derived(
    infrastructure.data?.services.find((s) => s.id === page.params.serviceId),
  );
  const detail = $derived(serviceDetail(service));
  const project = $derived(
    infrastructure.data?.projects.find((p) => p.id === service?.projectId),
  );
  const tabs = $derived(
    service?.kind === 'application'
      ? [
          'overview',
          'deployments',
          'logs',
          'terminal',
          'domains',
          'variables',
          'artifacts',
          'volumes',
          'settings',
        ]
      : service?.kind === 'database'
        ? ['overview', 'connections', 'console', 'users', 'backups', 'settings']
        : service?.kind === 'storage'
          ? ['overview', 'buckets', 'files', 'access', 'usage', 'settings']
          : ['overview', 'executions', 'settings'],
  );
  $effect(() => {
    page.params.serviceId;
    tab = 'overview';
  });
</script>

<svelte:head>
  <title>{service?.name ?? 'Service'} — Cloudlane</title>
</svelte:head>
{#if service}<a class="back" href="/projects/{service.projectId}">
    <Icon name="back" size={15} />
    {project?.name ?? 'Project'}
  </a>
  {#if service.kind === 'storage'}<PageHeading
      eyebrow="STORAGE / PRODUCTION"
      title={service.name}
      description={`${detail?.provider ?? 'External storage'} · ${project?.name ?? 'Project'} · No host filesystem access`}
    >
      {#snippet actions()}{#if tab === 'buckets' || tab === 'files'}<button
            class="btn btn-primary"
            onclick={() =>
              openDialog(tab === 'buckets' ? 'bucketCreate' : 'objectUpload', {
                service: service.id,
              })}
          >
            <Icon name={tab === 'buckets' ? 'plus' : 'upload'} size={15} />
            {tab === 'buckets' ? 'New bucket' : 'Upload file'}
          </button>{/if}{/snippet}
    </PageHeading>
  {:else}<div class="heading">
      <div>
        <p class="eyebrow">{project?.name ?? 'PROJECT'} / PRODUCTION</p>
        <div class="row" style="gap:11px">
          <span
            class="status-icon {serviceTone(service)}"
            style="width:40px;height:40px"
          >
            <Icon name={serviceIcon(service)} size={20} />
          </span>
          <h1 class="detail-title">{service.name}</h1>
          <StatusBadge status={serviceStatus(service)} />
        </div>
        <p class="detail-meta">
          {service.kind === 'application'
            ? `${service.framework} · ${capitalize(detail?.role ?? 'web')} · ${detail?.source === 'github' ? 'GitHub repository' : 'ZIP upload'}`
            : service.kind === 'database'
              ? `${detail?.engine ?? service.framework} · ${detail?.database ?? 'Not reported'}`
              : `Scheduled ${detail?.method ?? 'HTTP'} request · ${detail?.timezone ?? 'Not reported'}`}
        </p>
      </div>
      <div class="head-actions">
        {#if service.kind === 'database'}<button
            class="btn btn-primary"
            onclick={() => openDialog('dbAdmin', { service: service.id })}
          >
            <Icon name="external" size={15} /> Open {detail?.engine ===
            'PostgreSQL'
              ? 'pgAdmin'
              : 'phpMyAdmin'}
          </button>{/if}
      </div>
    </div>{/if}
  <div class="tabs">
    {#each tabs as key}<button
        class="tab"
        class:active={tab === key}
        onclick={() => (tab = key)}
      >
        {capitalize(key)}
      </button>{/each}
  </div>
  {#key service.id}{#if service.kind === 'application'}<ApplicationService
        {service}
        bind:tab
      />{:else if service.kind === 'database'}<DatabaseService
        {service}
        {tab}
      />{:else if service.kind === 'cron'}<CronService
        {service}
        {tab}
      />{:else}<StorageService {service} bind:tab />{/if}{/key}
{:else}<div class="card empty">
    <h1>Service not found</h1>
    <a class="btn" href="/projects">All projects</a>
  </div>{/if}
