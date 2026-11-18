<script lang="ts">
  let {
    label,
    tone = 'neutral',
  }: { label: string; tone?: 'success' | 'warning' | 'neutral' | 'info' } =
    $props();
</script>

<span class="badge {tone}">{label}</span>
