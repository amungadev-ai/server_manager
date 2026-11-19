<script lang="ts">
  import { ui } from '#lib/stores/ui.svelte.ts';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import Icon from './Icon.svelte';
  let {
    label,
    icon = '',
    iconSize = 15,
    danger = false,
    disabled = false,
    httpEnabled = false,
    busy = false,
  }: {
    label: string;
    icon?: string;
    iconSize?: number;
    danger?: boolean;
    disabled?: boolean;
    httpEnabled?: boolean;
    busy?: boolean;
  } = $props();
</script>

<div class="modal-footer" style="margin:20px -24px -24px">
  <button
    class="btn"
    type="button"
    disabled={busy}
    onclick={() => (ui.modal = null)}
  >
    Cancel
  </button><button
    class="btn"
    class:btn-primary={!danger}
    class:btn-danger={danger}
    type="submit"
    disabled={disabled || (infrastructure.mode !== 'demo' && !httpEnabled)}
  >
    {label}{#if icon}<Icon name={icon} size={iconSize} />{/if}
  </button>
</div>
