<script lang="ts">
  import type { Service } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog, copyText, askAssistant } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import {
    serviceDetail,
    serviceStatus,
    endpoint,
    formatDate,
    age,
    capitalize,
  } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  import StorageBanner from './StorageBanner.svelte';
  import Terminal from './Terminal.svelte';
  let {
    service,
    tab = $bindable('overview'),
  }: { service: Service; tab?: string } = $props();
  const detail = $derived(serviceDetail(service));
  const deployments = $derived(
    infrastructure.preview?.deployments.filter(
      (d) => d.serviceId === service.id,
    ) ?? [],
  );
  const latest = $derived(deployments[0]);
  const hosts = $derived(
    infrastructure.preview?.hostnames.filter(
      (h) => h.serviceId === service.id,
    ) ?? [],
  );
  const platform = $derived(
    infrastructure.preview?.platformDomains.filter(
      (h) => h.serviceId === service.id,
    ) ?? [],
  );
  let selected = $state('');
  const logDeployment = $derived(
    deployments.find((d) => d.id === selected) ?? latest,
  );
  function deploy(failure = '') {
    previewAction(
      (m) => {
        m.deployments.unshift({
          id: previewId('dep'),
          serviceId: service.id,
          status: failure ? 'FAILED' : 'LIVE',
          revision: failure ? 'demo-failed' : previewId('demo'),
          created: new Date().toISOString(),
          logs: failure
            ? [
                '[SOURCE] Demo source prepared',
                `[${failure === 'build' ? 'BUILD' : 'HEALTH'}] Simulated failure — previous release preserved`,
              ]
            : [
                '[SOURCE] Demo source prepared',
                '[BUILD] Simulated build completed',
                '[HEALTH] Candidate service healthy (simulated)',
                '[ROUTE] Release activated (simulation only)',
              ],
        });
      },
      failure
        ? 'Simulated failure. Existing live release preserved.'
        : 'Demo release activated. No real build or deployment occurred.',
    );
    tab = failure ? 'logs' : 'deployments';
    selected = '';
  }
</script>

