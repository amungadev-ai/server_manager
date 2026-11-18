<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let {
    open,
    title,
    onclose,
    children,
  }: { open: boolean; title: string; onclose: () => void; children: Snippet } =
    $props();
  let element: HTMLDialogElement;
  $effect(() => {
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  });
</script>

<dialog
  bind:this={element}
  aria-labelledby="dialog-title"
  {onclose}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  <div class="dialog-heading">
    <h2 id="dialog-title">{title}</h2>
    <button class="icon-button" onclick={onclose} aria-label="Close dialog">
      <Icon name="close" />
    </button>
  </div>
  <div class="dialog-body">{@render children()}</div>
</dialog>
