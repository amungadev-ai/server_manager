<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import ProjectCard from '#lib/components/ProjectCard.svelte';
  import Icon from '#lib/components/Icon.svelte';
  let search = $state('');
  const data = $derived(infrastructure.data);
  const projects = $derived(
    data?.projects.filter((project) =>
      project.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [],
  );
</script>

<svelte:head><title>Projects — Cloudlane</title></svelte:head>
<PageHeading
  title="Projects"
  eyebrow="Your workspace"
  description="One home for your applications, data and everything in between."
>
  {#snippet actions()}<button
      class="button primary"
      onclick={() => (ui.modal = 'project')}
    >
      <Icon name="plus" size={16} />New project
    </button>{/snippet}
</PageHeading>
<div class="toolbar">
  <label class="search-field">
    <Icon name="search" size={16} /><input
      bind:value={search}
      placeholder="Search projects…"
      aria-label="Search projects"
    />
  </label><span class="result-count">{projects.length} projects</span>
</div>
<div class="grid-three">
  {#each projects as project}<ProjectCard
      {project}
      services={data?.services ?? []}
    />{:else}<p class="empty-result">No projects match “{search}”.</p>{/each}
</div>
