<script lang="ts">
  import Icon from './Icon.svelte';
  let {
    icon,
    value,
    label,
    note,
  }: { icon: string; value: number | string; label: string; note: string } =
    $props();
</script>

<div class="metric card">
  <span class="metric-icon"><Icon name={icon} size={19} /></span>
  <div class="metric-copy">
    <span class="metric-label">{label}</span><strong class="metric-value">
      {value}
    </strong><span class="metric-note">{note}</span>
  </div>
</div>
