<script lang="ts">
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Badge from '#lib/components/Badge.svelte';
  import ActivityList from '#lib/features/ActivityList.svelte';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
</script>

<svelte:head><title>Activity &amp; Logs — Cloudlane</title></svelte:head>
<PageHeading
  title="Activity"
  eyebrow="AUDIT & EVENTS"
  description="Operations across deployments, infrastructure, and user actions."
/>
<div class="card">
  <div class="row space" style="margin-bottom:12px">
    <h3 class="section-title">Recent events</h3>
    <Badge
      label={`${infrastructure.data?.activity.length ?? 0} events`}
      tone="info"
    />
  </div>
  <ActivityList items={infrastructure.data?.activity ?? []} />
</div>
