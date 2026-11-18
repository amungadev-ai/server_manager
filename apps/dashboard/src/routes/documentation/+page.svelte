<script lang="ts">
  import PageHeading from '#lib/components/PageHeading.svelte';
</script>

<svelte:head><title>Documentation — Cloudlane</title></svelte:head>
<PageHeading
  title="Documentation"
  eyebrow="Built to be approachable"
  description="The first steps toward your Cloudlane workspace."
/>
<div class="documentation-list">
  <section class="card">
    <h2>This foundation build</h2>
    <p>
      The SvelteKit dashboard is compiled to static assets. This design preview
      uses read-only, synthetic examples. No VPS, database, DNS provider or
      deployment engine is connected.
    </p>
  </section>
  <section class="card">
    <h2>Your workspace</h2>
    <p>
      Projects bring your applications, databases, scheduled jobs and storage
      together. Domains are registered globally and connected to services. A
      project starts with a production environment.
    </p>
  </section>
  <section class="card">
    <h2>Implementation roadmap</h2>
    <p>
      The source repository includes the full guide under <code>docs/</code>,
      the task backlog at <code>tasks/BACKLOG.md</code>, and exact resumption
      instructions at <code>tasks/progress/CL-001.md</code>.
    </p>
  </section>
  <section class="card">
    <h2>Next platform milestones</h2>
    <p>
      Typed API contracts and a reviewed security model come before PostgreSQL
      migrations, secure owner setup and session authentication. Real static ZIP
      deployment follows the installer and restricted Go agent.
    </p>
  </section>
</div>
