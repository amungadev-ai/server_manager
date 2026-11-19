<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui, copyText } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import FormFooter from '#lib/components/FormFooter.svelte';
  import DnsGuide from './DnsGuide.svelte';
  let { kind }: { kind: string } = $props();
  const existing = $derived(
    infrastructure.preview?.dns.find((r) => r.id === ui.modalData.id),
  );
  let zoneId = $state(
      ui.modalData.zone ?? infrastructure.data?.domains[0]?.id ?? '',
    ),
    name = $state(''),
    value = $state(untrack(() => existing?.value ?? '')),
    type = $state(untrack(() => existing?.type ?? 'A')),
    recordName = $state(untrack(() => existing?.name ?? '@')),
    ttl = $state(untrack(() => existing?.ttl ?? 3600)),
    priority = $state(untrack(() => existing?.priority ?? 10)),
    quota = $state(250),
    target = $state(''),
    error = $state(''),
    ack = $state(false);
  let serviceId = $state(
      ui.modalData.service ??
        infrastructure.data?.services.find((s) => s.kind === 'application')
          ?.id ??
        '',
    ),
    hostnameId = $state(ui.modalData.hostname ?? '');
  const zone = $derived(
    infrastructure.data?.domains.find((z) => z.id === zoneId),
  );
  const apps = $derived(
    infrastructure.data?.services.filter(
      (s) =>
        s.kind === 'application' &&
        infrastructure.preview?.services[s.id]?.role !== 'worker',
    ) ?? [],
  );
  const available = $derived(
    infrastructure.preview?.hostnames.filter(
      (h) =>
        !h.serviceId &&
        (!ui.modalData.zone || h.zoneId === ui.modalData.zone) &&
        infrastructure.data?.domains.find((z) => z.id === h.zoneId)?.status ===
          'verified',
    ) ?? [],
  );
  const selectedHostname = $derived(
    available.find((h) => h.id === hostnameId) ?? available[0],
  );
  const mode = $derived(
    zone
      ? (infrastructure.preview?.pendingDnsMode[zone.id] ?? zone.dnsMode)
      : 'manual',
  );
  function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    try {
      let destination = '';
      if (
        kind === 'domain' &&
        !/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
          name.trim().toLowerCase(),
        )
      )
        throw new Error('Enter a domain name such as example.com.');
      if (
        kind === 'domainAttach' &&
        (!selectedHostname || !apps.some((s) => s.id === serviceId))
      )
        throw new Error(
          'Select an eligible application and available verified hostname.',
        );
      const ok = previewAction(
        (m, d) => {
          if (kind === 'domain') {
            const domain = name.trim().toLowerCase();
            if (d.domains.some((z) => z.name === domain))
              throw new Error('This domain is already registered.');
            const id = previewId('zone');
            d.domains.push({
              id,
              name: domain,
              status: 'pending',
              dnsMode: 'manual',
              connections: 0,
            });
            m.domainCreated[id] = new Date().toISOString();
            m.hostnames.push({
              id: previewId('host'),
              zoneId: id,
              name: domain,
              kind: 'apex',
              serviceId: null,
            });
            destination = `/domains/${id}`;
          } else if (kind === 'domainAttach') {
            const h = m.hostnames.find((h) => h.id === selectedHostname?.id);
            if (
              !h ||
              h.serviceId ||
              d.domains.find((z) => z.id === h.zoneId)?.status !== 'verified'
            )
              throw new Error('This hostname is no longer available.');
            h.serviceId = serviceId;
          } else if (!zone) {
            throw new Error('Select a registered domain.');
          } else if (kind === 'subdomain') {
            if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name))
              throw new Error(
                'Use a single hostname label with letters, digits and hyphens.',
              );
            const host = `${name}.${zone.name}`;
            if (m.hostnames.some((h) => h.name === host))
              throw new Error('This hostname already exists.');
            m.hostnames.push({
              id: previewId('host'),
              zoneId: zone.id,
              name: host,
              kind: 'subdomain',
              serviceId: null,
            });
          } else if (kind === 'dnsRecord') {
            const record = {
              id: existing?.id ?? previewId('dns'),
              zoneId: zone.id,
              type,
              name: recordName.trim(),
              value: value.trim(),
              ttl: Number(ttl),
              ...(type === 'MX' ? { priority: Number(priority) } : {}),
            };
            if (existing)
              m.dns[m.dns.findIndex((r) => r.id === existing.id)] = record;
            else m.dns.push(record);
          } else if (kind === 'mailbox') {
            if (
              m.mailboxes.some((b) => b.zoneId === zone.id && b.local === name)
            )
              throw new Error('That mailbox already exists.');
            m.mailboxes.push({
              id: previewId('mail'),
              zoneId: zone.id,
              local: name,
              quota: Number(quota),
            });
          } else if (kind === 'mailAlias') {
            m.aliases.push({
              id: previewId('alias'),
              zoneId: zone.id,
              local: name,
              target,
            });
          } else if (kind === 'verifyZone') {
            zone.status = 'verified';
            if (m.pendingDnsMode[zone.id]) {
              zone.dnsMode = m.pendingDnsMode[zone.id];
              delete m.pendingDnsMode[zone.id];
            }
          } else if (kind === 'dnsModeChange') {
            if (!ack)
              throw new Error(
                'Acknowledge the simulation before preparing a transition.',
              );
            m.pendingDnsMode[zone.id] =
              zone.dnsMode === 'managed' ? 'manual' : 'managed';
          } else if (kind === 'deleteZone') {
            if (m.hostnames.some((h) => h.zoneId === zone.id && h.serviceId))
              throw new Error(
                'Disconnect all applications before removing this domain.',
              );
            d.domains = d.domains.filter((z) => z.id !== zone.id);
            m.hostnames = m.hostnames.filter((h) => h.zoneId !== zone.id);
            m.dns = m.dns.filter((r) => r.zoneId !== zone.id);
            m.mailboxes = m.mailboxes.filter((b) => b.zoneId !== zone.id);
            m.aliases = m.aliases.filter((a) => a.zoneId !== zone.id);
            delete m.domainCreated[zone.id];
            delete m.pendingDnsMode[zone.id];
            destination = '/domains';
          }
        },
        kind === 'verifyZone'
          ? 'DNS verification simulated. No public DNS was changed.'
          : kind === 'dnsModeChange'
            ? 'Transition prepared. Current mode stays active until verification.'
            : 'Saved in this simulation only. No live DNS or mail operation occurred.',
      );
      if (ok) {
        ui.modal = null;
        if (destination) void goto(destination);
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Review the form.';
    }
  }
