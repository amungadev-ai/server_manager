<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import ActivityList from '#lib/features/ActivityList.svelte';
  import Icon from '#lib/components/Icon.svelte';
</script>

<svelte:head><title>Activity & Logs — Cloudlane</title></svelte:head>
<PageHeading
  title="Activity & Logs"
  eyebrow="Workspace history"
  description="A clear view of what happened across your infrastructure."
/>
<p class="notice" style="margin-bottom:20px">
  <Icon name="info" size={17} /><span>
    These entries are synthetic examples for the design preview. Real operation
    events and audit logs are not connected.
  </span>
</p>
<section class="card">
  <h2>Recent activity</h2>
  <ActivityList items={infrastructure.data?.activity ?? []} />
</section>
