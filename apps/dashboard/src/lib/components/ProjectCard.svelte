<script lang="ts">
  import type { Project, Service } from '@cloudlane/contracts/preview';
  import { serviceStatus } from '#lib/presentation.ts';
  import Icon from './Icon.svelte';
  let { project, services }: { project: Project; services: Service[] } =
    $props();
  const own = $derived(
    services.filter((service) => service.projectId === project.id),
  );
  const healthy = $derived(
    own.filter((service) =>
      ['running', 'active'].includes(serviceStatus(service)),
    ).length,
  );
</script>

<a
  class="card project-card clickable"
  href="/projects/{project.id}"
  aria-label="Open {project.name} project"
>
  <span class="project-mark"><Icon name="folder" size={18} /></span>
  <div class="project-copy">
    <h3>{project.name}</h3>
    <div class="project-desc">
      {own.length} service{own.length === 1 ? '' : 's'}
      <span class="project-meta-separator">·</span>
      <span class="project-health">
        <span class="project-health-dot" class:is-healthy={healthy > 0}
        ></span>{healthy} healthy
      </span>
    </div>
  </div>
  <div class="project-tail">
    <span class="project-env">production</span><span class="project-age">
      {project.updatedLabel}
    </span>
  </div>
  <span class="project-open" aria-hidden="true">
    <Icon name="arrow" size={15} />
  </span>
</a>
