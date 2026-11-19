<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import { bytesHuman } from '#lib/presentation.ts';
  import FormFooter from '#lib/components/FormFooter.svelte';
  let { kind }: { kind: string } = $props();
  const storage = $derived(
    infrastructure.data?.services.find((s) => s.id === ui.modalData.service),
  );
  const buckets = $derived(
    infrastructure.preview?.buckets.filter(
      (b) => b.serviceId === storage?.id,
    ) ?? [],
  );
  const apps = $derived(
    infrastructure.data?.services.filter(
      (s) => s.kind === 'application' && s.projectId === storage?.projectId,
    ) ?? [],
  );
  let name = $state(''),
    purpose = $state(''),
    maxMB = $state('500'),
    scope = $state('read'),
    mount = $state('/data'),
    quota = $state('100'),
    error = $state(''),
    file = $state<File | null>(null),
    bucketId = $state(ui.modalData.bucket ?? ''),
    application = $state('');
  const selected = $derived(
    buckets.find((b) => b.id === bucketId) ?? buckets[0],
  );
  const object = $derived(
    infrastructure.preview?.objects.find((o) => o.id === ui.modalData.id),
  );
  function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    try {
      const ok = previewAction(
        (m) => {
          if (kind === 'bucketCreate') {
            if (!storage || storage.kind !== 'storage')
              throw new Error('Select an object storage service.');
            if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name))
              throw new Error(
                'Use a 3–63 character bucket name with lowercase letters, numbers and hyphens.',
              );
            if (
              m.buckets.some(
                (b) => b.serviceId === storage.id && b.name === name,
              )
            )
              throw new Error('This bucket already exists.');
            m.buckets.push({
              id: previewId('bucket'),
              serviceId: storage.id,
              name,
              purpose,
              maxMB: Number(maxMB),
            });
          } else if (kind === 'volumeCreate') {
            if (!storage || storage.kind !== 'application')
              throw new Error('Select an application.');
            if (!['/data', '/uploads', '/cache'].includes(mount))
              throw new Error('Select an allocated container mount.');
            m.volumes.push({
              id: previewId('volume'),
              serviceId: storage.id,
              name,
              mountPoint: mount,
              quota: Number(quota),
            });
          } else if (!selected) {
            throw new Error('Create a bucket first.');
          } else if (kind === 'storageGrant') {
            const app = apps.find((a) => a.id === (application || apps[0]?.id));
            if (!app || app.projectId !== storage?.projectId)
              throw new Error('Choose an application in this project.');
            if (
              m.grants.some(
                (g) => g.bucketId === selected.id && g.serviceId === app.id,
              )
            )
              throw new Error(
                'This application already has a grant. Revoke it before changing the scope.',
              );
            m.grants.push({
              id: previewId('grant'),
              storageId: storage!.id,
              bucketId: selected.id,
              serviceId: app.id,
              scope,
            });
          } else if (kind === 'storageFolder') {
            if (!/^[a-zA-Z0-9_-]{1,80}$/.test(name))
              throw new Error(
                'Use a single folder label. Paths and parent traversal are not accepted.',
              );
            const key = `${ui.modalData.prefix ?? ''}${name}/`;
            m.objects.push({
              id: previewId('prefix'),
              bucketId: selected.id,
              key,
              size: 0,
              type: 'application/x-directory',
              created: new Date().toISOString(),
            });
          } else if (kind === 'objectUpload') {
            if (!file) throw new Error('Choose a file first.');
            if (
              ![
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf',
              ].includes(file.type) ||
              file.size > 10 * 1024 * 1024
            )
              throw new Error(
                'Choose a JPEG, PNG, WebP or PDF of up to 10 MB.',
              );
            const key = `${ui.modalData.prefix ?? ''}${file.name.replace(/[\\/]/g, '_')}`;
            if (
              m.objects.some((o) => o.bucketId === selected.id && o.key === key)
            )
              throw new Error('An object with this name already exists.');
            m.objects.push({
              id: previewId('obj'),
              bucketId: selected.id,
              key,
              size: file.size,
              type: file.type,
              created: new Date().toISOString(),
            });
          }
        },
        kind === 'objectUpload'
          ? 'Demo metadata recorded. No file bytes were uploaded or stored.'
          : 'Updated in simulation only. No provider or host operation occurred.',
      );
      if (ok) ui.modal = null;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Review the form.';
    }
  }
</script>

