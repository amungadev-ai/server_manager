<script lang="ts">
  import type { DomainZone } from '@cloudlane/contracts/preview';
  import Icon from './Icon.svelte';
  import Badge from './Badge.svelte';
  let { domain }: { domain: DomainZone } = $props();
</script>

<a class="domain-card card" href="/domains/{domain.id}">
  <div class="row">
    <span class="resource-icon"><Icon name="globe" size={19} /></span>
    <div class="grow">
      <h3>{domain.name}</h3>
      <p class="muted small">
        {domain.dnsMode === 'manual' ? 'Manual DNS' : 'Managed DNS'}
      </p>
    </div>
    <Icon name="chevron" size={15} />
  </div>
  <div class="row space domain-meta">
    <span class="muted small">{domain.connections} connections</span><Badge
      label={domain.status === 'verified' ? 'Verified' : 'Pending verification'}
      tone={domain.status === 'verified' ? 'success' : 'warning'}
    />
  </div>
</a>
