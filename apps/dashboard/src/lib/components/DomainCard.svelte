<script lang="ts">
  import type { DomainZone } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import Icon from './Icon.svelte';
  import StatusBadge from './StatusBadge.svelte';
  let { domain }: { domain: DomainZone } = $props();
  const hosts = $derived(
    infrastructure.preview?.hostnames.filter((h) => h.zoneId === domain.id) ??
      [],
  );
</script>

<div class="card domain-zone-card">
  <div class="zone-head">
    <span class="zone-mark"><Icon name="globe" size={17} /></span>
    <div class="zone-identity">
      <h3 class="zone-name mono">{domain.name}</h3>
      <span class="zone-mode">
        {domain.dnsMode === 'managed' ? 'Cloudlane Managed DNS' : 'Manual DNS'}
      </span>
    </div>
    <span class="zone-status"><StatusBadge status={domain.status} /></span>
  </div>
  <div class="zone-explainer">
    {domain.status === 'verified'
      ? 'Ready for project connections'
      : domain.dnsMode === 'managed'
        ? 'Nameserver delegation pending (demo)'
        : 'DNS verification pending (demo)'}
  </div>
  <div class="zone-bottom">
    <div class="zone-metrics">
      <span>
        <strong>{hosts.length}</strong> hostname{hosts.length === 1 ? '' : 's'}
      </span><span class="zone-metric-divider" aria-hidden="true"></span><span>
        <strong>
          {infrastructure.preview
            ? hosts.filter((h) => h.serviceId).length
            : domain.connections}
        </strong> connected
      </span>
    </div>
    <a
      class="btn zone-manage btn-small"
      href="/domains/{domain.id}"
      aria-label="Manage {domain.name}"
    >
      Manage <Icon name="arrow" size={14} />
    </a>
  </div>
</div>