{#if kind === 'objectDetails' && object}<div class="kv">
    <span class="k">Object key</span><span class="v mono">
      {object.key}
    </span><span class="k">Bucket</span><span class="v mono">
      {buckets.find((b) => b.id === object.bucketId)?.name}
    </span><span class="k">Content type</span><span class="v">
      {object.type}
    </span><span class="k">Size</span><span class="v">
      {bytesHuman(object.size)}
    </span><span class="k">Availability</span><span class="v">
      Demo metadata only
    </span><span class="k">Privacy</span><span class="v">
      Private (no public URL)
    </span>
  </div>
  <div class="notice" style="margin-top:16px">
    KYC bytes are not included in this prototype. Access to identity documents
    requires explicit authorization, audit events, and time-limited links in
    production.
  </div>
  <div class="modal-footer" style="margin:20px -24px -24px">
    <button class="btn" onclick={() => (ui.modal = null)}>Close</button>
  </div>
{:else}<form onsubmit={submit}>
    {#if kind === 'bucketCreate'}<div class="form-row">
        <label class="form-label" for="bucketName">Bucket name</label><input
          id="bucketName"
          bind:value={name}
          required
          placeholder="maidfinder-kyc"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="bucketPurpose">
          What will you store?
        </label><input
          id="bucketPurpose"
          bind:value={purpose}
          maxlength="90"
          placeholder="Private identity documents"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="bucketQuota">
          Storage quota (demo)
        </label><select id="bucketQuota" bind:value={maxMB}>
          {#each ['100', '250', '500', '1000'] as option}<option value={option}>
              {option === '1000' ? '1 GB' : `${option} MB`}
            </option>{/each}
        </select>
      </div>
      <div class="notice">
        All buckets are private by default. Public KYC access is never enabled
        here.
      </div>
      <FormFooter label="Create private bucket" />
    {:else if kind === 'storageFolder'}<div class="form-row">
        <label class="form-label" for="folderName">
          Virtual folder name
        </label><input
          id="folderName"
          bind:value={name}
          placeholder="sample-user-002"
          required
        />
      </div>
      <p class="hint">
        Folders are object-key prefixes inside {selected?.name ??
          'this bucket'}; they are not VPS directories.
      </p>
      <FormFooter label="Create prefix" />
    {:else if kind === 'objectUpload'}<div class="form-row">
        <span class="form-label">Current bucket</span>
        <div class="tiny-code">
          {selected?.name ?? 'No bucket selected'} / {ui.modalData.prefix ?? ''}
        </div>
      </div>
      <div class="form-row">
        <label class="form-label" for="uploadFile">
          Choose local file
        </label><input
          id="uploadFile"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onchange={(event) => (file = event.currentTarget.files?.[0] ?? null)}
        />
      </div>
      <div class="notice">
        For privacy, this browser demo only records filename, size, and file
        type in memory. The selected file bytes are never uploaded or saved.
      </div>
      <FormFooter label="Record demo upload" disabled={!selected} />
    {:else if kind === 'storageGrant'}<div class="form-row">
        <label class="form-label" for="grantApp">Application</label><select
          id="grantApp"
          value={application || apps[0]?.id}
          onchange={(e) => (application = e.currentTarget.value)}
          required
        >
          {#each apps as app}<option value={app.id}>{app.name}</option>{/each}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label" for="grantBucket">Bucket</label><select
          id="grantBucket"
          value={selected?.id}
          onchange={(e) => (bucketId = e.currentTarget.value)}
          required
        >
          {#each buckets as bucket}<option value={bucket.id}>
              {bucket.name}
            </option>{/each}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label" for="grantScope">
          Permission scope
        </label><select id="grantScope" bind:value={scope}>
          <option value="read">Read objects</option><option value="upload">
            Upload only
          </option><option value="read-write">Read and write</option>
        </select>
      </div>
      <div class="notice">
        Visual permissions only. A production connection must generate
        revocable, scoped credentials and issue short-lived signed URLs as
        needed.
      </div>
      <FormFooter
        label="Grant access (demo)"
        disabled={!apps.length || !buckets.length}
      />
    {:else if kind === 'volumeCreate'}<div class="form-row">
        <label class="form-label" for="volumeName">Volume name</label><input
          id="volumeName"
          bind:value={name}
          required
          placeholder="application-uploads"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="volumeMount">
          Container mount location
        </label><select id="volumeMount" bind:value={mount}>
          <option>/data</option><option>/uploads</option><option>/cache</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label" for="volumeQuota">Quota</label><select
          id="volumeQuota"
          bind:value={quota}
        >
          {#each ['100', '250', '500'] as option}<option value={option}>
              {option} MB
            </option>{/each}
        </select>
      </div>
      <div class="notice">
        Allocated container volumes only. No arbitrary host paths, bind mounts
        or operating system browsing.
      </div>
      <FormFooter label="Allocate demo volume" />{/if}{#if error}<p
        class="form-error"
        role="alert"
      >
        {error}
      </p>{/if}
  </form>{/if}
