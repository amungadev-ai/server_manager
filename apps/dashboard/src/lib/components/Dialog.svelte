<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let {
    open,
    title,
    description = '',
    wide = false,
    closeIconSize = 18,
    closeDisabled = false,
    onclose,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    description?: string;
    wide?: boolean;
    closeIconSize?: number;
    closeDisabled?: boolean;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  } = $props();
  let element: HTMLDialogElement;
  $effect(() => {
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  });
</script>

<dialog
  class="modal"
  class:wide
  bind:this={element}
  aria-labelledby="dialog-title"
  {onclose}
  oncancel={(event) => {
    event.preventDefault();
    if (!closeDisabled) onclose();
  }}
  onclick={(event) => {
    if (event.target !== element) return;
    const rect = element.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      if (!closeDisabled) onclose();
  }}
>
  <div class="modal-head">
    <div>
      <h2 id="dialog-title">{title}</h2>
      {#if description}<p>{description}</p>{/if}
    </div>
    <button
      class="icon-btn"
      disabled={closeDisabled}
      onclick={onclose}
      aria-label="Close dialog"
    >
      <Icon name="close" size={closeIconSize} />
    </button>
  </div>
  <div class="modal-body">{@render children()}</div>
  {#if footer}<div class="modal-footer">{@render footer()}</div>{/if}
</dialog>
