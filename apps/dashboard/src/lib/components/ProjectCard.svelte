<script lang="ts">
  import type { Project, Service } from '@cloudlane/contracts/preview';
  import Icon from './Icon.svelte';
  let { project, services }: { project: Project; services: Service[] } =
    $props();
  const own = $derived(services.filter((s) => s.projectId === project.id));
  const healthy = $derived(
    own.length > 0 &&
      own.every((s) => s.status === 'running' || s.status === 'active'),
  );
  const failed = $derived(own.some((s) => s.status === 'failed'));
  const healthLabel = $derived(
    own.length === 0
      ? 'No services'
      : failed
        ? 'Needs attention'
        : healthy
          ? 'Healthy'
          : 'Inactive',
  );
</script>

<a class="project-card card" href="/projects/{project.id}">
  <span class="project-mark"><Icon name="folder" size={19} /></span>
  <div class="project-copy">
    <h3>{project.name}</h3>
    <p>{project.description}</p>
    <div class="project-meta">
      <span>{own.length} services</span><span
        class="healthy-label"
        style:color={healthy
          ? 'var(--success)'
          : failed
            ? 'var(--danger)'
            : 'var(--muted)'}
      >
        <span class="status-dot"></span>{healthLabel}
      </span>
    </div>
  </div>
  <span class="card-chevron"><Icon name="chevron" size={15} /></span>
</a>
