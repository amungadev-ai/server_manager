<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog, askAssistant } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import {
    formatDate,
    serviceDetail,
    serviceIcon,
    serviceTone,
    serviceStatus,
    endpoint,
    capitalize,
    bytesHuman,
  } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import StorageBanner from '#lib/features/StorageBanner.svelte';
  let tab = $state('services');
  const project = $derived(
    infrastructure.data?.projects.find((p) => p.id === page.params.projectId),
  );
  const services = $derived(
    infrastructure.data?.services.filter((s) => s.projectId === project?.id) ??
      [],
  );
  const stores = $derived(services.filter((s) => s.kind === 'storage'));
  const apps = $derived(services.filter((s) => s.kind === 'application'));
  const dbs = $derived(services.filter((s) => s.kind === 'database'));
  const links = $derived(
    infrastructure.preview?.serviceLinks.filter(
      (l) =>
        services.some((s) => s.id === l.from) &&
        services.some((s) => s.id === l.to),
    ) ?? [],
  );
  const customHosts = $derived(
    infrastructure.preview?.hostnames.filter((h) =>
      apps.some((s) => s.id === h.serviceId),
    ) ?? [],
  );
  const grants = $derived(
    infrastructure.preview?.grants.filter((g) =>
      stores.some((s) => s.id === g.storageId),
    ) ?? [],
  );
  const suggestions = $derived(
    apps.flatMap((from) =>
      dbs
        .filter(
          (to) => !links.some((l) => l.from === from.id && l.to === to.id),
        )
        .map((to) => ({ from, to })),
    ),
  );
  const buckets = (id: string) =>
    infrastructure.preview?.buckets.filter((b) => b.serviceId === id) ?? [];
  const usage = (id: string) =>
    infrastructure.preview?.objects
      .filter((o) => buckets(id).some((b) => b.id === o.bucketId))
      .reduce((n, o) => n + o.size, 0) ?? 0;
</script>

<svelte:head>
  <title>{project?.name ?? 'Project'} — Cloudlane</title>
