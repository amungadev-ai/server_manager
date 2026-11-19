<script lang="ts">
  import type { Service } from '@cloudlane/contracts/preview';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog, copyText, notify } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import { serviceDetail, formatDate } from '#lib/presentation.ts';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import StatusBadge from '#lib/components/StatusBadge.svelte';
  import SqlConsole from './SqlConsole.svelte';
  let { service, tab }: { service: Service; tab: string } = $props();
  const detail = $derived(serviceDetail(service));
  let show = $state(false);
  const host = $derived(
    detail?.external ? 'db.example.test' : 'delivery-db.internal',
  );
  const port = $derived(detail?.engine === 'PostgreSQL' ? '5432' : '3306');
  const user = $derived(service.name.replace(/[^a-z0-9]/gi, '_'));
  const url = $derived(
    `${detail?.engine === 'PostgreSQL' ? 'postgresql' : 'mysql'}://${user}:demo_not_real@${host}:${port}/${detail?.database ?? 'demo'}${detail?.engine === 'PostgreSQL' ? '?sslmode=require' : ''}`,
  );
  let backups = $state<{ id: string; created: string; status: string }[]>([]);
</script>

{#if tab === 'overview' || tab === 'connections'}
  <div class="grid two-wide">
    <div class="card">
      <div class="row space">
        <h3 class="section-title">Connection details</h3>
        <Badge
          label={detail?.external ? 'Restricted external' : 'Private only'}
          tone={detail?.external ? 'warning' : 'success'}
        />
      </div>
      <p class="muted small">
        Demo credentials. No actual database server is provisioned.
      </p>
      <div class="kv" style="margin-top:10px">
        <span class="k">Database</span><span class="v mono">
          {detail?.database ?? 'Not reported'}
        </span><span class="k">Engine</span><span class="v">
          {detail?.engine ?? service.framework}
          {detail?.version ?? ''}
        </span><span class="k">Host</span><span class="v mono">
          {detail ? host : 'Not reported'}
        </span><span class="k">Port</span><span class="v mono">
          {detail ? port : '—'}
        </span><span class="k">Username</span><span class="v mono">
          {detail ? user : '—'}
        </span><span class="k">Password</span><span class="v mono">
          {show ? 'demo_not_real' : '••••••••••••'}
          <button
            class="link"
            aria-label={show ? 'Hide demo password' : 'Show demo password'}
            onclick={() => (show = !show)}
          >
            <Icon name={show ? 'eyeoff' : 'eye'} size={14} />
          </button>
        </span>
      </div>
      <div class="divider"></div>
      <div class="row space">
        <h3 class="section-title">Connection string</h3>
        <button class="btn btn-small" onclick={() => copyText(url)}>
          <Icon name="copy" size={14} /> Copy
        </button>
      </div>
      <div class="codebox" style="max-height:94px;word-break:break-all">
        {detail
          ? show
            ? url
            : url.replace('demo_not_real', '••••••••')
          : 'No connection details reported.'}
      </div>
    </div>
    <div class="col" style="gap:16px">
      <div class="card">
        <h3 class="section-title">Network access</h3>
        <p class="muted small">External connections are disabled by default.</p>
        <div class="row space" style="margin-top:13px">
          <span class="muted small">External access</span><Badge
            label={detail?.external ? 'Enabled' : 'Disabled'}
            tone={detail?.external ? 'warning' : 'success'}
          />
        </div>
        {#if detail?.external}<div class="row space" style="margin-top:12px">
            <span class="muted small">Allowed source</span><span
              class="mono xs"
            >
              {detail.allowedIp}
            </span>
          </div>{/if}
        <div style="margin-top:16px">
          <button
            class="btn"
            onclick={() =>
              detail?.external
                ? previewAction(
                    (m) => (m.services[service.id].external = false),
                  )
                : openDialog('dbExternal', { service: service.id })}
          >
            {detail?.external
              ? 'Disable external access'
              : 'Configure external access'}
          </button>
        </div>
      </div>
      <div class="card">
        <h3 class="section-title">Safety</h3>
        <p class="muted small">
          Rotate demo credentials to preview how secret changes will be managed.
        </p>
        <div style="margin-top:12px">
          <button
            class="btn btn-small"
            onclick={() =>
              notify(
                'Demo password rotated. No real credential was generated or changed.',
              )}
          >
            <Icon name="refresh" size={14} /> Rotate demo password
          </button>
        </div>
      </div>
    </div>
  </div>
{:else if tab === 'console'}<SqlConsole {service} />
{:else if tab === 'users'}
  <div class="row space" style="margin-bottom:16px">
    <div>
      <h3 class="section-title">Database users</h3>
      <p class="muted xs">
        Manage individual database accounts and privileges. All actions are
        simulated.
      </p>
    </div>
    <button
      class="btn btn-primary"
      onclick={() => openDialog('dbUser', { service: service.id })}
    >
      <Icon name="plus" size={15} /> Add user
    </button>
  </div>
  <div class="card table-frame">
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>User</th><th>Access</th><th>Privileges</th><th>Actions</th>
          </tr>
        </thead><tbody>
          {#each infrastructure.preview?.dbUsers.filter((u) => u.serviceId === service.id) ?? [] as dbUser}<tr>
              <td class="mono main-cell">{dbUser.username}</td><td>
                <Badge
                  label={dbUser.revoked ? 'Revoked' : 'Active'}
                  tone={dbUser.revoked ? 'warning' : 'success'}
                />
              </td><td>
                <span class="muted small">
                  {dbUser.privileges.length} privileges
                </span>
              </td><td>
                <div class="row">
                  <button
                    class="btn btn-small"
                    onclick={() =>
                      openDialog('dbUser', {
                        service: service.id,
                        id: dbUser.id,
                      })}
                  >
                    Manage
                  </button><button
                    class="btn btn-small"
                    onclick={() =>
                      openDialog('dbPrivileges', {
                        service: service.id,
                        id: dbUser.id,
                      })}
                  >
                    Privileges
                  </button><button
                    class="btn btn-small"
                    onclick={() =>
                      previewAction(() => (dbUser.revoked = !dbUser.revoked))}
                  >
                    {dbUser.revoked ? 'Restore' : 'Revoke access'}
                  </button>
                </div>
              </td>
            </tr>{:else}<tr>
              <td colspan="4">
                <div class="empty">
                  <h3>No database users</h3>
                  <p>Add a user with only the permissions it needs.</p>
                </div>
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
  </div>
  <p class="hint" style="margin-top:14px">
    Privileges are scoped to this database. MySQL and PostgreSQL expose
    different privileges.
  </p>
{:else if tab === 'backups'}
  <div class="row space" style="margin-bottom:16px">
    <h3 class="section-title">Database backups</h3>
    <button
      class="btn btn-primary"
      onclick={() =>
        previewAction(
          () =>
            backups.unshift({
              id: previewId('backup'),
              created: new Date().toISOString(),
              status: 'success',
            }),
          'Simulated backup only. No data was copied.',
        )}
    >
      <Icon name="plus" size={15} /> Create backup
    </button>
  </div>
  <div class="card table-frame">
    <table class="table">
      <thead>
        <tr><th>Backup</th><th>Date</th><th>Type</th><th>Status</th></tr>
      </thead><tbody>
        {#each backups as backup}<tr>
            <td class="main-cell mono">{backup.id}</td><td>
              {formatDate(backup.created)}
            </td><td>Snapshot (simulated)</td><td>
              <StatusBadge status={backup.status} />
            </td>
          </tr>{:else}<tr>
            <td colspan="4">
              <div class="empty">
                <h3>No backups yet</h3>
                <p>Create a simulated backup to preview this workflow.</p>
              </div>
            </td>
          </tr>{/each}
      </tbody>
    </table>
  </div>
{:else}<div class="card">
    <h3 class="section-title">Database settings</h3>
    <div class="kv">
      <span class="k">Name</span><span class="v">{service.name}</span><span
        class="k"
      >
        Engine
      </span><span class="v">{detail?.engine ?? service.framework}</span><span
        class="k"
      >
        Environment
      </span><span class="v">production</span><span class="k">Status</span><span
        class="v"
      >
        <StatusBadge status={service.status} />
      </span>
    </div>
    <div class="notice" style="margin-top:15px">
      Production requirements: isolated database users, network allowlists, TLS,
      off-server backups, restore testing and storage monitoring.
    </div>
  </div>{/if}
