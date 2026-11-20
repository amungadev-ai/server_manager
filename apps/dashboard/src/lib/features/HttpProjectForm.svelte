<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { HttpProjectApi, ProjectMutationError } from '#lib/api/projects.ts';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui, notify } from '#lib/stores/ui.svelte.ts';
  import FormFooter from '#lib/components/FormFooter.svelte';
  let name = $state(''),
    error = $state(''),
    busy = $state(false),
    ambiguous = $state(false);
  let api: HttpProjectApi | undefined,
    retryKey = '',
    submittedName = '',
    alive = true;
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = '';
    if (!name.trim()) {
      error = 'Enter the project name.';
      return;
    }
    busy = true;
    ui.modalBusy = true;
    try {
      api ??= new HttpProjectApi();
      if (!retryKey || (!ambiguous && name.trim() !== submittedName)) {
        retryKey = crypto.randomUUID();
        submittedName = name.trim();
      }
      const result = await api.create({ name: submittedName }, retryKey);
      if (!alive) return;
      const project = {
        id: result.project.id,
        name: result.project.name,
        description: result.project.description,
        createdAt: result.project.createdAt,
        updatedLabel: 'just now',
      };
      if (
        infrastructure.data &&
        !infrastructure.data.projects.some((p) => p.id === project.id)
      )
        infrastructure.data.projects.push(project);
      busy = false;
      ui.modalBusy = false;
      ui.modal = null;
      notify('Project and production environment created.');
      await goto('/projects/' + result.project.id);
    } catch (cause) {
      if (!alive) return;
      ambiguous = cause instanceof ProjectMutationError && cause.ambiguous;
      error = ambiguous
        ? 'The project may have been created, but its result could not be confirmed. Retry this same request to confirm it.'
        : cause instanceof Error
          ? cause.message
          : 'Unable to create this project.';
      await tick();
      document.getElementById('project-create-error')?.focus();
    } finally {
      if (alive) {
        busy = false;
        ui.modalBusy = false;
      }
    }
  }
  onDestroy(() => {
    alive = false;
    api?.dispose();
    ui.modalBusy = false;
    retryKey = '';
    submittedName = '';
  });
</script>

<form onsubmit={submit} aria-busy={busy}>
  <div class="form-row">
    <label class="form-label" for="resourceName">Project name</label><input
      id="resourceName"
      bind:value={name}
      required
      maxlength="62"
      placeholder="e.g. My delivery app"
      disabled={busy || ambiguous}
    />
    <p class="hint">Creates a production environment automatically.</p>
  </div>
  {#if error}<p
      id="project-create-error"
      class="form-error"
      role="alert"
      tabindex="-1"
    >
      {error}
    </p>{/if}
  {#if ambiguous}<p class="hint">
      If you close this form, refresh projects before creating another.
    </p>{/if}
  <FormFooter
    label={busy ? 'Creating…' : ambiguous ? 'Retry creation' : 'Create project'}
    icon="arrow"
    httpEnabled
    disabled={busy}
    {busy}
  />
</form>

<style>
  .hint,
  input::placeholder {
    color: var(--text);
    opacity: 1;
  }
</style>