</svelte:head>
{#if project}
  <a class="back" href="/projects">
    <Icon name="back" size={15} /> All projects
  </a>
  <PageHeading
    eyebrow="PROJECT / PRODUCTION"
    title={project.name}
    description={`Created ${formatDate(infrastructure.preview?.projectCreated[project.id])} · Default environment: production`}
  >
    {#snippet actions()}<button
        class="btn btn-primary"
        onclick={() => openDialog('create', { project: project.id })}
      >
        <Icon name="plus" size={15} /> Add service
      </button>{/snippet}
  </PageHeading>
  <div class="soft-banner">
    <Icon name="layers" size={21} />
    <div>
      <strong class="small">Production environment</strong>
      <p>
        Services here share a project and can connect privately when supported.
      </p>
    </div>
    <div style="margin-left:auto">
      <Badge label={`${services.length} services`} tone="info" />
    </div>
  </div>
  <div class="tabs project-tabs">
    {#each ['services', 'architecture', 'storage'] as key}<button
        class="tab"
        class:active={tab === key}
        onclick={() => (tab = key)}
      >
        {capitalize(key)}
      </button>{/each}
  </div>
  {#if tab === 'services'}
    <div class="section-head">
      <h2 class="section-title">Services</h2>
      {#if stores.length}<button
          class="btn btn-small"
          onclick={() => (tab = 'storage')}
        >
          Browse storage →
        </button>{/if}
    </div>
    <div class="card table-frame cl-project-services">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Service</th><th>Type</th><th>Status</th><th>
                Endpoint / connection
              </th><th>Actions</th>
            </tr>
          </thead><tbody>
            {#each services as service}<tr>
                <td>
                  <a class="row clickable-cell" href="/services/{service.id}">
                    <span class="status-icon {serviceTone(service)}">
                      <Icon name={serviceIcon(service)} size={16} />
                    </span>
                    <div>
                      <div class="main-cell">{service.name}</div>
                      <div class="sub-cell">production</div>
                    </div>
                  </a>
                </td><td>
                  {service.kind === 'application'
                    ? `${service.framework} · ${capitalize(serviceDetail(service)?.role ?? 'web')}`
                    : service.kind === 'database'
                      ? (serviceDetail(service)?.engine ?? service.framework)
                      : service.kind === 'storage'
                        ? 'Object Storage'
                        : 'Scheduled HTTP'}
                </td><td><StatusBadge status={serviceStatus(service)} /></td><td
                  class="mono xs"
                >
                  {service.kind === 'storage'
                    ? `${buckets(service.id).length} buckets · external provider`
                    : endpoint(service)}
                </td><td>
                  <a class="btn btn-small" href="/services/{service.id}">
                    Manage
                  </a>
                </td>
              </tr>{:else}<tr>
                <td colspan="5">
                  <div class="empty">
                    <h3>No services yet</h3>
                    <p>
                      Add an application, database, cron job, or object storage.
                    </p>
                    <button
                      class="btn btn-primary"
                      onclick={() =>
                        openDialog('create', { project: project.id })}
                    >
                      Add first service
                    </button>
                  </div>
                </td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if tab === 'storage'}
    <StorageBanner />
    <div class="row space" style="margin:20px 0 15px">
      <h2 class="section-title">Object storage</h2>
      <button
        class="btn btn-primary"
        onclick={() => openDialog('storage', { project: project.id })}
      >
        <Icon name="plus" size={14} /> Add storage
      </button>
    </div>
    <div class="grid two">
      {#each stores as service}<div class="card">
          <div class="row space">
            <span class="status-icon mint">
              <Icon name="bucket" size={19} />
            </span><StatusBadge status={serviceStatus(service)} />
          </div>
          <h3 style="margin:15px 0 6px">{service.name}</h3>
          <p class="muted small">
            {buckets(service.id).length} private buckets · {bytesHuman(
              usage(service.id),
            )}
          </p>
          <div class="divider"></div>
          <a class="btn" href="/services/{service.id}">Manage storage →</a>
        </div>{:else}<div class="card empty">
          No object storage in this project yet.
        </div>{/each}
    </div>
  {:else}
    <div class="arch-map">
      <div class="soft-banner">
        <Icon name="connections" size={21} />
        <div>
          <strong class="small">Visual project architecture</strong>
          <p>
            Understand what runs in this project and how services relate.
            Confirmed domain bindings are shown; same-project database links
            remain suggestions until you connect them.
          </p>
        </div>
      </div>
      <div class="arch-head">
        <h2 class="section-title">Production services</h2>
        <div class="arch-summary">
          <span class="arch-legend">
            <span class="dot"></span>{apps.length} applications
          </span><span class="arch-legend">
            <span class="dot gold"></span>{dbs.length} databases
          </span><span class="arch-legend">
            <span class="dot purple"></span>{services.filter(
              (s) => s.kind === 'cron',
            ).length} schedules
          </span>
        </div>
      </div>
      <div class="arch-cards">
        {#each services.filter((s) => s.kind !== 'storage') as service}<article
            class="arch-node"
          >
            <div class="row space">
              <div class="head">
                <span class="status-icon {serviceTone(service)}">
                  <Icon name={serviceIcon(service)} size={17} />
                </span><strong>{service.name}</strong>
              </div>
              <StatusBadge status={serviceStatus(service)} />
            </div>
            <div class="muted xs">
              {service.kind === 'application'
                ? `${service.framework} · ${capitalize(serviceDetail(service)?.role ?? 'web')}`
                : service.kind === 'database'
                  ? `${service.framework} · ${serviceDetail(service)?.database}`
                  : `${serviceDetail(service)?.method} · ${serviceDetail(service)?.schedule}`}
            </div>
            <div class="arch-url">
              {service.kind === 'application'
                ? `https://${endpoint(service)}`
                : service.kind === 'database'
                  ? 'Private network by default'
                  : 'Independent schedule'}
            </div>
            <a class="btn btn-small" href="/services/{service.id}">
              Open service →
            </a>
          </article>{/each}
      </div>
      {#if stores.length}<div class="section-head">
          <h3 class="section-title">Object storage</h3>
          <span class="muted xs">
            {stores.length} managed service{stores.length > 1 ? 's' : ''}
          </span>
        </div>
        <div class="arch-cards">
          {#each stores as service}<article class="arch-node">
              <div class="row space">
                <div class="head">
                  <span class="status-icon gold">
                    <Icon name="bucket" size={18} />
                  </span><strong>{service.name}</strong>
                </div>
                <StatusBadge status={serviceStatus(service)} />
              </div>
              <div class="muted xs">
                Object Storage · {buckets(service.id).length} private buckets
              </div>
              <div class="arch-url">KYC documents · profile photos</div>
              <a class="btn btn-small" href="/services/{service.id}">
                Open storage →
              </a>
            </article>{/each}
        </div>{/if}
      <div class="card">
        <div class="row space">
          <h3 class="section-title">Connections &amp; dependencies</h3>
          <Badge
            label={`${links.length + grants.length + customHosts.length} confirmed (demo)`}
            tone="info"
          />
        </div>
        <div class="divider"></div>
        <div class="arch-links">
          {#each grants as grant}<div class="arch-link">
              <div class="label">
                <Icon name="link" size={15} /><strong class="small">
                  {services.find((s) => s.id === grant.serviceId)?.name}
                </strong><Icon name="arrow" size={14} /><strong class="small">
                  {infrastructure.preview?.buckets.find(
                    (b) => b.id === grant.bucketId,
                  )?.name}
                </strong>
              </div>
              <Badge label="Scoped storage grant · demo" tone="success" />
            </div>{/each}{#each customHosts as host}<div class="arch-link">
              <div class="label">
                <Icon name="globe" size={15} /><span class="mono small">
                  {host.name}
                </span><Icon name="arrow" size={12} /><strong class="small">
                  {services.find((s) => s.id === host.serviceId)?.name}
                </strong>
              </div>
              <Badge label="Domain binding" tone="success" />
            </div>{/each}{#each links as link}<div class="arch-link">
              <div class="label">
                <Icon name="link" size={15} /><strong class="small">
                  {services.find((s) => s.id === link.from)?.name}
                </strong><Icon name="arrow" size={14} /><strong class="small">
                  {services.find((s) => s.id === link.to)?.name}
                </strong>
              </div>
              <div class="row">
                <Badge label="Demo connection" tone="success" /><button
                  class="btn btn-small"
                  onclick={() =>
                    previewAction(
                      (m) =>
                        (m.serviceLinks = m.serviceLinks.filter(
                          (l) => l.id !== link.id,
                        )),
                    )}
                >
                  Unlink
                </button>
              </div>
            </div>{/each}{#each suggestions as pair}<div class="arch-link">
              <div class="label">
                <Icon name="connections" size={16} /><span class="small">
                  {pair.from.name}
                  <Icon name="arrow" size={12} />
                  {pair.to.name}
                </span>
              </div>
              <div class="row">
                <Badge label="Suggested, not connected" tone="warning" /><button
                  class="btn btn-small"
                  onclick={() =>
                    previewAction((m) =>
                      m.serviceLinks.push({
                        id: previewId('link'),
                        from: pair.from.id,
                        to: pair.to.id,
                      }),
                    )}
                >
                  Connect (demo)
                </button>
              </div>
            </div>{/each}{#if !suggestions.length && !links.length && !grants.length && !customHosts.length}<p
              class="muted small"
            >
              No relationships yet. Add an application, database, or custom
              domain.
            </p>{/if}
        </div>
        <p class="hint" style="margin-top:15px">
          A demo connection is a visual relationship only. In production, it
          would also configure scoped credentials, private networking, and
          secrets with approval.
        </p>
      </div>
      <div class="card">
        <div class="row space">
          <div>
            <h3 class="section-title">Understand or troubleshoot this stack</h3>
            <p class="muted xs">
              Ask for a safe diagnostic plan for any service in this project.
            </p>
          </div>
          <button
            class="btn btn-primary"
            onclick={() =>
              askAssistant(
                `Check the health and dependencies of ${project.name}`,
              )}
          >
            <Icon name="sparkles" size={15} /> Ask assistant
          </button>
        </div>
      </div>
    </div>
  {/if}
{:else}<div class="card empty">
    <h1>Project not found</h1>
    <a class="btn" href="/projects">All projects</a>
  </div>{/if}