</script>

<form onsubmit={submit}>
  {#if kind === 'domain'}<div class="form-row">
      <label class="form-label" for="regDomain">Domain name</label><input
        id="regDomain"
        bind:value={name}
        placeholder="example.com"
        autocomplete="off"
        required
        maxlength="253"
      />
      <p class="hint">
        Add a domain you own. Configure DNS and nameservers later under Manage →
        Settings.
      </p>
    </div>
    <FormFooter label="Add domain" icon="arrow" />
  {:else if kind === 'domainAttach'}
    {#if apps.length && available.length}{#if !ui.modalData.service}<div
          class="form-row"
        >
          <label class="form-label" for="attachService">
            Application / API
          </label><select id="attachService" bind:value={serviceId} required>
            {#each apps as app}<option value={app.id}>
                {app.name} · {infrastructure.data?.projects.find(
                  (p) => p.id === app.projectId,
                )?.name}
              </option>{/each}
          </select>
        </div>{/if}
      <div class="form-row">
        <label class="form-label" for="hostnameId">
          Available hostname
        </label><select
          id="hostnameId"
          value={selectedHostname?.id}
          onchange={(e) => (hostnameId = e.currentTarget.value)}
          required
        >
          {#each available as host}<option value={host.id}>
              {host.name} · {infrastructure.data?.domains.find(
                (z) => z.id === host.zoneId,
              )?.name}
            </option>{/each}
        </select>
        <p class="hint">
          Only verified domains and unassigned hostnames are shown.
        </p>
      </div>
      <div class="callout">
        <div class="row">
          <Icon name="shield" size={17} /><span class="callout-title">
            One registry, one assignment
          </span>
        </div>
        <p>
          This hostname will route to the selected service with simulated
          automatic HTTPS. DNS and subdomain management stay under Domains.
        </p>
      </div>
      <FormFooter label="Connect hostname" icon="arrow" />{:else}<div
        class="empty"
      >
        <Icon name="globe" size={28} />
        <h3>
          {!apps.length
            ? 'No applications yet'
            : 'No available verified hostnames'}
        </h3>
        <p>
          {!apps.length
            ? 'Deploy a website or API first.'
            : 'Register or verify a domain and create an available subdomain in Domains.'}
        </p>
        <a
          class="btn btn-primary"
          href="/domains"
          onclick={() => (ui.modal = null)}
        >
          Go to Domains
        </a>
      </div>{/if}
  {:else if kind === 'verifyZone' && zone}
    <div class="dns-guide">
      {#if mode === 'managed'}<div class="soft-banner">
          <Icon name="globe" size={20} />
          <div>
            <strong>Nameserver delegation (demo)</strong>
            <p>
              At your domain registrar, replace the existing nameservers only
              after migrating all records and checking DNSSEC.
            </p>
          </div>
        </div>
        <div class="dns-guide-grid">
          {#each ['ns1.dns.cloudlane.example', 'ns2.dns.cloudlane.example'] as ns, index}<div
              class="dns-mini-panel"
            >
              <div class="muted xs">Nameserver {index + 1}</div>
              <div class="mono small" style="margin:7px 0">{ns}</div>
              <button
                class="btn btn-small"
                type="button"
                onclick={() => copyText(ns)}
              >
                Copy
              </button>
            </div>{/each}
        </div>
        <div class="notice">
          These .example nameservers are placeholders and WILL NOT resolve. Real
          managed DNS cannot be activated until two independent authoritative
          nameservers are deployed.
        </div>{:else}<div class="callout">
          <h3 class="section-title mono">{zone.name} · Manual DNS</h3>
          <div class="divider"></div>
          <div class="kv">
            <span class="k">Record type</span><span class="v mono">
              TXT
            </span><span class="k">Host</span><span class="v mono">
              _cloudlane
            </span><span class="k">Value</span><span class="v mono">
              cloudlane-verify-demo
            </span>
          </div>
          <p class="hint">
            Create the verification TXT at your current DNS host. Demo values
            are not real verification tokens.
          </p>
        </div>{/if}
      <div class="dns-migration-check">
        <strong class="small">
          Before you finish:
        </strong>{#each ['Copy existing A/AAAA, CNAME, MX, SPF, DKIM, DMARC and verification records', 'Review DNSSEC / registrar DS records when switching nameservers', 'Confirm your website and email will keep resolving'] as step}<div
            class="row"
          >
            <Icon name="check" size={15} />
            {step}
          </div>{/each}
      </div>
    </div>
    <FormFooter
      label={mode === 'managed'
        ? 'Simulate delegation verified'
        : 'Simulate verification'}
    />
  {:else if kind === 'dnsModeChange' && zone}
    <div class="notice">
      Switching authoritative DNS can interrupt websites and email. Cloudlane
      will not change registrar settings for you.
    </div>
    <div class="dns-guide">
      {#each ['Copy your current A/AAAA, CNAME, MX, SPF, DKIM, DMARC and other DNS records.', 'Review DNSSEC / DS records at your registrar and plan a safe transition.', zone.dnsMode === 'manual' ? 'Prepare reliable authoritative nameservers and change registrar delegation only when ready.' : 'Recreate the zone at your external DNS provider, then change delegation back there.'] as step, index}<div
          class="dns-step"
        >
          <span class="dns-step-index">{index + 1}</span><span class="small">
            {step}
          </span>
        </div>{/each}
    </div>
    <label
      class="small"
      style="display:flex;align-items:flex-start;gap:10px;margin:12px 0"
    >
      <input
        type="checkbox"
        bind:checked={ack}
        required
        style="width:auto;margin-top:3px"
      />I understand this is only a preview and no live DNS is changed.
    </label><FormFooter
      label={`Prepare ${zone.dnsMode === 'manual' ? 'managed' : 'manual'} DNS`}
    />
  {:else if kind === 'deleteZone'}<div class="notice">
      Remove {zone?.name} and its simulated DNS entries, hostnames, mailboxes and
      aliases? Connected applications must be detached first.
    </div>
    <FormFooter label="Remove domain" danger />
  {:else}
    {#if kind === 'subdomain' || kind === 'mailbox' || kind === 'mailAlias'}<div
        class="form-row"
      >
        <label class="form-label" for="formZone">Domain</label><select
          id="formZone"
          bind:value={zoneId}
          required
        >
          {#each infrastructure.data?.domains ?? [] as item}<option
              value={item.id}
            >
              {item.name}
            </option>{/each}
        </select>
      </div>{/if}
    {#if kind === 'subdomain'}<div class="form-row">
        <label class="form-label" for="subdomain">Subdomain</label>
        <div class="subdomain-pair">
          <input
            id="subdomain"
            bind:value={name}
            required
            placeholder="api"
            pattern="[a-z0-9][a-z0-9-]*"
          /><span class="mono small muted">.{zone?.name}</span>
        </div>
        <p class="hint">
          Create a hostname here, then assign it from your application's Domains
          tab.
        </p>
      </div>
      <FormFooter label="Create subdomain" />
    {:else if kind === 'dnsRecord'}<div class="form-grid">
        <div class="form-row">
          <label class="form-label" for="recordType">Type</label><select
            id="recordType"
            bind:value={type}
          >
            {#each ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA'] as option}<option>
                {option}
              </option>{/each}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label" for="recordName">Host / name</label><input
            id="recordName"
            bind:value={recordName}
            required
            placeholder="@ or www"
          />
        </div>
      </div>
      <div class="form-row">
        <label class="form-label" for="recordValue">Value / target</label><input
          id="recordValue"
          bind:value
          required
          placeholder="203.0.113.42"
        />
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label class="form-label" for="recordTtl">TTL (seconds)</label><input
            id="recordTtl"
            type="number"
            min="60"
            max="86400"
            bind:value={ttl}
            required
          />
        </div>
        {#if type === 'MX'}<div class="form-row">
            <label class="form-label" for="recordPriority">
              MX priority
            </label><input
              id="recordPriority"
              type="number"
              min="0"
              max="65535"
              bind:value={priority}
            />
          </div>{/if}
      </div>
      <p class="hint">
        Simulated DNS record only. Nothing is published to public DNS.
      </p>
      <FormFooter label="Save record" />
    {:else if kind === 'mailbox' || kind === 'mailAlias'}<div class="form-row">
        <label class="form-label" for="mailLocal">
          {kind === 'mailbox' ? 'Mailbox name' : 'Alias name'}
        </label>
        <div class="subdomain-pair">
          <input
            id="mailLocal"
            bind:value={name}
            required
            placeholder={kind === 'mailbox' ? 'support' : 'hello'}
            pattern="[a-zA-Z0-9._-]+"
          /><span class="mono small muted">@{zone?.name}</span>
        </div>
      </div>
      {#if kind === 'mailbox'}<div class="form-row">
          <label class="form-label" for="mailQuota">Quota (MB)</label><input
            id="mailQuota"
            type="number"
            min="10"
            max="1000"
            bind:value={quota}
            required
          />
        </div>{:else}<div class="form-row">
          <label class="form-label" for="aliasTarget">Forward to</label><input
            id="aliasTarget"
            type="email"
            bind:value={target}
            required
            placeholder="admin@example.com"
          />
        </div>{/if}
      <div class="notice">Email is simulated. No mail is sent or received.</div>
      <FormFooter
        label={kind === 'mailbox' ? 'Create mailbox' : 'Create alias'}
      />{/if}
  {/if}
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
</form>
