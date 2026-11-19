<script lang="ts">
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import ProjectCard from '#lib/components/ProjectCard.svelte';
  import Icon from '#lib/components/Icon.svelte';
  let search = $state('');
  const projects = $derived(
    infrastructure.data?.projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase().trim()),
    ) ?? [],
  );
</script>

<svelte:head><title>Projects — Cloudlane</title></svelte:head>
<PageHeading
  title="Projects"
  eyebrow="WORKSPACE"
  description="Organize applications and infrastructure in environments."
>
  {#snippet actions()}<button
      class="btn btn-primary"
      onclick={() => openDialog('project')}
    >
      <Icon name="plus" size={15} /> New project
    </button>{/snippet}
</PageHeading>
<div class="row space" style="margin-bottom:18px">
  <div class="search">
    <Icon name="search" size={15} /><input
      bind:value={search}
      placeholder="Search projects..."
      aria-label="Search projects"
    />
  </div>
  <div class="muted xs">
    {projects.length} project{projects.length !== 1 ? 's' : ''}
  </div>
</div>
<div class="grid three">
  {#each projects as project}<ProjectCard
      {project}
      services={infrastructure.data?.services ?? []}
    />{:else}<div class="card empty">
      <h3>No projects found</h3>
      <p>Create a project to get started.</p>
    </div>{/each}
</div>
