<script lang="ts">
  let {
    label,
    tone = 'neutral',
  }: { label: string; tone?: 'success' | 'warning' | 'neutral' | 'info' } =
    $props();
</script>

<span
  class="tag"
  class:ok={tone === 'success'}
  class:warn={tone === 'warning'}
  class:blue={tone === 'info'}
>
  {label}
</span>
