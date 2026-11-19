<script lang="ts">
  import type { Service } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import { previewAction } from '#lib/preview-actions.ts';
  import { serviceDetail, bytesHuman, formatDate } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import MetricCard from '#lib/components/MetricCard.svelte';
  import StorageBanner from './StorageBanner.svelte';
  let {
    service,
    tab = $bindable('overview'),
  }: { service: Service; tab?: string } = $props();
  let bucketId = $state(''),
    prefix = $state(''),
    search = $state('');
  const detail = $derived(serviceDetail(service));
  const buckets = $derived(
    infrastructure.preview?.buckets.filter((b) => b.serviceId === service.id) ??
      [],
  );
  const objects = $derived(
    infrastructure.preview?.objects.filter((o) =>
      buckets.some((b) => b.id === o.bucketId),
    ) ?? [],
  );
  const selected = $derived(
    buckets.find((b) => b.id === bucketId) ?? buckets[0],
  );
  const files = $derived(
    objects
      .filter(
        (o) =>
          o.bucketId === selected?.id &&
          o.key.startsWith(prefix) &&
          !o.key.slice(prefix.length).includes('/') &&
          (!search || o.key.toLowerCase().includes(search.toLowerCase())),
      )
      .sort((a, b) => a.key.localeCompare(b.key)),
  );
  const folders = $derived(
    [
      ...new Set(
        objects
          .filter(
            (o) => o.bucketId === selected?.id && o.key.startsWith(prefix),
          )
          .map((o) => o.key.slice(prefix.length))
          .filter((k) => k.includes('/'))
          .map((k) => k.slice(0, k.indexOf('/') + 1)),
      ),
    ]
      .sort()
      .filter((k) => !search || k.toLowerCase().includes(search.toLowerCase())),
  );
  const total = $derived(objects.reduce((n, o) => n + o.size, 0));
  const grants = $derived(
    infrastructure.preview?.grants.filter((g) => g.storageId === service.id) ??
      [],
  );
  const count = (id: string) =>
    objects.filter((o) => o.bucketId === id && !o.key.endsWith('/')).length;
  const usage = (id: string) =>
    objects.filter((o) => o.bucketId === id).reduce((n, o) => n + o.size, 0);
  function browse(id: string) {
    bucketId = id;
    prefix = '';
    search = '';
    tab = 'files';
  }
  function dialog(kind: string) {
    openDialog(kind, {
      service: service.id,
      bucket: selected?.id ?? '',
      prefix,
    });
  }
</script>

