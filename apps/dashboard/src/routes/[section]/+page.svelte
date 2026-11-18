<script lang="ts">
  import { page } from '$app/state';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  const sections: Record<
    string,
    { title: string; icon: string; description: string; detail: string }
  > = {
    databases: {
      title: 'Databases',
      icon: 'database',
      description: 'Private databases, scoped to your services.',
      detail:
        'Database provisioning, users, privileges and backups will be connected after the deployment agent and persistent API are implemented.',
    },
    email: {
      title: 'Email',
      icon: 'mail',
      description: 'Your mailboxes, across every domain.',
      detail:
        'External provider integrations and domain-scoped mailboxes are planned. No mail provider is connected.',
    },
    'cron-jobs': {
      title: 'Cron Jobs',
      icon: 'clock',
      description: 'Reliable schedules for your background work.',
      detail:
        'Durable scheduling, timezones, retries and run history will be available when the real job queue is connected.',
    },
    server: {
      title: 'Server',
      icon: 'server',
      description: 'A clear view of the machine behind your services.',
      detail:
        'No VPS is connected. Live metrics, installation health and SSH guidance will be provided by the restricted server agent.',
    },
  };
  const section = $derived(sections[page.params.section ?? '']);
</script>

<svelte:head>
  <title>{section?.title ?? 'Page not found'} — Cloudlane</title>
</svelte:head>
{#if section}<PageHeading
    title={section.title}
    eyebrow="Infrastructure resources"
    description={section.description}
  />
  <section class="card empty-state">
    <span class="empty-icon"><Icon name={section.icon} size={27} /></span>
    <h2>{section.title}, in one place.</h2>
    <p>{section.detail}</p>
    <Badge label="Not available yet" />
  </section>{:else}<div class="card empty-state">
    <h1>Page not found</h1>
    <p>This page is not available in your workspace.</p>
    <a href="/" class="button">Back to overview</a>
  </div>{/if}
