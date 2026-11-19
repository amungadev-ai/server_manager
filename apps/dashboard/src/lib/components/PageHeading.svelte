<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    title,
    eyebrow,
    description,
    actions,
  }: {
    title: string;
    eyebrow: string;
    description: string;
    actions?: Snippet;
  } = $props();
</script>

<div class="heading">
  <div>
    <p class="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p class="subtitle">{description}</p>
  </div>
  <div class="head-actions">
    {#if actions}{@render actions()}{/if}
  </div>
</div>
