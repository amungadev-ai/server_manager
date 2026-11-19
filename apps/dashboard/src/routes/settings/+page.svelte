<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog, copyText, ui } from '#lib/stores/ui.svelte.ts';
  import { previewAction } from '#lib/preview-actions.ts';
  import { formatDate } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Appearance from '#lib/features/Appearance.svelte';
  let tab = $state('workspace'),
    workspace = $state('');
  const tabs = [
    ['workspace', 'Workspace'],
    ['integrations', 'Integrations'],
    ['api', 'API Keys'],
    ['security', 'Security'],
    ['server', 'Server'],
    ['preferences', 'Preferences'],
  ];
  $effect(() => {
    const requested = page.url.searchParams.get('tab');
    if (requested && tabs.some((t) => t[0] === requested)) tab = requested;
  });
  $effect(() => {
    workspace = infrastructure.preview?.workspace ?? 'Cloudlane Workspace';
  });
  function toggleGithub() {
    previewAction(
      (m) => (m.githubConnected = !m.githubConnected),
      'GitHub connection toggled in simulation only. No authorization was requested.',
    );
  }
</script>

<svelte:head><title>Settings — Cloudlane</title></svelte:head>
<PageHeading
  title="Settings"
  eyebrow="CONFIGURATION"
  description={tab === 'workspace'
    ? 'Manage your workspace and the local prototype.'
    : 'Connections, security, developer access and platform preferences.'}
