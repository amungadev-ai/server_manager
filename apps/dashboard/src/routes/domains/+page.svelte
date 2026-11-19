<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import MetricCard from '#lib/components/MetricCard.svelte';
  import DomainCard from '#lib/components/DomainCard.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
</script>

<svelte:head><title>Domains — Cloudlane</title></svelte:head>
<PageHeading
  title="Domains"
  eyebrow="NETWORKING / SINGLE SOURCE OF TRUTH"
  description="Register domains once. Manage DNS, subdomains, routing, SSL and email from one place."
>
  {#snippet actions()}<button
      class="btn btn-primary"
      onclick={() => openDialog('domain')}
    >
      <Icon name="plus" size={15} /> Add domain
    </button>{/snippet}
</PageHeading>
<div class="grid three" style="margin-bottom:19px">
  <MetricCard
    icon="globe"
    value={infrastructure.data?.domains.length ?? 0}
    label="Registered domains"
    note="One central domain registry"
  /><MetricCard
    icon="link"
    value={infrastructure.preview?.hostnames.filter((h) => h.serviceId)
      .length ??
      infrastructure.data?.domains.reduce((n, d) => n + d.connections, 0) ??
      0}
    label="Project connections"
    note="Assigned custom hostnames"
  /><MetricCard
    icon="shield"
    value={infrastructure.data?.domains.filter((z) => z.status === 'verified')
      .length ?? 0}
    label="Verified domains"
    note="Eligible for app routing"
  />
</div>
<div class="soft-banner domain-banner" style="margin-bottom:16px">
  <Icon name="shield" size={22} />
  <div>
    <strong class="small">One entry point for domain management</strong>
    <p>
      Add and verify domains here. Within an application, you only select an
      available hostname from this registry—no free-text domain creation.
    </p>
  </div>
</div>
<div class="section-head">
  <h2 class="section-title">Your domains</h2>
  <span class="muted xs">
    {infrastructure.data?.domains.length ?? 0} registered
  </span>
</div>
<div class="domain-zone-grid">
  {#each infrastructure.data?.domains ?? [] as domain}<DomainCard
      {domain}
    />{/each}
</div>
<div class="section-head">
  <h2 class="section-title">Platform-generated application URLs</h2>
</div>
<div class="card cl-default-address-card">
  <div class="row space">
    <div class="row">
      <span class="status-icon"><Icon name="cloud" size={18} /></span>
      <div>
        <div class="strong small">*.apps.example.test</div>
        <p class="muted xs">
          Automatically reserved for web applications and APIs. These URLs are
          platform-managed and cannot be assigned manually.
        </p>
      </div>
    </div>
    <Badge label="Managed by Cloudlane" tone="info" />
  </div>
</div>
