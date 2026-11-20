<script lang="ts">
  import { onMount } from 'svelte';
  import { HttpProjectApi } from '#lib/api/projects.ts';
  import type { z } from 'zod';
  import type { ProjectRecordSchema } from '@cloudlane/contracts/api';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { openDialog } from '#lib/stores/ui.svelte.ts';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import ProjectCard from '#lib/components/ProjectCard.svelte';
  import Icon from '#lib/components/Icon.svelte';
  let search = $state('');
  let httpItems = $state<z.infer<typeof ProjectRecordSchema>[]>([]),
    loading = $state(false),
    listError = $state(''),
    nextCursor = $state<string | null>(null);
  let api: HttpProjectApi | undefined;
  const seen = new Set<string>();
  let alive = true;
  async function loadMore() {
    if (loading) return;
    loading = true;
    listError = '';
    try {
      api ??= new HttpProjectApi();
      const result = await api.list({
        limit: 20,
        ...(nextCursor ? { cursor: nextCursor } : {}),
      });
      if (!alive) return;
      if (
        result.items.some((p) => httpItems.some((old) => old.id === p.id)) ||
        (result.nextCursor && seen.has(result.nextCursor))
      )
        throw new Error(
          'The project list could not be verified. Reload it before continuing.',
        );
      httpItems.push(...result.items);
      nextCursor = result.nextCursor;
      if (nextCursor) seen.add(nextCursor);
    } catch (cause) {
      if (alive)
        listError =
          cause instanceof Error ? cause.message : 'Unable to load projects.';
    } finally {
      if (alive) loading = false;
    }
  }
  onMount(() => {
    if (infrastructure.mode === 'http') void loadMore();
    return () => {
      alive = false;
      api?.dispose();
    };
  });
  const projects = $derived(
    (infrastructure.mode === 'demo'
      ? (infrastructure.data?.projects ?? [])
      : httpItems.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          createdAt: p.createdAt,
          updatedLabel: new Date(p.updatedAt).toLocaleDateString('en-GB', {
            timeZone: 'Africa/Nairobi',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        }))
    ).filter((p) => p.name.toLowerCase().includes(search.toLowerCase().trim())),
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
{#if listError}<p class="form-error" role="alert">{listError}</p>
  <button class="btn" onclick={loadMore}>Retry loading projects</button>{/if}
{#if loading && !httpItems.length}<p role="status">
    Loading projects…
  </p>{:else if !listError || httpItems.length > 0}
  <div class="grid three">
    {#each projects as project}<ProjectCard
        {project}
        services={infrastructure.data?.services ?? []}
      />{:else}<div class="card empty">
        <h3>No projects found</h3>
        <p>Create a project to get started.</p>
      </div>{/each}
  </div>
{/if}
{#if infrastructure.mode === 'http' && nextCursor}<button
    class="btn"
    disabled={loading}
    onclick={loadMore}
  >
    {loading ? 'Loading…' : 'Load more projects'}
  </button>{/if}

{#if infrastructure.mode === 'http' && nextCursor}<p class="hint">
    Search covers loaded projects. Load more to include additional projects.
  </p>{/if}
