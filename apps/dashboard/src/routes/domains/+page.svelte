<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import DomainCard from '#lib/components/DomainCard.svelte';
  import MetricCard from '#lib/components/MetricCard.svelte';
  import Icon from '#lib/components/Icon.svelte';
  let search = $state('');
  const data = $derived(infrastructure.data);
  const domains = $derived(
    data?.domains.filter((d) =>
      d.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [],
  );
</script>

<svelte:head><title>Domains — Cloudlane</title></svelte:head>
<PageHeading
  title="Domains"
  eyebrow="Global resources"
  description="Manage your domains once. Connect them wherever you need."
>
  {#snippet actions()}<button
      class="button primary"
      onclick={() => (ui.modal = 'domain')}
    >
      <Icon name="plus" size={16} />Add domain
    </button>{/snippet}
</PageHeading>
<div class="grid-three" style="margin-bottom:24px">
  <MetricCard
    icon="globe"
    value={data?.domains.length ?? 0}
    label="Total domains"
    note="One canonical registry"
  /><MetricCard
    icon="shield"
    value={data?.domains.filter((d) => d.status === 'verified').length ?? 0}
    label="Verified domains"
    note="Ownership confirmed"
  /><MetricCard
    icon="clock"
    value={data?.domains.filter((d) => d.status === 'pending').length ?? 0}
    label="Pending verification"
    note="Waiting for DNS records"
  />
</div>
<div class="toolbar">
  <label class="search-field">
    <Icon name="search" size={16} /><input
      bind:value={search}
      placeholder="Search domains…"
      aria-label="Search domains"
    />
  </label><span class="result-count">{domains.length} domains</span>
</div>
<div class="grid-three">
  {#each domains as domain}<DomainCard {domain} />{:else}<p
      class="empty-result"
    >
      No domains match “{search}”.
    </p>{/each}
</div>
