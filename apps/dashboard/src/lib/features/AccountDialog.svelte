<script lang="ts">
  import { untrack } from 'svelte';
  import {
    infrastructure,
    loadInfrastructure,
  } from '#lib/stores/infrastructure.svelte.ts';
  import { ui, notify, copyText } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import { serviceDetail } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import FormFooter from '#lib/components/FormFooter.svelte';
  let { kind }: { kind: string } = $props();
  const service = $derived(
    infrastructure.data?.services.find((s) => s.id === ui.modalData.service),
  );
  const detail = $derived(serviceDetail(service));
  const user = $derived(
    infrastructure.preview?.dbUsers.find((u) => u.id === ui.modalData.id),
  );
  const mailbox = $derived(
    infrastructure.preview?.mailboxes.find((m) => m.id === ui.modalData.id),
  );
  const zone = $derived(
    infrastructure.data?.domains.find((z) => z.id === mailbox?.zoneId),
  );
  const privileges = $derived(
    detail?.engine === 'PostgreSQL'
      ? [
          'CONNECT',
          'CREATE',
          'TEMPORARY',
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER',
          'EXECUTE',
          'USAGE',
        ]
      : [
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'CREATE',
          'DROP',
          'ALTER',
          'INDEX',
          'REFERENCES',
          'CREATE TEMPORARY TABLES',
          'LOCK TABLES',
          'EXECUTE',
          'CREATE VIEW',
          'SHOW VIEW',
          'CREATE ROUTINE',
          'ALTER ROUTINE',
          'EVENT',
          'TRIGGER',
        ],
  );
  let name = $state(''),
    value = $state(''),
    cidr = $state(untrack(() => detail?.allowedIp ?? '')),
    preset = $state('readonly'),
    scope = $state('projects:read'),
    show = $state(false),
    error = $state(''),
    selected = $state<string[]>(
      untrack(() => (user ? [...user.privileges] : [])),
    );
  function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    try {
      if (kind === 'dbExternal') {
        const match = cidr.match(
          /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/,
        );
        if (
          !match ||
          match.slice(1, 5).some((n) => Number(n) > 255) ||
          Number(match[5]) < 1 ||
          Number(match[5]) > 32
        )
          throw new Error(
            'Enter a valid restricted IPv4 CIDR. Wildcard access is rejected.',
          );
      }
      const ok = previewAction(
        (m) => {
          if (kind === 'variable') {
            if (!service) throw new Error('Select an application.');
            const vars = (m.services[service.id].variables ??= []);
            if (vars.some((v) => v.key === name))
              throw new Error('A variable with this name already exists.');
            vars.push({ key: name, value });
          } else if (kind === 'dbExternal') {
            if (!service) throw new Error('Select a database.');
            m.services[service.id].external = true;
            m.services[service.id].allowedIp = cidr;
          } else if (kind === 'dbPrivileges') {
            if (user) user.privileges = [...selected];
          } else if (kind === 'dbUser') {
            if (!service) throw new Error('Select a database.');
            if (
              m.dbUsers.some(
                (u) => u.serviceId === service.id && u.username === name,
              )
            )
              throw new Error('This database user already exists.');
            m.dbUsers.push({
              id: previewId('dbuser'),
              serviceId: service.id,
              username: name,
              privileges:
                preset === 'full'
                  ? [...privileges]
                  : preset === 'app'
                    ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
                    : ['SELECT'],
              revoked: false,
            });
          } else if (kind === 'apiKey') {
            const id = previewId('key');
            m.apiKeys.push({
              id,
              name,
              scope,
              last4: id.slice(-4),
              created: new Date().toISOString(),
              revoked: false,
            });
            ui.revealedKey = `cl_demo_not_real_${id}`;
          }
        },
        kind === 'apiKey'
          ? 'Nonfunctional demo key created. It cannot authenticate anywhere.'
          : 'Updated in this simulation only. No real credential or permission was changed.',
      );
      if (ok) ui.modal = null;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Review the form.';
    }
  }
</script>

