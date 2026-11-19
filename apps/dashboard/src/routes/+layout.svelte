<script lang="ts">
  import '@fontsource/inter/latin-400.css';
  import '@fontsource/inter/latin-500.css';
  import '@fontsource/inter/latin-600.css';
  import '@fontsource/inter/latin-700.css';
  import '@fontsource/jetbrains-mono/latin-400.css';
  import '@fontsource/jetbrains-mono/latin-500.css';
  import '../app.css';
  import '../prototype.css';
  import { page } from '$app/state';
  const authRoute = $derived(
    ['/setup', '/login', '/recover', '/auth/security'].includes(
      page.url.pathname.replace(/\/$/, ''),
    ),
  );
  import AppShell from '#lib/components/AppShell.svelte';
  let { children } = $props();
</script>

<svelte:head>
  <title>Cloudlane — Your infrastructure, simplified</title><meta
    name="description"
    content="Cloudlane — your projects, services and infrastructure in one workspace."
  />
</svelte:head>
{#if authRoute}{@render children()}{:else}<AppShell>
    {@render children()}
  </AppShell>{/if}
