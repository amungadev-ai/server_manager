<script lang="ts">
  import { ui, openDialog } from '#lib/stores/ui.svelte.ts';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';
  import HttpProjectForm from '#lib/features/HttpProjectForm.svelte';
  import ResourceForm from '#lib/features/ResourceForm.svelte';
  import DomainForm from '#lib/features/DomainForm.svelte';
  import StorageForm from '#lib/features/StorageForm.svelte';
  import AccountDialog from '#lib/features/AccountDialog.svelte';
  const titles: Record<string, [string, string]> = {
    create: [
      'Create something new',
      'Choose what you want to run on your infrastructure.',
    ],
    project: [
      'Create project',
      'A project groups environments, applications and services.',
    ],
    application: [
      'Deploy application',
      'Use a ZIP archive or a GitHub repository.',
    ],
    database: [
      'Provision database',
      'Create a standalone database for any application.',
    ],
    cron: [
      'Create cron job',
      'Schedule an HTTP callback independently of your app.',
    ],
    storage: [
      'Create object storage',
      'Scoped resource management · simulation',
    ],
    domain: [
      'Add domain',
      'Enter your domain now. Configure DNS afterward under Manage → Settings.',
    ],
    domainAttach: [
      'Connect registered domain',
      'Choose an available hostname from your verified domains.',
    ],
    subdomain: ['Create subdomain', 'Add a new hostname to this domain.'],
    dnsRecord: [
      'DNS record',
      'Edit simulated DNS records in the central registry.',
    ],
    verifyZone: [
      'Verify domain ownership',
      'Simulate ownership verification after configuring your DNS provider.',
    ],
    dnsModeChange: [
      'Change DNS management',
      'Review a safe transition before changing the current mode.',
    ],
    deleteZone: [
      'Remove domain',
      'Remove this simulated domain and its resources.',
    ],
    mailbox: [
      'Create mailbox',
      'Provision a simulated email account for this domain.',
    ],
    mailAlias: [
      'Create email alias',
      'Forward email from an alias to an existing mailbox.',
    ],
    inbox: [
      'Demo webmail',
      'Preview a sample inbox without sending or receiving real mail.',
    ],
    variable: [
      'Add environment variable',
      'Secure configuration belongs to an individual service.',
    ],
    dbExternal: [
      'Database network access',
      'Restrict which external addresses can connect.',
    ],
    dbAdmin: [
      'Database administration',
      'Explore an administration preview for this database.',
    ],
    dbUser: [
      'Add database user',
      'Create a dedicated user with scoped privileges.',
    ],
    dbPrivileges: [
      'User privileges',
      'Choose what this database user is allowed to do.',
    ],
    apiKey: [
      'Generate demo API key',
      'Design preview: scope and revoke an external automation credential.',
    ],
    reset: [
      'Reset prototype data',
      'Restore the sample workspace and remove local changes.',
    ],
    bucketCreate: [
      'Create storage bucket',
      'Scoped resource management · simulation',
    ],
    storageFolder: [
      'Create virtual folder',
      'Scoped resource management · simulation',
    ],
    objectUpload: [
      'Upload file (demo)',
      'Scoped resource management · simulation',
    ],
    storageGrant: [
      'Grant bucket access',
      'Scoped resource management · simulation',
    ],
    volumeCreate: [
      'Allocate persistent volume',
      'Scoped resource management · simulation',
    ],
    objectDetails: [
      'Object details',
      'Scoped resource management · simulation',
    ],
  };
  const choices = [
    [
      'application',
      'rocket',
      'Application',
      'Websites, APIs and workers',
      'mint',
    ],
    ['database', 'database', 'Database', 'PostgreSQL, MySQL, MariaDB', 'mint'],
    ['cron', 'clock', 'Cron Job', 'Scheduled HTTPS callbacks', 'gold'],
    [
      'storage',
      'bucket',
      'Object Storage',
      'Private buckets and media files',
      'gold',
    ],
  ];
  const title = $derived(
    ui.modal === 'dbUser' && ui.modalData.id
      ? 'Manage database user'
      : (titles[ui.modal ?? '']?.[0] ?? ''),
  );
</script>

<Dialog
  open={ui.modal !== null}
  {title}
  description={titles[ui.modal ?? '']?.[1] ?? ''}
  wide={ui.modal === 'application' || ui.modal === 'dbPrivileges'}
  closeIconSize={ui.modal === 'dnsModeChange'
    ? 17
    : [
          'storage',
          'bucketCreate',
          'storageFolder',
          'objectUpload',
          'storageGrant',
          'volumeCreate',
          'objectDetails',
          'apiKey',
        ].includes(ui.modal ?? '')
      ? 16
      : 18}
  closeDisabled={ui.modalBusy}
  onclose={() => {
    if (!ui.modalBusy) ui.modal = null;
  }}
>
  {#key `${ui.modal}:${JSON.stringify(ui.modalData)}`}{#if ui.modal === 'create'}<div
        class="tile-options"
      >
        {#each choices as [kind, icon, label, description, tone]}<button
            class="tile-option"
            onclick={() => openDialog(kind, ui.modalData)}
          >
            <span class="status-icon {tone}">
              <Icon name={icon} size={20} />
            </span><span>
              <strong>{label}</strong><br /><span>{description}</span>
            </span><Icon name="chevron" size={14} />
          </button>{/each}
      </div>
      <p class="hint" style="margin-top:19px">
        Mobile app build and distribution features are intentionally deferred to
        a later phase.
      </p>
    {:else if ui.modal === 'project' && infrastructure.mode === 'http'}<HttpProjectForm
      />
    {:else if ui.modal && ['project', 'application', 'database', 'cron', 'storage'].includes(ui.modal)}<ResourceForm
        kind={ui.modal}
      />
    {:else if ui.modal && ['domain', 'domainAttach', 'subdomain', 'dnsRecord', 'verifyZone', 'dnsModeChange', 'deleteZone', 'mailbox', 'mailAlias'].includes(ui.modal)}<DomainForm
        kind={ui.modal}
      />
    {:else if ui.modal && ['bucketCreate', 'storageFolder', 'objectUpload', 'storageGrant', 'volumeCreate', 'objectDetails'].includes(ui.modal)}<StorageForm
        kind={ui.modal}
      />
    {:else if ui.modal}<AccountDialog kind={ui.modal} />{/if}{/key}
  {#if infrastructure.mode !== 'demo' && ui.modal !== 'create' && ui.modal !== 'project'}<p
      class="hint"
    >
      This operation requires the connected Cloudlane API. No changes can be
      applied here.
    </p>{/if}
</Dialog>
