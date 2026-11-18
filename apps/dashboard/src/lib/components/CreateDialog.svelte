<script lang="ts">
  import { ui } from '#lib/stores/ui.svelte.ts';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';
  const titles = {
    create: 'Create new',
    project: 'New project',
    domain: 'Add domain',
    application: 'Deploy an application',
    database: 'Create database',
    cron: 'Schedule a cron job',
    storage: 'Connect object storage',
    assistant: 'Cloudlane Assistant',
  };
  let name = $state('');
  const choices = [
    {
      kind: 'application',
      icon: 'rocket',
      label: 'Application',
      description: 'Deploy from ZIP or GitHub',
    },
    {
      kind: 'database',
      icon: 'database',
      label: 'Database',
      description: 'Private, project-scoped data',
    },
    {
      kind: 'cron',
      icon: 'clock',
      label: 'Cron job',
      description: 'Scheduled HTTP callbacks or tasks',
    },
    {
      kind: 'storage',
      icon: 'storage',
      label: 'Object storage',
      description: 'An external S3-compatible provider',
    },
  ] as const;
</script>

<Dialog
  open={ui.modal !== null}
  title={ui.modal ? titles[ui.modal] : ''}
  onclose={() => {
    ui.modal = null;
    name = '';
  }}
>
  {#if ui.modal === 'create'}
    <p class="muted dialog-intro">Choose a resource for your project.</p>
    <div class="create-options">
      {#each choices as choice}<button
          class="create-option"
          onclick={() => (ui.modal = choice.kind)}
        >
          <span class="resource-icon"><Icon name={choice.icon} /></span><span>
            <strong>{choice.label}</strong><small>{choice.description}</small>
          </span><Icon name="chevron" size={16} />
        </button>{/each}
    </div>
  {:else if ui.modal === 'domain' || ui.modal === 'project'}
    <p class="muted dialog-intro">
      {ui.modal === 'domain'
        ? 'Register a domain once, then connect it to your services.'
        : 'A shared home for your applications, databases and services.'}
    </p>
    <label class="field">
      {ui.modal === 'domain' ? 'Domain name' : 'Project name'}<input
        bind:value={name}
        placeholder={ui.modal === 'domain' ? 'example.com' : 'My project'}
        autocomplete="off"
      />
    </label>
    <p class="notice">
      <Icon name="info" size={17} /><span>
        {ui.modal === 'domain'
          ? 'Domains start with Manual DNS. DNS mode lives in domain Settings. Domain registration will be available when the API is connected.'
          : 'Project creation will be available after owner authentication and persistent storage are connected.'}
      </span>
    </p>
    <div class="dialog-footer">
      <button class="button" onclick={() => (ui.modal = null)}>
        Cancel
      </button><button class="button primary" disabled>
        {ui.modal === 'domain' ? 'Add domain' : 'Create project'}
      </button>
    </div>
  {:else if ui.modal === 'assistant'}
    <div class="empty-icon"><Icon name="sparkles" size={25} /></div>
    <h3 class="center">A little guidance, right here.</h3>
    <p class="muted center">
      Contextual diagnosis and approval-based infrastructure plans are planned.
      The Assistant is not connected in this foundation build.
    </p>
  {:else}
    <div class="notice">
      <Icon name="info" size={19} /><span>
        This resource is not available in the foundation build. It will use the
        real API and deployment engine once they are implemented.
      </span>
    </div>
    <p class="muted">
      You can explore the sample projects and domain screens while the platform
      foundation is being built.
    </p>
    <div class="dialog-footer">
      <button class="button" onclick={() => (ui.modal = 'create')}>
        Back to resources
      </button><button class="button primary" onclick={() => (ui.modal = null)}>
        Got it
      </button>
    </div>
  {/if}
</Dialog>
