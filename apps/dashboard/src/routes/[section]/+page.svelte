<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import {
    serviceDetail,
    serviceIcon,
    serviceStatus,
    bytesHuman,
  } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  import MetricCard from '#lib/components/MetricCard.svelte';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import HealthMetrics from '#lib/features/HealthMetrics.svelte';
  import StorageBanner from '#lib/features/StorageBanner.svelte';
  import EmailTables from '#lib/features/EmailTables.svelte';
  const section = $derived(page.params.section);
  const isDb = $derived(section === 'databases');
  const title = $derived(
    isDb
      ? 'Databases'
      : section === 'cron-jobs'
        ? 'Cron Jobs'
        : section === 'server'
          ? 'Servers'
          : section === 'email'
            ? 'Email'
            : section === 'storage'
              ? 'Object Storage'
              : 'Page not found',
  );
  const data = $derived(infrastructure.data);
  const list = $derived(
    data?.services.filter(
      (s) =>
        s.kind ===
        (isDb ? 'database' : section === 'storage' ? 'storage' : 'cron'),
    ) ?? [],
  );
</script>

<svelte:head><title>{title} — Cloudlane</title></svelte:head>
{#if isDb || section === 'cron-jobs'}
  <PageHeading
    {title}
    eyebrow={isDb ? 'DATA LAYER' : 'AUTOMATION'}
    description={isDb
      ? 'Databases for your applications, wherever they run.'
      : 'Schedule callbacks and background operations independently of apps.'}
  >
    {#snippet actions()}<button
        class="btn btn-primary"
        onclick={() => openDialog(isDb ? 'database' : 'cron')}
      >
        <Icon name="plus" size={15} /> Create {isDb ? 'database' : 'cron job'}
      </button>{/snippet}
  </PageHeading>
  <div class="card table-frame">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th><th>Project</th><th>
              {isDb ? 'Engine / database' : 'Schedule / target'}
            </th><th>Status</th><th>Manage</th>
          </tr>
        </thead><tbody>
          {#each list as service}<tr>
              <td>
                <a class="row" href="/services/{service.id}">
                  <span class="status-icon {isDb ? 'gold' : 'purple'}">
                    <Icon name={serviceIcon(service)} size={16} />
                  </span>
                  <div>
                    <div class="main-cell">{service.name}</div>
                    <div class="sub-cell">
                      {isDb
                        ? serviceDetail(service)?.external
                          ? 'Restricted external access'
                          : 'Private network'
                        : (serviceDetail(service)?.timezone ?? 'Not reported')}
                    </div>
                  </div>
                </a>
              </td><td>
                {data?.projects.find((p) => p.id === service.projectId)?.name ??
                  '—'}
              </td><td>
                <div class="main-cell">
                  {isDb
                    ? (serviceDetail(service)?.engine ?? service.framework)
                    : (serviceDetail(service)?.schedule ?? 'Not reported')}
                </div>
                <div class="sub-cell">
                  {isDb
                    ? serviceDetail(service)?.database
                    : serviceDetail(service)?.target}
                </div>
              </td><td><StatusBadge status={serviceStatus(service)} /></td><td>
                <a class="btn btn-small" href="/services/{service.id}">
                  Open <Icon name="chevron" size={13} />
                </a>
              </td>
            </tr>{:else}<tr>
              <td colspan="5">
                <div class="empty">
                  <Icon name={isDb ? 'database' : 'clock'} size={28} />
                  <h3>No {isDb ? 'databases' : 'cron jobs'} yet</h3>
                  <p>Use Create New to provision your first service.</p>
                </div>
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
  </div>
{:else if section === 'email'}
  <PageHeading
    title="Email"
    eyebrow="NETWORKING / COMMUNICATION"
    description="All mailboxes and aliases across your registered domains. Configure domain-specific email from Domains."
  >
    {#snippet actions()}<button
        class="btn btn-primary"
        onclick={() => openDialog('mailbox')}
      >
        <Icon name="plus" size={15} /> New mailbox
      </button>{/snippet}
  </PageHeading>
  <div class="grid three" style="margin-bottom:19px">
    <MetricCard
      icon="mail"
      value={infrastructure.preview?.mailboxes.length ?? 0}
      label="Mailboxes"
      note="Demo mailbox identities"
    /><MetricCard
      icon="link"
      value={infrastructure.preview?.aliases.length ?? 0}
      label="Aliases"
      note="Forwarding addresses"
    /><MetricCard
      icon="globe"
      value={data?.domains.filter((z) => z.status === 'verified').length ?? 0}
      label="Verified domains"
      note="Available for mail setup"
    />
  </div>
  <div class="soft-banner" style="margin-bottom:19px">
    <Icon name="info" size={20} />
    <div>
      <strong class="small">Email in the domain registry</strong>
      <p>
        This is the workspace-wide view. Mail routing, MX/SPF/DKIM/DMARC, and
        domain-specific accounts are managed in Domains → Manage → Email or DNS
        Records. Mail delivery is not active in this demo.
      </p>
    </div>
  </div>
  <EmailTables />
{:else if section === 'server'}
  <PageHeading
    title="Servers"
    eyebrow="INFRASTRUCTURE"
    description="Manage the VPS that powers your projects."
  />
  {#if data?.server}<div class="card" style="margin-bottom:18px">
      <div class="row space" style="flex-wrap:wrap;gap:18px">
        <div class="row">
          <span class="status-icon mint" style="width:45px;height:45px">
            <Icon name="server" size={24} />
          </span>
          <div>
            <h3 style="margin:0 0 3px;font-size:17px">{data.server.name}</h3>
            <div class="muted small">
              {data.server.os} · {infrastructure.mode === 'demo'
                ? 'Docker runtime (simulated)'
                : 'Reported server state'}
            </div>
          </div>
        </div>
        <Badge
          label={infrastructure.mode === 'demo'
            ? 'Online · demo'
            : data.server.health}
          tone="success"
        />
      </div>
      <div class="divider"></div>
      {#if infrastructure.mode === 'demo'}<div class="grid four">
          {#each [['CPU', '1', 'vCPU'], ['Memory', '1', 'GB'], ['Storage', '10', 'GB']] as metric}<div>
              <div class="muted xs">{metric[0]}</div>
              <div style="font-size:21px;font-weight:730">
                {metric[1]} <span class="muted xs">{metric[2]}</span>
              </div>
            </div>{/each}
          <div>
            <div class="muted xs">Agent</div>
            <div style="font-size:18px;font-weight:730;color:var(--mint)">
              Connected*
            </div>
          </div>
        </div>
        <div class="divider"></div>{/if}<HealthMetrics />
    </div>{:else}<div class="card"><HealthMetrics /></div>{/if}
  <div class="grid two">
    <div class="card">
      <div class="row">
        <span class="status-icon gold"><Icon name="alert" size={18} /></span>
        <h3 class="section-title">Minimum VPS profile</h3>
      </div>
      <p class="muted small">
        Designed for Ubuntu 20.04+ with a lightweight single-node control plane,
        but production support and runtime compatibility should be validated per
        OS release.
      </p>
      <div class="notice" style="margin-top:14px">
        <strong>Resource reality check:</strong> A 1 GB / 1 vCPU / 10 GB VPS cannot
        reliably build and host multiple heavy Next.js apps and databases together.
        Production builds should use an external builder or a larger machine; enforce
        quotas and reserve disk space.
      </div>
    </div>
    <div class="card">
      <div class="row">
        <span class="status-icon"><Icon name="shield" size={18} /></span>
        <h3 class="section-title">Protection by default</h3>
      </div>
      <div class="col" style="margin-top:16px;gap:12px">
        {#each [['Isolated application workloads', 'Container resource limits'], ['Internal database networking', 'External exposure opt-in only'], ['Control-plane separation', 'No Docker socket for user apps'], ['Agent operations', 'Allowlisted and authenticated']] as item}<div
            class="row space"
          >
            <span class="small">{item[0]}</span><span class="muted xs">
              {item[1]}
            </span>
          </div>{/each}
      </div>
    </div>
  </div>
{:else if section === 'storage'}
  <PageHeading
    title="Object Storage"
    eyebrow="PROJECT RESOURCES"
    description="Bucket-based file storage for application media, uploads, and private documents."
  >
    {#snippet actions()}<button
        class="btn btn-primary"
        onclick={() => openDialog('storage')}
      >
        <Icon name="plus" size={15} /> Add storage
      </button>{/snippet}
  </PageHeading><StorageBanner />
  <div class="grid three" style="margin-bottom:18px">
    <MetricCard
      icon="bucket"
      value={list.length}
      label="Storage services"
      note="External S3-compatible connections"
    /><MetricCard
      icon="folder"
      value={infrastructure.preview?.buckets.length ?? 0}
      label="Buckets"
      note="Managed inside projects"
    /><MetricCard
      icon="harddrive"
      value={bytesHuman(
        infrastructure.preview?.objects.reduce((n, o) => n + o.size, 0) ?? 0,
      )}
      label="Demo object usage"
      note="Metadata only, no file bytes stored"
    />
  </div>
  <div class="grid two">
    {#each list as service}{@const buckets =
        infrastructure.preview?.buckets.filter(
          (b) => b.serviceId === service.id,
        ) ?? []}<a class="card clickable" href="/services/{service.id}">
        <div class="row space">
          <span class="status-icon mint">
            <Icon name="harddrive" size={20} />
          </span><StatusBadge status={serviceStatus(service)} />
        </div>
        <h3 style="margin:17px 0 6px">{service.name}</h3>
        <p class="muted small">
          {data?.projects.find((p) => p.id === service.projectId)?.name} · {serviceDetail(
            service,
          )?.provider ?? 'Object Storage'}
        </p>
        <div class="divider"></div>
        <div class="row space">
          <span class="muted xs">
            {buckets.length} buckets · {bytesHuman(
              infrastructure.preview?.objects
                .filter((o) => buckets.some((b) => b.id === o.bucketId))
                .reduce((n, o) => n + o.size, 0) ?? 0,
            )}
          </span><Icon name="arrow" size={17} />
        </div>
      </a>{:else}<div class="card empty">No storage services yet.</div>{/each}
  </div>
  <p class="hint" style="margin-top:19px">
    This is a storage management simulation. File selections are recorded as
    metadata; no upload takes place.
  </p>
{:else}<div class="card empty">
    <h1>Page not found</h1>
    <a class="btn" href="/">Back to overview</a>
  </div>{/if}
