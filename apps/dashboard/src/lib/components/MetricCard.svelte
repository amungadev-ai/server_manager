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

<div class="card stat">
  <div class="stat-row">
    <div class="stat-icon"><Icon name={icon} size={18} /></div>
    <div class="stat-main">
      <div class="stat-label">{label}</div>
      <div class="stat-note">{note}</div>
    </div>
    <div class="stat-number">{value}</div>
  </div>
</div>