{#if tab === 'overview'}
  <div class="grid two-wide">
    <div class="col" style="gap:17px">
      <div class="card">
        <div class="row space">
          <h3 class="section-title">Live application</h3>
          <StatusBadge status={serviceStatus(service)} />
        </div>
        <p class="muted small">Production deployment endpoint</p>
        <div class="callout">
          <div class="row space">
            <div class="col">
              <span class="muted xs">Public URL (demo)</span><span
                class="mono"
                style="font-size:13px;color:var(--mint);overflow-wrap:anywhere"
              >
                https://{endpoint(service)}
              </span>
            </div>
            <button
              class="btn btn-small"
              onclick={() => copyText(`https://${endpoint(service)}`)}
            >
              <Icon name="copy" size={14} /> Copy
            </button>
          </div>
        </div>
        <div class="divider"></div>
        <div class="grid two">
          <div class="kv">
            <span class="k">Framework</span><span class="v">
              {service.framework}
            </span><span class="k">Role</span><span class="v">
              {capitalize(detail?.role ?? 'web')}
            </span>
          </div>
          <div class="kv">
            <span class="k">Environment</span><span class="v">
              production
            </span><span class="k">Runtime</span><span class="v">
              {infrastructure.mode === 'demo'
                ? 'Docker (demo)'
                : 'Not reported'}
            </span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="row space">
          <h3 class="section-title">Latest deployment</h3>
          <button class="link" onclick={() => (tab = 'deployments')}>
            Deployment history
          </button>
        </div>
        {#if latest}<div class="row space" style="margin-top:17px">
            <div>
              <div class="row">
                <StatusBadge status={latest.status} /><span
                  class="mono muted xs"
                >
                  {latest.revision}
                </span>
              </div>
              <p class="muted xs">Started {age(latest.created)}</p>
            </div>
            <button class="btn btn-small" onclick={() => (tab = 'logs')}>
              View logs
            </button>
          </div>{:else}<p class="muted small">No deployment yet</p>{/if}
      </div>
    </div>
    <div class="col" style="gap:17px">
      <div class="card">
        <h3 class="section-title">Source control</h3>
        <div class="divider"></div>
        <div class="row">
          <span class="status-icon">
            <Icon
              name={detail?.source === 'github' ? 'github' : 'archive'}
              size={17}
            />
          </span>
          <div>
            <div class="strong small">
              {detail?.source === 'github'
                ? detail.repo
                : (detail?.fileName ?? 'Not reported')}
            </div>
            <div class="muted xs">
              {detail?.source === 'github'
                ? `Branch ${detail.branch ?? 'main'}`
                : 'Local ZIP source'}
            </div>
          </div>
        </div>
        {#if detail?.source === 'github'}<div class="divider"></div>
          <div class="row space">
            <span class="muted xs">Automatic deploy</span><Badge
              label={detail.autoDeploy ? 'Enabled' : 'Disabled'}
              tone={detail.autoDeploy ? 'success' : 'warning'}
            />
          </div>
          <div style="margin-top:12px">
            <button class="btn btn-small" onclick={() => deploy()}>
              <Icon name="branch" size={14} /> Simulate new commit
            </button>
          </div>{/if}
      </div>
      <div class="card">
        <h3 class="section-title">Health &amp; networking</h3>
        <div class="divider"></div>
        <div class="row space">
          <span class="muted small">Health check</span><StatusBadge
            status={service.status === 'running' ? 'healthy' : service.status}
          />
        </div>
        <div class="row space" style="margin-top:11px">
          <span class="muted small">Domains</span><strong class="small">
            {platform.length + hosts.length}
          </strong>
        </div>
        <div class="row space" style="margin-top:11px">
          <span class="muted small">Build strategy</span><strong class="small">
            Auto-detected
          </strong>
        </div>
      </div>
    </div>
  </div>
{:else if tab === 'deployments'}
  <div class="row space" style="margin-bottom:16px">
    <h3 class="section-title">Deployment history</h3>
    <button class="btn" onclick={() => deploy()}>
      <Icon name="refresh" size={14} /> Redeploy
    </button>
  </div>
  <div class="card table-frame">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Release</th><th>Revision</th><th>Started</th><th>Status</th><th>
              Actions
            </th>
          </tr>
        </thead><tbody>
          {#each deployments as release, index}<tr>
              <td class="mono main-cell">{release.id}</td><td class="mono">
                {release.revision}
              </td><td>{formatDate(release.created)}</td><td>
                <StatusBadge status={release.status} />
              </td><td>
                <div class="row">
                  <button
                    class="btn btn-small"
                    onclick={() => {
                      selected = release.id;
                      tab = 'logs';
                    }}
                  >
                    Logs
                  </button>{#if release.status === 'LIVE' && index > 0}<button
                      class="btn btn-small"
                      onclick={() =>
                        previewAction((m) => {
                          const entries = m.deployments.filter(
                            (d) => d.serviceId === service.id,
                          );
                          m.deployments = [
                            release,
                            ...m.deployments.filter((d) => d.id !== release.id),
                          ];
                        }, 'Retained release selected in simulation only.')}
                    >
                      Rollback
                    </button>{/if}
                </div>
              </td>
            </tr>{:else}<tr>
              <td colspan="5" class="muted">No deployments yet.</td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
  </div>
  <p class="hint">
    Rollback reactivates a retained successful release; no real containers are
    started in this prototype.
  </p>
{:else if tab === 'logs'}
  <div class="card">
    <div class="row space">
      <h3 class="section-title">Build &amp; deployment logs</h3>
      <button
        class="btn btn-small"
        onclick={() =>
          askAssistant(`Explain the latest logs for ${service.name}`)}
      >
        <Icon name="sparkles" size={14} /> Explain with assistant
      </button><Badge
        label={logDeployment?.status ?? '—'}
        tone={logDeployment?.status === 'LIVE' ? 'success' : 'info'}
      />
    </div>
    <p class="muted xs">
      {logDeployment?.id ?? '—'} · {formatDate(logDeployment?.created)}
    </p>
    <div class="codebox" style="margin-top:15px">
      {#each logDeployment?.logs ?? [] as line}<span
          class={/failure|error/i.test(line)
            ? 'error'
            : /HEALTH|ROUTE|synthetic/.test(line)
              ? 'success'
              : 'info'}
        >
          {line}
        </span>{'\n'}{:else}<span class="info">
          Logs will appear here.
        </span>{/each}
    </div>
  </div>
{:else if tab === 'terminal'}<Terminal {service} />
{:else if tab === 'domains'}
  <div class="row space" style="margin-bottom:16px">
    <div>
      <h3 class="section-title">Application domains</h3>
      <p class="muted xs">
        Choose from verified domains created in the central registry.
      </p>
    </div>
    <button
      class="btn btn-primary"
      onclick={() => openDialog('domainAttach', { service: service.id })}
    >
      <Icon name="link" size={15} /> Connect domain
    </button>
  </div>
  <div class="card table-frame">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Hostname</th><th>Type</th><th>Status</th><th>HTTPS</th><th>
              Action
            </th>
          </tr>
        </thead><tbody>
          {#each platform as host}<tr>
              <td class="mono main-cell">{host.name}</td><td>
                Default platform URL
              </td><td><StatusBadge status={host.status} /></td><td>
                <Badge
                  label={host.https ? 'Enabled' : 'Pending'}
                  tone={host.https ? 'success' : 'warning'}
                />
              </td><td><span class="muted xs">Always available</span></td>
            </tr>{/each}{#each hosts as host}<tr>
              <td class="mono main-cell">{host.name}</td><td>
                Custom domain
              </td><td><StatusBadge status="active" /></td><td>
                <Badge label="Enabled" tone="success" />
              </td><td>
                <div class="row">
                  <a class="btn btn-small" href="/domains/{host.zoneId}">
                    Manage
                  </a><button
                    class="btn btn-small"
                    onclick={() => previewAction(() => (host.serviceId = null))}
                  >
                    Detach
                  </button>
                </div>
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
  </div>
  <div class="soft-banner" style="margin-top:17px">
    <Icon name="globe" size={18} />
    <div>
      <strong class="small">Domain management stays centralized</strong>
      <p>
        Need a new domain, DNS record, or subdomain? Go to <a
          class="link"
          href="/domains"
        >
          Domains
        </a> first, then return here to connect it.
      </p>
    </div>
  </div>
{:else if tab === 'variables'}
  <div class="row space" style="margin-bottom:16px">
    <div>
      <h3 class="section-title">Environment variables</h3>
      <p class="muted xs">Variables are demo values, not production secrets.</p>
    </div>
    <button
      class="btn btn-primary"
      onclick={() => openDialog('variable', { service: service.id })}
    >
      <Icon name="plus" size={15} /> Add variable
    </button>
  </div>
  <div class="card table-frame">
    <table class="table">
      <thead><tr><th>Key</th><th>Value</th><th>Actions</th></tr></thead><tbody>
        {#each detail?.variables ?? [] as variable, index}<tr>
            <td class="main-cell mono">{variable.key}</td><td
              class="mono muted"
            >
              ••••••••••••
            </td><td>
              <button
                class="btn btn-small"
                onclick={() =>
                  previewAction((m) =>
                    m.services[service.id].variables?.splice(index, 1),
                  )}
              >
                <Icon name="trash" size={13} /> Remove
              </button>
            </td>
          </tr>{:else}<tr>
            <td colspan="3" class="muted">No variables yet.</td>
          </tr>{/each}
      </tbody>
    </table>
  </div>
  <p class="hint">
    In production, changing variables creates a new configuration revision and
    requires a redeployment.
  </p>
{:else if tab === 'artifacts'}
  <StorageBanner />
  <div class="grid two-wide">
    <div class="card">
      <div class="row space">
        <h3 class="section-title">Deployment artifacts</h3>
        <Badge label="Read-only" tone="info" />
      </div>
      <p class="muted small">
        Illustrative artifact manifest from the latest release; no actual source
        contents are loaded.
      </p>
      <div class="divider"></div>
      {#each service.framework === 'Static HTML' ? ['index.html', 'assets/', 'styles.css'] : service.framework === 'Next.js' ? ['package.json', 'next.config.js', 'app/', '.next/ (build output)'] : service.framework === 'React/Vite' ? ['package.json', 'src/', 'dist/'] : ['package.json', 'src/', 'dist/', 'node_modules/'] as file}<div
          class="file-row"
          style="padding:12px 0"
        >
          <span class="status-icon">
            <Icon name={file.endsWith('/') ? 'folder' : 'file'} size={15} />
          </span><span class="mono small">{file}</span><span
            style="margin-left:auto"
            class="muted xs"
          >
            {file.endsWith('/') ? 'Directory' : 'File'}
          </span>
        </div>{/each}
    </div>
    <div class="card">
      <h3 class="section-title">Immutable application release</h3>
      <div class="kv">
        <span class="k">Release</span><span class="v mono">
          {latest?.revision ?? 'Pending'}
        </span><span class="k">Source</span><span class="v">
          {detail?.source === 'github' ? 'GitHub' : 'ZIP Upload'}
        </span><span class="k">Editing</span><span class="v">
          Disabled
        </span><span class="k">Changes</span><span class="v">
          Deploy a new release
        </span>
      </div>
      <div class="divider"></div>
      <button class="btn" onclick={() => (tab = 'deployments')}>
        View deployments
      </button>
      <p class="hint">
        This is not a live filesystem explorer. Changes must use the deployment
        pipeline.
      </p>
    </div>
  </div>
{:else if tab === 'volumes'}
  <StorageBanner />
  <div class="row space" style="margin-bottom:16px">
    <div>
      <h3 class="section-title">Persistent volumes</h3>
      <p class="muted xs">
        Managed allocations for stateful application data. Separate from object
        storage and deployment files.
      </p>
    </div>
    <button
      class="btn btn-primary"
      onclick={() => openDialog('volumeCreate', { service: service.id })}
    >
      <Icon name="plus" size={15} /> Allocate volume
    </button>
  </div>
  <div class="card">
    {#each infrastructure.preview?.volumes.filter((v) => v.serviceId === service.id) ?? [] as volume}<div
        class="storage-attach"
      >
        <div class="row">
          <span class="status-icon"><Icon name="disk" size={19} /></span>
          <div>
            <strong class="small">{volume.name}</strong>
            <div class="detail mono">
              Container mount: {volume.mountPoint} · {volume.quota} MB limit
            </div>
          </div>
        </div>
        <Badge label="Allocated (demo)" tone="success" />
      </div>{:else}<div class="storage-empty">
        No persistent volumes attached to this application.
      </div>{/each}
  </div>
  <div class="storage-tip" style="margin-top:16px">
    Volumes are never exposed as host OS paths. No arbitrary bind mounts. Real
    volume deletion and backup require explicit retention safeguards.
  </div>
{:else}
  <div class="grid two">
    <div class="card">
      <h3 class="section-title">Service configuration</h3>
      <div class="kv">
        <span class="k">Source</span><span class="v">
          {capitalize(detail?.source ?? 'Not reported')}
        </span><span class="k">Framework</span><span class="v">
          {service.framework}
        </span><span class="k">Role</span><span class="v">
          {capitalize(detail?.role ?? 'web')}
        </span><span class="k">Created</span><span class="v">
          {formatDate(detail?.created)}
        </span>
      </div>
    </div>
    <div class="card">
      <h3 class="section-title">Deployment testing</h3>
      <p class="muted small">
        Verify failure handling by simulating a broken build or failing health
        check.
      </p>
      <div class="col" style="margin-top:14px;align-items:flex-start">
        <button class="btn" onclick={() => deploy('build')}>
          Simulate build failure
        </button><button class="btn" onclick={() => deploy('health')}>
          Simulate health-check failure
        </button>
      </div>
    </div>
  </div>
{/if}
