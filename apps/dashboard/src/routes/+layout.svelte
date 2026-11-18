<script lang="ts">
  import '@fontsource/inter/400.css';
  import '@fontsource/inter/500.css';
  import '@fontsource/inter/600.css';
  import '@fontsource/inter/700.css';
  import '@fontsource/jetbrains-mono/400.css';
  import '../app.css';
  import AppShell from '#lib/components/AppShell.svelte';
  let { children } = $props();
</script>

<svelte:head>
  <title>Cloudlane — Your infrastructure, simplified</title><meta
    name="description"
    content="The Cloudlane dashboard foundation. A unified workspace for projects, services and infrastructure."
  />
</svelte:head>
<AppShell>{@render children()}</AppShell>
