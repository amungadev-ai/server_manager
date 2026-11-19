<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog, copyText, notify } from '#lib/stores/ui.svelte.ts';
  import { previewAction } from '#lib/preview-actions.ts';
  import { formatDate } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  import DnsGuide from '#lib/features/DnsGuide.svelte';
  let tab = $state('overview');
  $effect(() => {
    const requested = page.url.searchParams.get('tab');
    if (
      requested &&
      [
        'overview',
        'dns-records',
        'subdomains',
        'connections',
        'ssl',
        'email',
        'settings',
      ].includes(requested)
    )
      tab = requested;
  });
  const zone = $derived(
    infrastructure.data?.domains.find((z) => z.id === page.params.zoneId),
  );
  const hosts = $derived(
    infrastructure.preview?.hostnames.filter((h) => h.zoneId === zone?.id) ??
      [],
  );
  const records = $derived(
    infrastructure.preview?.dns.filter((r) => r.zoneId === zone?.id) ?? [],
  );
  const connected = $derived(hosts.filter((h) => h.serviceId));
  const mailboxes = $derived(
    infrastructure.preview?.mailboxes.filter((m) => m.zoneId === zone?.id) ??
      [],
  );
  const aliases = $derived(
    infrastructure.preview?.aliases.filter((m) => m.zoneId === zone?.id) ?? [],
  );
  const pending = $derived(
    zone ? infrastructure.preview?.pendingDnsMode[zone.id] : undefined,
  );
  const tabs = [
    ['overview', 'Overview'],
    ['dns-records', 'DNS Records'],
    ['subdomains', 'Subdomains'],
    ['connections', 'Connections'],
    ['ssl', 'SSL'],
    ['email', 'Email'],
    ['settings', 'Settings'],
  ];
  const service = (id: string | null) =>
    infrastructure.data?.services.find((s) => s.id === id);
  function dialog(kind: string, data: Record<string, string> = {}) {
    if (zone) openDialog(kind, { zone: zone.id, ...data });
  }
  function detach(id: string) {
    previewAction((m) => {
      const h = m.hostnames.find((h) => h.id === id);
      if (h) h.serviceId = null;
    });
  }
  function checklist() {
    return (
      `DNS checklist for ${zone?.name} (demo — not published)\n` +
      records
        .map((r) => `${r.type} ${r.name} ${r.value} TTL ${r.ttl}`)
        .join('\n')
    );
  }
</script>