{#if kind === 'reset'}<div class="notice">
    This will remove all projects, services and simulated operations created in
    this preview session and restore the sample workspace.
  </div>
  <div class="modal-footer" style="margin:20px -24px -24px">
    <button class="btn" onclick={() => (ui.modal = null)}>
      Keep my data
    </button><button
      class="btn btn-danger"
      disabled={infrastructure.mode !== 'demo'}
      onclick={() => {
        ui.modal = null;
        ui.revealedKey = '';
        void loadInfrastructure();
      }}
    >
      Reset demo workspace
    </button>
  </div>
{:else if kind === 'inbox' && mailbox}<div class="row space">
    <strong class="mono small">{mailbox.local}@{zone?.name}</strong><Badge
      label="Demo inbox"
      tone="info"
    />
  </div>
  <div class="inbox-demo">
    <div class="inbox-message">
      <strong>Welcome to your mailbox</strong><span class="muted xs">
        Cloudlane demo · just now
      </span>
      <p>This is a sample message showing how a future inbox may look.</p>
    </div>
    <div class="inbox-message">
      <strong>Domain configuration checklist</strong><span class="muted xs">
        System · yesterday
      </span>
      <p>
        MX, SPF, DKIM and DMARC will need verification when a real email
        provider is connected.
      </p>
    </div>
  </div>
  <div class="modal-footer" style="margin:20px -24px -24px">
    <button class="btn" onclick={() => (ui.modal = null)}>Close</button>
  </div>
{:else if kind === 'dbAdmin'}<div
    class="soft-banner"
    style="margin-bottom:16px"
  >
    <Icon name="database" size={21} />
    <div>
      <strong>
        {detail?.engine === 'PostgreSQL' ? 'pgAdmin' : 'phpMyAdmin'} · demo preview
      </strong>
      <p>
        {detail?.engine} / {detail?.database} · actual admin tool is not running in
        this preview.
      </p>
    </div>
  </div>
  <div class="card">
    <h3 class="section-title">Database explorer</h3>
    <div class="divider"></div>
    <div class="row space">
      <span class="mono small">{detail?.database}</span><Badge
        label="Connected (demo)"
        tone="success"
      />
    </div>
    <div class="divider"></div>
    {#each ['Tables', 'SQL editor', 'Import / Export', 'User accounts'] as item}<div
        class="host-row"
      >
        <span class="small">{item}</span><Badge
          label="Preview only"
          tone="info"
        />
      </div>{/each}
  </div>
  <div class="modal-footer" style="margin:20px -24px -24px">
    <button class="btn" onclick={() => (ui.modal = null)}>Close</button>
  </div>
{:else if kind === 'dbUser' && user}<div class="kv">
    <span class="k">Username</span><span class="v mono">
      {user.username}
    </span><span class="k">Database</span><span class="v mono">
      {detail?.database}
    </span><span class="k">Status</span><span class="v">
      <Badge
        label={user.revoked ? 'Revoked' : 'Active'}
        tone={user.revoked ? 'warning' : 'success'}
      />
    </span><span class="k">Privileges</span><span class="v">
      {user.privileges.length} permissions
    </span><span class="k">Password</span><span class="v mono">
      {show ? 'demo_not_real' : '••••••••••••'}
      <button class="btn btn-small" onclick={() => (show = !show)}>
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  </div>
  <div class="row" style="margin-top:18px;flex-wrap:wrap">
    <button class="btn btn-primary" onclick={() => (ui.modal = 'dbPrivileges')}>
      Edit privileges
    </button><button
      class="btn"
      onclick={() => notify('Demo password rotated. No real password changed.')}
    >
      Rotate password
    </button><button
      class="btn btn-danger"
      onclick={() => previewAction(() => (user.revoked = !user.revoked))}
    >
      {user.revoked ? 'Restore access' : 'Revoke access'}
    </button>
  </div>
{:else}<form onsubmit={submit}>
    {#if kind === 'variable'}<p class="muted small">
        {service?.name ?? 'Service'}
      </p>
      <div class="form-row">
        <label class="form-label" for="varKey">Variable name</label><input
          id="varKey"
          bind:value={name}
          required
          pattern="[a-zA-Z_][a-zA-Z0-9_]*"
          placeholder="DATABASE_URL"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="varValue">Value</label><input
          id="varValue"
          bind:value
          required
          type="password"
          placeholder="••••••••••••"
          autocomplete="new-password"
        />
      </div>
      <p class="hint">
        Use synthetic values only. This preview keeps them in memory until
        reload.
      </p>
      <FormFooter label="Save variable" />
    {:else if kind === 'dbExternal'}<p class="muted small">
        {service?.name ?? 'Database'} · Disabled by default
      </p>
      <div class="form-row">
        <label class="form-label" for="allowedIp">
          Allowed client IP (CIDR)
        </label><input
          id="allowedIp"
          bind:value={cidr}
          placeholder="198.51.100.20/32"
          required
        />
        <p class="hint">
          Example uses a documentation-only IP. Public wildcard ranges are
          rejected.
        </p>
      </div>
      <div class="notice">
        Public database exposure requires firewall rules, authentication, TLS
        and preferably a VPN/private tunnel.
      </div>
      <FormFooter label="Enable restricted access" />
    {:else if kind === 'dbUser'}<div class="form-row">
        <label class="form-label" for="dbUsername">Username</label><input
          id="dbUsername"
          bind:value={name}
          required
          pattern={'[A-Za-z][A-Za-z0-9_]{0,47}'}
          placeholder="application_reader"
          maxlength="48"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="dbPreset">Privileges</label><select
          id="dbPreset"
          bind:value={preset}
        >
          <option value="readonly">Read only (recommended)</option><option
            value="app"
          >
            Read and write
          </option><option value="full">Full access</option>
        </select>
        <p class="hint">
          You can customize individual privileges after creating the user.
        </p>
      </div>
      <div class="notice">
        A nonfunctional demo password is shown for this example. Production
        access must be scoped, audited and encrypted.
      </div>
      <FormFooter label="Create user" />
    {:else if kind === 'dbPrivileges' && user}<div class="row space">
        <div>
          <strong class="mono small">{user.username}</strong>
          <p class="muted xs">{detail?.engine} · {detail?.database}</p>
        </div>
        <Badge
          label={user.revoked ? 'Revoked' : 'Active'}
          tone={user.revoked ? 'warning' : 'success'}
        />
      </div>
      <div class="row" style="margin:16px 0">
        <button
          type="button"
          class="btn btn-small"
          onclick={() => (selected = [...privileges])}
        >
          Full access
        </button><button
          type="button"
          class="btn btn-small"
          onclick={() => (selected = ['SELECT'])}
        >
          Read only
        </button><button
          type="button"
          class="btn btn-small"
          onclick={() => (selected = [])}
        >
          Clear
        </button>
      </div>
      <div class="privilege-grid">
        {#each privileges as privilege}<label class="form-check privilege-item">
            <input
              type="checkbox"
              bind:group={selected}
              value={privilege}
            /><span>{privilege}</span>
          </label>{/each}
      </div>
      <p class="hint">
        {detail?.engine === 'PostgreSQL'
          ? 'PostgreSQL privileges differ from MySQL grants.'
          : 'MySQL privileges include table, routine and DDL operations.'} Settings
        remain a local demonstration.
      </p>
      <FormFooter label="Save privileges" />
    {:else if kind === 'apiKey'}<div class="form-row">
        <label class="form-label" for="apiKeyName">Key name</label><input
          id="apiKeyName"
          bind:value={name}
          required
          maxlength="50"
          placeholder="CI deployment automation"
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="apiScope">Access scope</label><select
          id="apiScope"
          bind:value={scope}
        >
          <option value="projects:read">Read projects</option><option
            value="deployments:write"
          >
            Create deployments
          </option><option value="domains:read">Read domains</option>
        </select>
      </div>
      <div class="notice">
        The generated key is fake and valid nowhere. A real implementation would
        hash keys at rest and require authentication and expiration policies.
      </div>
      <FormFooter label="Create demo key" />{/if}{#if error}<p
        class="form-error"
        role="alert"
      >
        {error}
      </p>{/if}
  </form>{/if}