{#if tab === 'overview'}
  <StorageBanner />
  <div class="grid three" style="margin-bottom:16px">
    <MetricCard
      icon="folder"
      value={buckets.length}
      label="Buckets"
      note="Private by default"
    /><MetricCard
      icon="file"
      value={objects.filter((o) => !o.key.endsWith('/')).length}
      label="Objects"
      note="Synthetic objects / metadata"
    /><MetricCard
      icon="harddrive"
      value={bytesHuman(total)}
      label="Used in demo"
      note="Storage bytes are not uploaded"
    />
  </div>
  <div class="store-grid">
    <div class="card">
      <div class="row space">
        <h3 class="section-title">Storage buckets</h3>
        <button class="btn btn-small" onclick={() => (tab = 'buckets')}>
          See all buckets
        </button>
      </div>
      <div class="divider"></div>
      {#each buckets as bucket}<div class="storage-attach">
          <div class="row">
            <span class="status-icon gold">
              <Icon name="folder" size={17} />
            </span>
            <div>
              <strong class="small">{bucket.name}</strong>
              <div class="detail">
                {bucket.purpose || 'Managed object storage'} · {count(
                  bucket.id,
                )} files
              </div>
            </div>
          </div>
          <div class="row">
            <Badge label="Private" tone="success" /><button
              class="btn btn-small"
              onclick={() => browse(bucket.id)}
            >
              Browse
            </button>
          </div>
        </div>{:else}<p class="muted">No buckets yet.</p>{/each}
    </div>
    <div class="col" style="gap:16px">
      <div class="card">
        <h3 class="section-title">Production connection</h3>
        <p class="muted small">
          Use an external S3-compatible provider for small VPS installations.
          The platform controls access through resource-bound credentials.
        </p>
        <div class="divider"></div>
        <div class="kv">
          <span class="k">Provider</span><span class="v">
            {detail?.provider ?? 'Not reported'}
          </span><span class="k">Credentials</span><span class="v">
            Not connected · demo
          </span><span class="k">Data path</span><span class="v">
            Bucket/object key
          </span>
        </div>
      </div>
      <div class="card">
        <h3 class="section-title">Maid Finder example</h3>
        <p class="muted small">
          KYC ID front/back and selfie remain private. Profile photos use a
          separate bucket. The Express API authorizes temporary upload/read
          URLs.
        </p>
        <button class="btn btn-small" onclick={() => (tab = 'access')}>
          View access rules
        </button>
      </div>
    </div>
  </div>
{:else if tab === 'buckets'}
  <div class="row space" style="margin-bottom:16px">
    <div>
      <h3 class="section-title">Buckets</h3>
      <p class="muted xs">
        Buckets are resources, not server directories. New buckets start
        private.
      </p>
    </div>
    <button class="btn btn-primary" onclick={() => dialog('bucketCreate')}>
      <Icon name="plus" size={15} /> Create bucket
    </button>
  </div>
  <div class="grid two">
    {#each buckets as bucket}<article class="card store-card">
        <div class="row space">
          <span class="status-icon gold">
            <Icon name="folder" size={20} />
          </span><Badge label="Private" tone="success" />
        </div>
        <div class="name mono" style="margin-top:15px">{bucket.name}</div>
        <p>{bucket.purpose || 'Application objects'}</p>
        <div class="divider"></div>
        <div class="row space">
          <span class="muted xs">
            {count(bucket.id)} files · {bytesHuman(usage(bucket.id))}
          </span><button
            class="btn btn-small"
            onclick={() => browse(bucket.id)}
          >
            Browse files →
          </button>
        </div>
      </article>{:else}<div class="card empty">
        Create your first private bucket.
      </div>{/each}
  </div>
  <p class="hint">
    In production, quotas, ownership, provider credentials, and encryption
    policies are enforced by backend services, not browser code.
  </p>
{:else if tab === 'files'}
  {#if selected}<StorageBanner />
    <div class="card" style="margin-bottom:16px">
      <div class="row space" style="flex-wrap:wrap">
        <div>
          <h3 class="section-title">Object explorer</h3>
          <p class="muted xs">
            File manager is scoped to a single bucket and prefix.
          </p>
        </div>
        <div class="row" style="flex-wrap:wrap">
          <button class="btn btn-small" onclick={() => dialog('storageFolder')}>
            <Icon name="folder" size={14} /> New folder
          </button><button
            class="btn btn-primary"
            onclick={() => dialog('objectUpload')}
          >
            <Icon name="upload" size={14} /> Upload
          </button>
        </div>
      </div>
      <div class="row" style="gap:13px;margin-top:17px;flex-wrap:wrap">
        <label class="form-label" for="storageBucketSelect">
          Bucket
        </label><select
          id="storageBucketSelect"
          style="max-width:360px"
          value={selected.id}
          onchange={(event) => {
            bucketId = event.currentTarget.value;
            prefix = '';
          }}
        >
          {#each buckets as bucket}<option value={bucket.id}>
              {bucket.name} · Private
            </option>{/each}
        </select>
      </div>
      <div class="row space" style="margin-top:15px;flex-wrap:wrap;gap:11px">
        <div class="file-crumb">
          <Icon name="folderopen" size={17} /><button
            onclick={() => (prefix = '')}
          >
            {selected.name}
          </button>{#each prefix.split('/').filter(Boolean) as part, index}<Icon
              name="chevron"
              size={12}
            /><button
              onclick={() =>
                (prefix =
                  prefix
                    .split('/')
                    .slice(0, index + 1)
                    .join('/') + '/')}
            >
              {part}
            </button>{/each}
        </div>
        <div class="search" style="max-width:260px">
          <Icon name="search" size={15} /><input
            bind:value={search}
            placeholder="Filter files…"
            aria-label="Filter bucket files"
          />
        </div>
      </div>
    </div>
    <div class="card table-frame storage-explorer">
      {#each folders as folder}<button
          class="file-row file-folder"
          onclick={() => (prefix += folder)}
        >
          <span class="status-icon gold">
            <Icon name="folderopen" size={18} />
          </span>
          <div style="flex:1">
            <div class="file-name mono">{folder}</div>
            <div class="file-meta">
              Virtual prefix · only objects in this bucket
            </div>
          </div>
          <span style="color:var(--muted)">
            <Icon name="chevron" size={15} />
          </span>
        </button>{/each}{#each files as object}<div class="file-row">
          <span
            class="status-icon {object.type.startsWith('image/') ? 'mint' : ''}"
          >
            <Icon
              name={object.type.startsWith('image/') ? 'image' : 'file'}
              size={17}
            />
          </span>
          <div style="flex:1;min-width:130px">
            <div class="file-name mono">{object.key.slice(prefix.length)}</div>
            <div class="file-meta">
              {bytesHuman(object.size)} · {object.type} · {formatDate(
                object.created,
              )}
            </div>
          </div>
          <div class="file-actions">
            <Badge label="Private" tone="info" /><button
              class="btn btn-small"
              onclick={() =>
                openDialog('objectDetails', {
                  id: object.id,
                  service: service.id,
                })}
            >
              Details
            </button><button
              class="btn btn-small"
              onclick={() =>
                previewAction(
                  (m) =>
                    (m.objects = m.objects.filter((o) => o.id !== object.id)),
                  'Object metadata removed from this simulation.',
                )}
            >
              Remove
            </button>
          </div>
        </div>{/each}{#if !files.length && !folders.length}<div
          class="storage-empty"
        >
          No objects in this location. Upload a file to create demo metadata.
        </div>{/if}
    </div>
    <p class="hint">
      Demo uploads save only name, MIME type, and size metadata in memory.
      Original file bytes are never uploaded or stored here. No real preview or
      download is provided.
    </p>{:else}<div class="card empty">
      <h3>No buckets yet</h3>
      <button class="btn btn-primary" onclick={() => dialog('bucketCreate')}>
        Create bucket
      </button>
    </div>{/if}
{:else if tab === 'access'}
  <StorageBanner />
  <div class="store-grid">
    <div class="card">
      <div class="row space">
        <div>
          <h3 class="section-title">Application access</h3>
          <p class="muted xs">
            Allow a specific application to use a specific bucket.
          </p>
        </div>
        <button class="btn btn-primary" onclick={() => dialog('storageGrant')}>
          <Icon name="plus" size={14} /> Grant access
        </button>
      </div>
      <div class="divider"></div>
      {#each grants as grant}<div class="storage-attach">
          <div>
            <strong class="small">
              {infrastructure.data?.services.find(
                (s) => s.id === grant.serviceId,
              )?.name ?? 'Deleted application'}
            </strong>
            <div class="detail mono">
              {buckets.find((b) => b.id === grant.bucketId)?.name ??
                'Deleted bucket'}
            </div>
            <span class="access-scope">{grant.scope}</span>
          </div>
          <button
            class="btn btn-small"
            onclick={() =>
              previewAction(
                (m) => (m.grants = m.grants.filter((g) => g.id !== grant.id)),
              )}
          >
            Revoke
          </button>
        </div>{:else}<div class="storage-empty">
          No connected applications. Grant a scoped connection to start.
        </div>{/each}
      <p class="hint">
        These are visual grants only. Production must use short-lived,
        bucket-restricted storage credentials and audited operations.
      </p>
    </div>
    <div class="col" style="gap:16px">
      <div class="card">
        <h3 class="section-title">Signed URLs</h3>
        <p class="muted small">
          Your Express API authenticates users, validates object ownership, and
          issues short-lived upload/download URLs with restricted methods and
          size limits.
        </p>
        <Badge label="No real URLs or secrets generated" tone="warning" />
      </div>
      <div class="card">
        <h3 class="section-title">Privacy safeguards</h3>
        <p class="muted small">
          Private default · encryption · no public KYC links · retention rules ·
          audit log · anti-malware screening and content-type validation.
        </p>
      </div>
    </div>
  </div>
{:else if tab === 'usage'}
  <div class="grid three" style="margin-bottom:18px">
    <MetricCard
      icon="harddrive"
      value={bytesHuman(total)}
      label="Synthetic total"
      note="Object metadata only"
    /><MetricCard
      icon="folder"
      value={buckets.length}
      label="Buckets"
      note="No OS filesystem paths"
    /><MetricCard
      icon="file"
      value={objects.filter((o) => !o.key.endsWith('/')).length}
      label="Objects"
      note="No real uploads"
    />
  </div>
  <div class="card">
    <h3 class="section-title">Bucket usage and quotas</h3>
    <p class="muted xs">
      Quotas are design previews only; no backend is enforcing them yet.
    </p>
    <div class="divider"></div>
    {#each buckets as bucket}<div style="margin:15px 0">
        <div class="row space">
          <strong class="small mono">{bucket.name}</strong><span
            class="muted xs"
          >
            {bytesHuman(usage(bucket.id))} of {bucket.maxMB} MB
          </span>
        </div>
        <div class="progress" style="margin:8px 0">
          <span
            style:width={`${Math.max(0.3, Math.min(100, (usage(bucket.id) / (bucket.maxMB * 1048576)) * 100))}%`}
          ></span>
        </div>
      </div>{/each}
  </div>
  <p class="hint">
    1 GB RAM / 10 GB disk is a control-plane design target. Prefer external
    S3-compatible storage; self-hosted object storage needs additional capacity
    and separate backup planning.
  </p>
{:else}<div class="grid two">
    <div class="card">
      <h3 class="section-title">Storage settings</h3>
      <div class="divider"></div>
      <div class="kv">
        <span class="k">Name</span><span class="v mono">
          {service.name}
        </span><span class="k">Provider</span><span class="v">
          {detail?.provider ?? 'Not reported'}
        </span><span class="k">Deployment</span><span class="v">
          External integration (simulated)
        </span><span class="k">Data reference</span><span class="v">
          Bucket + object key
        </span><span class="k">Host filesystem</span><span class="v">
          Never exposed
        </span>
      </div>
    </div>
    <div class="card">
      <h3 class="section-title">Provider integration</h3>
      <p class="muted small">
        In production, connect a provider through a scoped integration with
        encrypted credentials. Bucket operations use Cloudlane's
        permission-checked API, never client-side master keys.
      </p>
      <div class="divider"></div>
      <Badge label="Connection not configured · demo" tone="warning" />
      <div style="margin-top:16px">
        <a class="btn" href="/settings?tab=integrations">Review integrations</a>
      </div>
    </div>
  </div>{/if}