<svelte:head><title>{zone?.name ?? 'Domain'} — Cloudlane</title></svelte:head>
{#if zone}
  <a class="back" href="/domains"><Icon name="back" size={15} /> All domains</a>
  <div class="heading">
    <div>
      <p class="eyebrow">DOMAIN / MANAGEMENT</p>
      <div class="row" style="gap:12px">
        <span class="status-icon mint" style="height:42px;width:42px">
          <Icon name="globe" size={22} />
        </span>
        <h1 class="detail-title mono">{zone.name}</h1>
        <StatusBadge status={zone.status} />
      </div>
      <p class="detail-meta">
        Central resource · {hosts.length} hostnames · {connected.length} connected
        services
      </p>
    </div>
    <div class="head-actions">
      <button class="btn" onclick={() => dialog('subdomain')}>
        <Icon name="plus" size={14} /> Subdomain
      </button><button
        class="btn btn-primary"
        onclick={() => dialog('domainAttach')}
      >
        <Icon name="link" size={14} /> Connect app
      </button>
    </div>
  </div>
  <div class="tabs domain-tabs">
    {#each tabs as [key, label]}<button
        class="tab"
        class:active={tab === key}
        onclick={() => (tab = key)}
      >
        {label}
      </button>{/each}
  </div>
  {#if tab === 'overview'}
    <div class="grid two-wide">
      <div class="col" style="gap:16px">
        <div class="card">
          <div class="row space">
            <h3 class="section-title">Domain overview</h3>
            <StatusBadge status={zone.status} />
          </div>
          <div class="kv" style="margin-top:9px">
            <span class="k">Domain</span><span class="v mono">
              {zone.name}
            </span><span class="k">DNS management</span><span class="v">
              {zone.dnsMode === 'managed'
                ? 'Cloudlane Managed DNS'
                : 'Manual DNS'} (demo)
            </span><span class="k">Registered</span><span class="v">
              {formatDate(infrastructure.preview?.domainCreated[zone.id])}
            </span><span class="k">Hostnames</span><span class="v">
              {hosts.length}
            </span><span class="k">Connections</span><span class="v">
              {connected.length} applications
            </span>
          </div>
          <div class="divider"></div>
          <button class="btn" onclick={() => (tab = 'dns-records')}>
            <Icon name="file" size={14} /> View DNS records
          </button>
          <button class="btn" onclick={() => (tab = 'connections')}>
            <Icon name="link" size={14} /> View connections
          </button>
        </div>
        <div class="card">
          <div class="row space">
            <h3 class="section-title">Recent hostnames</h3>
            <button class="btn btn-small" onclick={() => (tab = 'subdomains')}>
              View all
            </button>
          </div>
          {#each hosts.slice(0, 5) as host}<div class="host-row">
              <span class="mono small">{host.name}</span><Badge
                label={host.serviceId ? 'Connected' : 'Available'}
                tone={host.serviceId ? 'success' : 'info'}
              />
            </div>{/each}
        </div>
      </div>
      <div class="col" style="gap:16px">
        <div class="card">
          <h3 class="section-title">Domain readiness</h3>
          <div class="readiness-list">
            <div><Icon name="check" size={16} /> Domain entry created</div>
            <div>
              <Icon
                name={zone.status === 'verified' ? 'check' : 'alert'}
                size={16}
              /> DNS {zone.status === 'verified'
                ? 'verified'
                : 'verification pending'}
            </div>
            <div>
              <Icon name="shield" size={16} /> HTTPS for connected services
            </div>
            <div><Icon name="mail" size={16} /> Mailboxes and aliases</div>
          </div>
          {#if zone.status !== 'verified'}<button
              class="btn btn-primary"
              onclick={() => dialog('verifyZone')}
            >
              Verify ownership
            </button>{/if}
        </div>
        <div class="card">
          <h3 class="section-title">How this connects to projects</h3>
          <p class="muted small">
            Create hostnames here. In your application's Domains tab, select a
            verified, available hostname. Routes and certificates are then
            simulated automatically.
          </p>
          <div style="margin-top:15px">
            <button class="btn" onclick={() => dialog('subdomain')}>
              <Icon name="plus" size={14} /> Add subdomain
            </button>
          </div>
        </div>
      </div>
    </div>
  {:else if tab === 'dns-records'}
    <DnsGuide domain={zone} />
    <div class="row space" style="margin-bottom:16px">
      <div>
        <h3 class="section-title">DNS records</h3>
        <p class="muted xs">
          {zone.dnsMode === 'managed'
            ? 'Managed zone draft (demo): changes would publish to Cloudlane authoritative nameservers after delegation.'
            : 'Manual DNS checklist: update these records at your current authoritative DNS host.'}
        </p>
      </div>
      <button class="btn btn-primary" onclick={() => dialog('dnsRecord')}>
        <Icon name="plus" size={14} /> Add record
      </button>
    </div>
    <div class="card table-frame">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Type</th><th>Host</th><th>Value / target</th><th>TTL</th><th>
                Action
              </th>
            </tr>
          </thead><tbody>
            {#each records as record}<tr>
                <td>
                  <span class="tag {record.type === 'MX' ? 'violet' : 'blue'}">
                    {record.type}
                  </span>
                </td><td class="mono">{record.name}</td><td
                  class="mono xs dns-value"
                >
                  {#if record.priority !== undefined}<span class="muted">
                      {`${record.priority} · `}
                    </span>{/if}{record.value}
                </td><td class="mono">{record.ttl}s</td><td>
                  <div class="row">
                    <button
                      class="btn btn-small"
                      onclick={() => dialog('dnsRecord', { id: record.id })}
                    >
                      Edit
                    </button><button
                      class="btn btn-small"
                      aria-label="Delete DNS record"
                      onclick={() =>
                        previewAction(
                          (m) =>
                            (m.dns = m.dns.filter((r) => r.id !== record.id)),
                        )}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </td>
              </tr>{:else}<tr>
                <td colspan="5" class="muted">No DNS records yet.</td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
    </div>
    <div class="notice" style="margin-top:16px">
      {zone.dnsMode === 'managed'
        ? 'Production requires authoritative nameserver infrastructure. Records here are only simulated and NOT published.'
        : 'You remain responsible for applying these records at your current DNS host. Edits here never change public DNS.'}
      <button class="btn btn-small" onclick={() => copyText(checklist())}>
        Copy DNS checklist
      </button>
    </div>
  {:else if tab === 'subdomains'}
    <div class="row space" style="margin-bottom:16px">
      <div>
        <h3 class="section-title">Subdomains</h3>
        <p class="muted xs">
          Create names once, then attach them to any eligible application.
        </p>
      </div>
      <button class="btn btn-primary" onclick={() => dialog('subdomain')}>
        <Icon name="plus" size={14} /> Create subdomain
      </button>
    </div>
    <div class="card table-frame">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Hostname</th><th>Type</th><th>Assignment</th><th>Actions</th>
            </tr>
          </thead><tbody>
            {#each hosts as host}<tr>
                <td class="mono main-cell">{host.name}</td><td>
                  <Badge
                    label={host.kind === 'apex' ? 'Apex' : 'Subdomain'}
                    tone={host.kind === 'apex' ? 'neutral' : 'info'}
                  />
                </td><td>
                  {#if host.serviceId}<span class="strong small">
                      {service(host.serviceId)?.name ?? '—'}
                    </span>{:else}<Badge
                      label="Available"
                      tone={zone.status === 'verified' ? 'success' : 'warning'}
                    />{/if}
                </td><td>
                  <div class="row">
                    <button
                      class="btn btn-small"
                      onclick={() =>
                        host.serviceId
                          ? detach(host.id)
                          : dialog('domainAttach', { hostname: host.id })}
                    >
                      {host.serviceId ? 'Detach' : 'Connect'}
                    </button>{#if host.kind !== 'apex' && !host.serviceId}<button
                        class="btn btn-small"
                        aria-label="Delete subdomain"
                        onclick={() =>
                          previewAction(
                            (m) =>
                              (m.hostnames = m.hostnames.filter(
                                (h) => h.id !== host.id,
                              )),
                          )}
                      >
                        <Icon name="trash" size={13} />
                      </button>{/if}
                  </div>
                </td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if tab === 'connections'}
    <div class="row space" style="margin-bottom:16px">
      <div>
        <h3 class="section-title">Project connections</h3>
        <p class="muted xs">
          Hostname assignments are controlled by this registry.
        </p>
      </div>
      <button class="btn btn-primary" onclick={() => dialog('domainAttach')}>
        <Icon name="link" size={14} /> Connect application
      </button>
    </div>
    <div class="card table-frame">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Hostname</th><th>Application</th><th>Project</th><th>
                Status
              </th><th>Action</th>
            </tr>
          </thead><tbody>
            {#each connected as host}<tr>
                <td class="mono main-cell">{host.name}</td><td>
                  {service(host.serviceId)?.name}
                </td><td>
                  {infrastructure.data?.projects.find(
                    (p) => p.id === service(host.serviceId)?.projectId,
                  )?.name}
                </td><td><Badge label="Routing" tone="success" /></td><td>
                  <button class="btn btn-small" onclick={() => detach(host.id)}>
                    Disconnect
                  </button>
                </td>
              </tr>{:else}<tr>
                <td colspan="5">
                  <div class="empty">
                    <h3>No custom connections yet</h3>
                    <p>
                      Assign an available hostname to an application or API.
                    </p>
                  </div>
                </td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
    </div>
    <p class="hint">
      Platform-generated *.apps.example.test addresses remain attached
      automatically and are managed by Cloudlane.
    </p>
  {:else if tab === 'ssl'}
    <div class="row space" style="margin-bottom:16px">
      <div>
        <h3 class="section-title">SSL certificates</h3>
        <p class="muted xs">Certificate issuance and renewal simulation.</p>
      </div>
      <button
        class="btn"
        onclick={() =>
          notify(
            'HTTPS rechecked in simulation only. No certificate was issued.',
          )}
      >
        <Icon name="refresh" size={14} /> Recheck HTTPS
      </button>
    </div>
    <div class="soft-banner" style="margin-bottom:16px">
      <Icon name="shield" size={21} />
      <div>
        <strong class="small">Automatic HTTPS when connected</strong>
        <p>
          Verified hostnames assigned to web apps receive HTTPS in this
          simulation. Production issuance requires real DNS and ACME validation.
        </p>
      </div>
    </div>
    <div class="card table-frame">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Hostname</th><th>Certificate</th><th>Routing</th></tr>
          </thead><tbody>
            {#each connected as host}<tr>
                <td class="mono main-cell">{host.name}</td><td>
                  <Badge label="Active · demo" tone="success" />
                </td><td><StatusBadge status="active" /></td>
              </tr>{:else}<tr>
                <td colspan="3">
                  <div class="empty">
                    <h3>No certificates yet</h3>
                    <p>
                      Connect a verified hostname to an app to preview
                      certificate issuance.
                    </p>
                  </div>
                </td>
              </tr>{/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if tab === 'email'}
    <div class="row space" style="margin-bottom:16px">
      <div>
        <h3 class="section-title">Email for {zone.name}</h3>
        <p class="muted xs">
          Manage mailbox identities and aliases under this domain.
        </p>
      </div>
      <div class="row">
        <button class="btn btn-primary" onclick={() => dialog('mailbox')}>
          <Icon name="plus" size={14} /> Mailbox
        </button><button class="btn" onclick={() => dialog('mailAlias')}>
          Add alias
        </button>
      </div>
    </div>
    <div class="soft-banner" style="margin-bottom:17px">
      <Icon name="mail" size={20} />
      <div>
        <strong class="small">Email management preview</strong>
        <p>
          Mailboxes, aliases and a demo inbox are simulated. Production mail
          transport needs an external provider or optional mail-server
          installation.
        </p>
      </div>
    </div>
    <div class="grid two-wide">
      <div class="card">
        <div class="row space">
          <h3 class="section-title">Mailboxes</h3>
          <Badge label={`${mailboxes.length} active`} tone="info" />
        </div>
        <div class="divider"></div>
        {#each mailboxes as mailbox}<div class="host-row">
            <div class="row">
              <span class="status-icon"><Icon name="mail" size={16} /></span>
              <div>
                <div class="strong small">{mailbox.local}@{zone.name}</div>
                <div class="muted xs">
                  {mailbox.quota} MB quota · Demo mailbox
                </div>
              </div>
            </div>
            <div class="row">
              <button
                class="btn btn-small"
                onclick={() => dialog('inbox', { id: mailbox.id })}
              >
                Open inbox
              </button><button
                class="btn btn-small"
                aria-label="Delete mailbox"
                onclick={() =>
                  previewAction(
                    (m) =>
                      (m.mailboxes = m.mailboxes.filter(
                        (b) => b.id !== mailbox.id,
                      )),
                  )}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>{:else}<p class="muted small">
            No mailboxes. Create your first email account.
          </p>{/each}
      </div>
      <div class="col" style="gap:16px">
        <div class="card">
          <div class="row space">
            <h3 class="section-title">Email aliases</h3>
            <Badge label={`${aliases.length} aliases`} tone="info" />
          </div>
          <div class="divider"></div>
          {#each aliases as alias}<div class="host-row">
              <div>
                <div class="strong small">{alias.local}@{zone.name}</div>
                <div class="muted xs">Forwards to {alias.target}</div>
              </div>
              <button
                class="btn btn-small"
                aria-label="Delete alias"
                onclick={() =>
                  previewAction(
                    (m) =>
                      (m.aliases = m.aliases.filter((a) => a.id !== alias.id)),
                  )}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>{:else}<p class="muted small">No aliases yet.</p>{/each}
        </div>
        <div class="card">
          <h3 class="section-title">Mail DNS readiness</h3>
          <div class="divider"></div>
          {#each ['MX', 'TXT'] as type}<div class="host-row">
              <span class="small">
                {type === 'MX' ? 'MX routing' : 'TXT / SPF policy'}
              </span><Badge
                label={records.some((r) => r.type === type)
                  ? 'Configured (demo)'
                  : 'Missing'}
                tone={records.some((r) => r.type === type)
                  ? 'success'
                  : 'warning'}
              />
            </div>{/each}
          <p class="hint">
            DKIM and DMARC must also be configured before sending real mail.
            Configure records in DNS Records.
          </p>
        </div>
      </div>
    </div>
  {:else if tab === 'settings'}
    <div class="card" style="margin-bottom:18px">
      <div class="row space">
        <div>
          <h3 class="section-title">DNS Management</h3>
          <p class="muted xs" style="margin-top:4px">
            Choose how DNS is hosted for {zone.name}. The current mode stays
            active until a safe transition is verified.
          </p>
        </div>
        <span class="tag {zone.dnsMode === 'managed' ? 'violet' : 'blue'}">
          {zone.dnsMode === 'managed' ? 'Cloudlane Managed DNS' : 'Manual DNS'}
        </span>
      </div>
      <div class="divider"></div>
      <div class="dns-mode-grid">
        {#each [['manual', 'Manual DNS', 'Keep your current nameservers. Copy and manage live records at your existing DNS host.'], ['managed', 'Cloudlane Managed DNS', 'Delegate authoritative nameservers to Cloudlane; requires independent DNS infrastructure in production.']] as [mode, label, description]}<div
            class="dns-mode-choice"
            class:is-current={zone.dnsMode === mode}
            style={zone.dnsMode === mode
              ? 'cursor:default;border-color:var(--mint);background:#142d2d;'
              : 'cursor:default'}
          >
            <div class="row space" style="align-items:center">
              <strong>{label}</strong><Badge
                label={zone.dnsMode === mode ? 'Current mode' : 'Available'}
                tone={zone.dnsMode === mode ? 'success' : 'info'}
              />
            </div>
            <p>{description}</p>
            {#if zone.dnsMode !== mode && !pending}<div style="margin-top:8px">
                <button
                  class="btn btn-small"
                  onclick={() => dialog('dnsModeChange', { mode })}
                >
                  Switch to {label}
                </button>
              </div>{/if}
          </div>{/each}
      </div>
      {#if pending}<div class="notice" style="margin-top:15px">
          <strong>Pending transition:</strong>
          {pending === 'managed' ? 'Cloudlane Managed DNS' : 'Manual DNS'}.
          Existing DNS entries and project connections are preserved while this
          is reviewed.
        </div>
        <div class="row" style="margin-top:13px">
          <button class="btn btn-primary" onclick={() => dialog('verifyZone')}>
            Review transition
          </button><button
            class="btn"
            onclick={() =>
              previewAction((m) => delete m.pendingDnsMode[zone.id])}
          >
            Cancel transition
          </button>
        </div>{/if}
      <p class="hint" style="margin-top:14px">
        DNS records, verification instructions and nameserver setup are shown
        under DNS Records. No real DNS is published by this demo.
      </p>
    </div>
    <div class="grid two-wide">
      <div class="card">
        <h3 class="section-title">Domain settings</h3>
        <div class="kv" style="margin-top:15px">
          <span class="k">Domain</span><span class="v mono">
            {zone.name}
          </span><span class="k">Management</span><span class="v">
            Cloudlane domain registry
          </span><span class="k">DNS provider</span><span class="v">
            {zone.dnsMode === 'managed'
              ? 'Cloudlane Managed DNS'
              : 'Manual DNS'} (demo)
          </span><span class="k">Verification</span><span class="v">
            <StatusBadge status={zone.status} />
          </span>
        </div>
        <div class="divider"></div>
        <button class="btn" onclick={() => (tab = 'dns-records')}>
          View DNS records
        </button>
      </div>
      <div class="card">
        <h3 class="section-title">Danger zone</h3>
        <p class="muted small">
          Removing a domain removes its simulated DNS entries, subdomains,
          mailboxes and aliases. Connected domains must be disconnected first.
        </p>
        <div style="margin-top:18px">
          <button class="btn btn-danger" onclick={() => dialog('deleteZone')}>
            <Icon name="trash" size={14} /> Remove domain
          </button>
        </div>
      </div>
    </div>
  {/if}
{:else}<div class="card empty">
    <h1>Domain not found</h1>
    <a class="btn" href="/domains">Back to Domains</a>
  </div>{/if}
