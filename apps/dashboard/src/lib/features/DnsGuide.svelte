<script lang="ts">
  import type { DomainZone } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { copyText, openDialog } from '#lib/stores/ui.svelte.ts';
  import Badge from '#lib/components/Badge.svelte';
  let { domain }: { domain: DomainZone } = $props();
  const mode = $derived(
    infrastructure.preview?.pendingDnsMode[domain.id] ?? domain.dnsMode,
  );
  export function checklist() {
    return (
      `DNS checklist for ${domain.name} (demo — not published)\nMode: ${mode === 'managed' ? 'Cloudlane Managed DNS' : 'Manual DNS'}\n` +
      (infrastructure.preview?.dns
        .filter((r) => r.zoneId === domain.id)
        .map(
          (r) =>
            `${r.type}  ${r.name}  ${r.value}  TTL ${r.ttl}${r.priority !== undefined ? '  priority ' + r.priority : ''}`,
        )
        .join('\n') ?? 'No records reported.')
    );
  }
</script>

<div class="card dns-guide" style="margin-bottom:17px">
  <div class="row space">
    <h3 class="section-title">
      {mode === 'managed' ? 'Nameserver setup' : 'Manual DNS setup'}
    </h3>
    <Badge
      label={mode === 'managed'
        ? domain.status === 'verified' &&
          !infrastructure.preview?.pendingDnsMode[domain.id]
          ? 'Delegation verified (demo)'
          : 'Delegation required'
        : 'Current nameservers stay'}
      tone="info"
    />
  </div>
  {#if mode === 'managed'}<p class="muted small">
      Before changing your registrar's nameservers, copy your existing zone
      records and check DNSSEC/DS. Cloudlane would need two independent
      authoritative nameservers.
    </p>
    <div class="dns-guide-grid">
      {#each ['ns1.dns.cloudlane.example', 'ns2.dns.cloudlane.example'] as ns, i}<div
          class="dns-mini-panel"
        >
          <div class="muted xs">
            {i === 0 ? 'Primary' : 'Secondary'} nameserver (example only)
          </div>
          <div class="mono small" style="margin:7px 0">{ns}</div>
          <button class="btn btn-small" onclick={() => copyText(ns)}>
            Copy example
          </button>
        </div>{/each}
    </div>
    <div class="notice">
      Do not enter these placeholder nameservers at a real registrar. They are
      NOT live.
    </div>{:else}<p class="muted small">
      Keep your existing DNS provider. Copy the requested A/AAAA/CNAME/TXT/MX
      records to it, then verify ownership. No nameserver change is needed.
    </p>
    <div class="row">
      <button class="btn btn-small" onclick={() => copyText(checklist())}>
        Copy DNS checklist
      </button>
    </div>{/if}
  <div class="row">
    {#if domain.status !== 'verified' || infrastructure.preview?.pendingDnsMode[domain.id]}<button
        class="btn btn-primary"
        onclick={() => openDialog('verifyZone', { zone: domain.id })}
      >
        {mode === 'managed'
          ? 'Preview delegation check'
          : 'Preview verification'}
      </button>{:else}<Badge
        label="Setup completed (demo)"
        tone="success"
      />{/if}
  </div>
</div>
