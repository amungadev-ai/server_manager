<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import Badge from '#lib/components/Badge.svelte';
  const domain = (id: string) =>
    infrastructure.data?.domains.find((z) => z.id === id);
</script>

<div class="row space" style="margin-bottom:14px">
  <h3 class="section-title">All mailboxes</h3>
  <a class="btn" href="/domains">Manage domains</a>
</div>
<div class="card table-frame">
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Email address</th><th>Domain</th><th>Quota</th><th>Status</th><th>
            Actions
          </th>
        </tr>
      </thead><tbody>
        {#each infrastructure.preview?.mailboxes ?? [] as mailbox}<tr>
            <td class="main-cell mono">
              {mailbox.local}@{domain(mailbox.zoneId)?.name}
            </td><td>{domain(mailbox.zoneId)?.name}</td><td>
              {mailbox.quota} MB
            </td><td><Badge label="Demo active" tone="success" /></td><td>
              <div class="row">
                <button
                  class="btn btn-small"
                  onclick={() => openDialog('inbox', { id: mailbox.id })}
                >
                  Open inbox
                </button><a
                  class="btn btn-small"
                  href="/domains/{mailbox.zoneId}?tab=email"
                >
                  Manage domain
                </a>
              </div>
            </td>
          </tr>{:else}<tr>
            <td colspan="5">
              <div class="empty">
                <h3>No mailboxes yet</h3>
                <p>Add a mailbox under a registered domain.</p>
              </div>
            </td>
          </tr>{/each}
      </tbody>
    </table>
  </div>
</div>
<div class="section-head"><h2 class="section-title">Aliases</h2></div>
<div class="card table-frame">
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Alias</th><th>Forwards to</th><th>Domain</th><th>Manage</th>
        </tr>
      </thead><tbody>
        {#each infrastructure.preview?.aliases ?? [] as alias}<tr>
            <td class="mono main-cell">
              {alias.local}@{domain(alias.zoneId)?.name}
            </td><td class="mono xs">{alias.target}</td><td>
              {domain(alias.zoneId)?.name}
            </td><td>
              <a class="btn btn-small" href="/domains/{alias.zoneId}?tab=email">
                Manage
              </a>
            </td>
          </tr>{:else}<tr>
            <td colspan="4" class="muted">No aliases configured yet.</td>
          </tr>{/each}
      </tbody>
    </table>
  </div>
</div>