/>
<div class="tabs settings-nav">
  {#each tabs as [key, label]}<button
      class="tab"
      class:active={tab === key}
      onclick={() => (tab = key)}
    >
      {label}
    </button>{/each}
</div>
{#if tab === 'workspace'}
  <div class="grid two">
    <div class="card">
      <h3 class="section-title">Workspace</h3>
      <p class="muted small">Your current workspace name</p>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          previewAction((m) => (m.workspace = workspace.trim()));
        }}
      >
        <div class="form-row">
          <label class="form-label" for="workspaceName">
            Workspace name
          </label><input
            id="workspaceName"
            maxlength="54"
            bind:value={workspace}
            required
          />
        </div>
        <button class="btn btn-primary" type="submit">Save changes</button>
      </form>
    </div>
    <div class="card">
      <h3 class="section-title">GitHub connection</h3>
      <p class="muted small">
        Connect repositories via a GitHub App in production. This prototype only
        simulates authorization.
      </p>
      <div class="row space" style="margin-top:22px">
        <div class="row">
          <Icon name="github" size={20} /><strong>
            {infrastructure.preview?.githubConnected
              ? 'Demo account connected'
              : 'Not connected'}
          </strong>
        </div>
        <button
          class="btn"
          class:btn-primary={!infrastructure.preview?.githubConnected}
          onclick={toggleGithub}
        >
          {infrastructure.preview?.githubConnected
            ? 'Disconnect demo'
            : 'Connect demo'}
        </button>
      </div>
    </div>
    <div class="card">
      <h3 class="section-title">Local demo storage</h3>
      <p class="muted small">
        Your projects and simulated operations stay in memory for this session.
        Reload restores the samples.
      </p>
      <div class="divider"></div>
      <button class="btn btn-danger" onclick={() => openDialog('reset')}>
        <Icon name="refresh" size={15} /> Reset sample workspace
      </button>
    </div>
    <div class="card">
      <h3 class="section-title">Scope</h3>
      <p class="muted small">
        ZIP, GitHub, API hosting, database provisioning, cron jobs, domains,
        deployment logs, rollback, and resource monitoring are represented.
      </p>
      <div class="divider"></div>
      <div class="pills">
        <Badge label="No backend" tone="info" /><Badge
          label="No network calls"
          tone="info"
        /><Badge label="Mobile distribution: later" tone="warning" />
      </div>
    </div>
  </div>
{:else if tab === 'integrations'}
  <div class="setting-grid">
    <div class="card setting-feature">
      <div class="row space">
        <div class="row">
          <Icon name="github" size={21} />
          <h3 class="section-title">GitHub</h3>
        </div>
        <Badge
          label={infrastructure.preview?.githubConnected
            ? 'Connected (demo)'
            : 'Not connected'}
          tone={infrastructure.preview?.githubConnected ? 'success' : 'warning'}
        />
      </div>
      <p class="muted small">
        Repository selection and push-triggered deployments. Production uses a
        GitHub App with least-privilege permissions.
      </p>
      <button
        class="btn"
        class:btn-primary={!infrastructure.preview?.githubConnected}
        onclick={toggleGithub}
      >
        {infrastructure.preview?.githubConnected
          ? 'Disconnect demo GitHub'
          : 'Connect demo GitHub'}
      </button>
    </div>
    <div class="card setting-feature">
      <div class="row">
        <Icon name="globe" size={21} />
        <h3 class="section-title">DNS management</h3>
      </div>
      <p class="muted small">
        Use Manual DNS or Cloudlane Managed DNS per domain. No registrar API
        integration is required. Managed mode needs independent authoritative
        DNS infrastructure in production.
      </p>
      <Badge label="Two DNS modes" tone="info" /><a class="btn" href="/domains">
        Go to domains
      </a>
    </div>
    <div class="card setting-feature">
      <div class="row">
        <Icon name="mail" size={21} />
        <h3 class="section-title">Email providers</h3>
      </div>
      <p class="muted small">
        SMTP and mail-provider integrations are a future production option for
        lightweight VPS installations.
      </p>
      <Badge label="Planned integration" tone="info" />
    </div>
    <div class="card setting-feature">
      <div class="row">
        <Icon name="connections" size={21} />
        <h3 class="section-title">Connection principles</h3>
      </div>
      <p class="muted small">
        Each integration has scoped permissions, separate credentials, and a
        revocation path. Do not reuse platform API keys as third-party
        credentials.
      </p>
    </div>
  </div>
{:else if tab === 'api'}
  <div class="card">
    <div class="row space">
      <div>
        <h3 class="section-title">Platform API keys</h3>
        <p class="muted small">
          For external scripts and automation that will call Cloudlane. All keys
          here are nonfunctional demo examples.
        </p>
      </div>
      <button class="btn btn-primary" onclick={() => openDialog('apiKey')}>
        <Icon name="plus" size={15} /> Generate demo key
      </button>
    </div>
    {#if ui.revealedKey}<div class="soft-banner" style="margin:18px 0">
        <Icon name="key" size={20} />
        <div>
          <strong class="small">Copy this example key now</strong>
          <p class="muted xs">
            Displayed only until dismissed. It does not authenticate anywhere.
          </p>
          <div class="token-preview">{ui.revealedKey}</div>
          <div class="row" style="margin-top:10px">
            <button
              class="btn btn-small"
              onclick={() => copyText(ui.revealedKey)}
            >
              Copy demo key
            </button><button
              class="btn btn-small"
              onclick={() => (ui.revealedKey = '')}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>{/if}
    <div class="divider"></div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th><th>Scope</th><th>Created</th><th>Status</th><th>
              Action
            </th>
          </tr>
        </thead><tbody>
          {#each infrastructure.preview?.apiKeys ?? [] as key}<tr>
              <td class="main-cell">
                {key.name}
                <div class="muted xs mono">••••{key.last4}</div>
              </td><td>{key.scope}</td><td>{formatDate(key.created)}</td><td>
                <Badge
                  label={key.revoked ? 'Revoked' : 'Demo active'}
                  tone={key.revoked ? 'warning' : 'success'}
                />
              </td><td>
                {#if !key.revoked}<button
                    class="btn btn-small"
                    onclick={() => previewAction(() => (key.revoked = true))}
                  >
                    Revoke
                  </button>{:else}—{/if}
              </td>
            </tr>{:else}<tr>
              <td colspan="5">
                <div class="empty">No demo API keys yet.</div>
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
  </div>
  <div class="soft-banner" style="margin-top:16px">
    <Icon name="book" size={20} />
    <div>
      <strong class="small">API documentation</strong>
      <p>
        Explore the proposed /api/v1 endpoints, scopes and example requests.
      </p>
    </div>
    <a class="btn btn-small" href="/documentation">Open docs →</a>
  </div>
{:else if tab === 'security'}
  <div class="setting-grid">
    <div class="card">
      <h3 class="section-title">Authorization model</h3>
      <div class="divider"></div>
      <p class="muted small">
        Workspace ownership, per-project membership, scoped service operations,
        and approval gates for destructive actions.
      </p>
      <p class="hint">
        The demo uses one simulated administrator. Real RBAC and multiuser
        sessions are not implemented.
      </p>
    </div>
    <div class="card">
      <h3 class="section-title">Audit trail</h3>
      <div class="divider"></div>
      <p class="muted small">
        Service actions, domain changes, database grants, and AI plan approvals
        must be auditable.
      </p>
      <a class="btn" href="/activity">View activity &amp; logs</a>
    </div>
    <div class="card">
      <div class="row">
        <Icon name="terminal" size={20} />
        <h3 class="section-title">Terminal access policy</h3>
      </div>
      <div class="divider"></div>
      <div class="access-list">
        <div>
          <Badge label="Viewer" tone="warning" /> Application terminal denied
        </div>
        <div>
          <Badge label="Developer" tone="info" /> Container-scoped sessions only
        </div>
        <div>
          <Badge label="Admin" tone="success" /> Maintenance rights still require
          separate approval
        </div>
        <div>
          <Icon name="shield" size={15} /> No terminal from platform API keys
        </div>
        <div>
          <Icon name="shield" size={15} /> Never grant AI unrestricted shell execution
        </div>
      </div>
      <p class="hint">
        The role selector inside the terminal is a demonstration switch, not
        real authorization.
      </p>
    </div>
  </div>
{:else if tab === 'server'}
  <div class="setting-grid">
    <div class="card">
      <h3 class="section-title">Registered server</h3>
      <div class="divider"></div>
      <div class="kv">
        <span class="k">Name</span><span class="v mono">
          {infrastructure.data?.server?.name ?? 'Not connected'}
        </span><span class="k">System</span><span class="v">
          {infrastructure.data?.server?.os ?? 'Not reported'}
        </span><span class="k">Resources</span><span class="v">
          {infrastructure.mode === 'demo'
            ? '1 vCPU · 1 GB RAM · 10 GB disk'
            : 'Not reported'}
        </span>
      </div>
      <div class="divider"></div>
      <a class="btn" href="/server">Open server health</a>
    </div>
    <div class="card">
      <h3 class="section-title">Lightweight operating mode</h3>
      <p class="muted small">
        PostgreSQL + pg-boss for platform jobs, Caddy for HTTPS, optional
        external builds, restricted workload concurrency and disk quotas.
      </p>
      <Badge label="1 GB baseline · design target" tone="info" />
      <p class="hint">
        Not benchmarked or validated on a live VPS in this preview.
      </p>
    </div>
    <div class="card">
      <div class="row space">
        <div class="row">
          <Icon name="key" size={21} />
          <h3 class="section-title">Advanced SSH access</h3>
        </div>
        <Badge label="Administrator only" tone="warning" />
      </div>
      <p class="muted small" style="margin:11px 0">
        SSH is for host maintenance and recovery. Cloudlane does not provide a
        VPS browser terminal, enable SSH, or store private keys.
      </p>
      <div class="divider"></div>
      <div class="kv">
        <span class="k">Access method</span><span class="v">
          External SSH client
        </span><span class="k">Authentication</span><span class="v">
          Administrator-managed public key
        </span><span class="k">Cloudlane API keys</span><span class="v">
          Never valid for SSH
        </span>
      </div>
      <p class="muted xs" style="margin:17px 0 7px">
        Documentation-only example (reserved test IP)
      </p>
      <div class="row" style="gap:9px;flex-wrap:wrap">
        <code
          class="mono"
          style="background:#08131c;padding:9px 11px;border-radius:7px;overflow-wrap:anywhere"
        >
          ssh cloudadmin@203.0.113.42
        </code><button
          class="btn btn-small"
          onclick={() => copyText('ssh cloudadmin@203.0.113.42')}
        >
          <Icon name="copy" size={14} /> Copy example
        </button>
      </div>
      <div class="notice" style="margin-top:15px">
        This address is only an example—not your VPS. Configure SSH through your
        hosting provider, prefer key-only login, and retain provider console
        access for recovery.
      </div>
    </div>
  </div>
{:else}<Appearance />
  <div class="setting-grid">
    <div class="card">
      <h3 class="section-title">Design direction</h3>
      <p class="muted small">
        Simple defaults, progressive disclosure, and contextual actions. Keep
        Projects, Domains, Databases, Email and Cron Jobs accessible from the
        main sidebar.
      </p>
    </div>
    <div class="card">
      <h3 class="section-title">Planned capabilities</h3>
      <p class="muted small">
        Project-scoped file manager, stronger recovery automation, multi-server
        agents, teams and reseller features will be added in phases.
      </p>
      <Badge label="Roadmap · not yet functional" tone="info" />
    </div>
  </div>{/if}
