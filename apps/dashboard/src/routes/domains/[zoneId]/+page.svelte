<script lang="ts">
  import { page } from '$app/state';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  const domain = $derived(
    infrastructure.data?.domains.find((d) => d.id === page.params.zoneId),
  );
  const tabs = [
    'Overview',
    'DNS Records',
    'Subdomains',
    'Connections',
    'SSL',
    'Email',
    'Settings',
  ];
  let tab = $state('Overview');
</script>

<svelte:head><title>{domain?.name ?? 'Domain'} — Cloudlane</title></svelte:head>
<a class="back-link" href="/domains">
  <Icon name="chevron" size={13} />All domains
</a>
{#if domain}
  <PageHeading
    title={domain.name}
    eyebrow="Domain management"
    description="DNS, connections, certificates and email. All in one place."
  />
  <div class="tabs" aria-label="Domain sections">
    {#each tabs as name}<button
        class="tab"
        class:active={tab === name}
        onclick={() => (tab = name)}
        aria-pressed={tab === name}
      >
        {name}
      </button>{/each}
  </div>
  {#if tab === 'Overview'}<div class="grid-two">
      <section class="card">
        <div class="row space">
          <h2>Domain overview</h2>
          <Badge
            label={domain.status === 'verified' ? 'Verified' : 'Pending'}
            tone={domain.status === 'verified' ? 'success' : 'warning'}
          />
        </div>
        <div class="divider"></div>
        <dl class="info-grid">
          <dt>Domain</dt>
          <dd class="mono">{domain.name}</dd>
          <dt>DNS mode</dt>
          <dd>{domain.dnsMode === 'manual' ? 'Manual DNS' : 'Managed DNS'}</dd>
          <dt>Connections</dt>
          <dd>{domain.connections} services</dd>
          <dt>Data source</dt>
          <dd>Read-only UI fixture</dd>
        </dl>
      </section>
      <section class="card">
        <h2>Your domain, your setup.</h2>
        <p class="muted" style="margin-top:12px;font-size:13px;line-height:1.8">
          Keep DNS with your provider and add the records Cloudlane gives you.
          Connect verified hostnames to services from one registry.
        </p>
        <div class="notice" style="margin-top:20px">
          <Icon name="info" size={17} /><span>
            This is a reserved example domain. No DNS lookup, ownership
            verification or TLS issuance has taken place.
          </span>
        </div>
      </section>
    </div>
  {:else if tab === 'Settings'}<section class="card settings-section">
      <h2>DNS management</h2>
      <p>Choose how this domain's DNS records are managed.</p>
      <div class="settings-kv">
        <div>
          <strong>Manual DNS</strong>
          <p>Manage records with your existing DNS provider.</p>
        </div>
        <Badge label="Default" tone="success" />
      </div>
      <div class="divider"></div>
      <div class="settings-kv">
        <div>
          <strong>Managed DNS</strong>
          <p>
            Requires a connected provider and redundant authoritative
            nameservers.
          </p>
        </div>
        <button class="button compact" disabled>Unavailable</button>
      </div>
      <div class="notice" style="margin-top:22px">
        <Icon name="info" size={17} /><span>
          A mode change will be staged and verified before activation. Managed
          DNS infrastructure is not connected.
        </span>
      </div>
    </section>
  {:else}<section class="empty-state card">
      <span class="empty-icon">
        <Icon
          name={tab === 'Email' ? 'mail' : tab === 'SSL' ? 'shield' : 'globe'}
          size={26}
        />
      </span>
      <h2>{tab}</h2>
      <p>
        {tab === 'DNS Records'
          ? 'Real DNS records and ownership checks will appear when the domain API is connected.'
          : tab === 'Connections'
            ? 'Verified, available hostnames will be connected to services through the API.'
            : tab === 'SSL'
              ? 'Certificate status will be reported after real routing and TLS verification.'
              : tab === 'Email'
                ? 'Domain mailboxes and provider configuration are not available yet.'
                : 'Subdomains will be managed here once the domain API is connected.'}
      </p>
      <Badge label="Not available yet" />
    </section>{/if}
{:else}<div class="empty-state card">
    <h2>Domain not found</h2>
    <p>This domain is not part of the current workspace.</p>
    <a class="button" href="/domains">View domains</a>
  </div>{/if}
