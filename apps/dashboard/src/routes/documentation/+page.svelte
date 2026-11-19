<script lang="ts">
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
</script>

<svelte:head><title>Documentation — Cloudlane</title></svelte:head>
<PageHeading
  title="Documentation"
  eyebrow="DEVELOPER REFERENCE"
  description="An implementation-oriented preview of Cloudlane developer tools."
/>
<div class="soft-banner" style="margin-bottom:19px">
  <Icon name="info" size={20} />
  <div>
    <strong class="small">
      Architecture specification, not a running HTTP API
    </strong>
    <p>
      This page previews the product's proposed API. The current foundation has
      typed read contracts; provisioning, credentials and infrastructure
      operations are not connected.
    </p>
  </div>
</div>
<div class="grid two-wide">
  <div class="card">
    <h3 class="section-title">API principles</h3>
    <div class="divider"></div>
    <div class="col" style="gap:10px">
      <div>
        <Badge label="REST /api/v1" tone="info" />
        <Badge label="Bearer tokens" tone="info" />
      </div>
      <p class="muted small">
        Versioned endpoints, workspace-scoped authorization, idempotency keys
        for provisioning, and audit events.
      </p>
      <div class="docs-code">
        {'GET    /api/v1/projects\nPOST   /api/v1/projects\nPOST   /api/v1/deployments\nGET    /api/v1/domains\nPOST   /api/v1/databases\nPOST   /api/v1/cron-jobs'}
      </div>
      <a class="btn" href="/settings?tab=api">Manage demo API keys</a>
    </div>
  </div>
  <div class="card">
    <h3 class="section-title">Our five product principles</h3>
    <div class="divider"></div>
    <div class="col" style="gap:14px">
      {#each [['AI-native management', 'Guided diagnosis and permission-checked plans'], ['Unified workspace', 'One project model and shared resources'], ['Zero-friction deployments', 'ZIP and GitHub share a single pipeline'], ['Self-healing infrastructure', 'Health checks, safe restarts, rollback and alerts'], ['Expandable by design', 'From one VPS to multiple agents and teams']] as [name, description], index}<div
          class="row"
          style="align-items:flex-start"
        >
          <span class="status-icon mint">{index + 1}</span>
          <div>
            <strong class="small">{name}</strong>
            <div class="muted xs">{description}</div>
          </div>
        </div>{/each}
    </div>
  </div>
</div>
<div class="card" style="margin-top:17px">
  <div class="row">
    <Icon name="terminal" size={20} />
    <h3 class="section-title">Terminal and SSH boundaries</h3>
  </div>
  <div class="divider"></div>
  <p class="muted small">
    Application terminals run only inside their authorized containers, and
    database consoles are distinct read-only previews. Server SSH belongs to
    external administrators. Cloudlane API tokens authorize API scopes only;
    they are never operating-system login credentials.
  </p>
  <div class="row" style="margin-top:15px">
    <a class="btn" href="/settings?tab=server">Server access policy</a><a
      class="btn"
      href="/settings?tab=security"
    >
      Security settings
    </a>
  </div>
</div>
