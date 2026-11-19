<script lang="ts">
  import { capitalize } from '#lib/presentation.ts';
  let { status }: { status: string } = $props();
  const type = $derived(
    [
      'live',
      'running',
      'active',
      'success',
      'ready',
      'verified',
      'connected',
      'available',
      'healthy',
    ].includes(status.toLowerCase())
      ? 'ok'
      : ['failed', 'error', 'offline'].includes(status.toLowerCase())
        ? 'fail'
        : [
              'building',
              'starting',
              'queued',
              'fetching',
              'validating',
              'detecting',
              'health_checking',
              'activating',
              'running job',
              'deploying',
            ].includes(status.toLowerCase())
          ? 'blue'
          : 'warn',
  );
</script>

<span class="tag {type}">
  <span
    class="dot"
    style="width:5px;height:5px;background:currentColor;box-shadow:none"
  ></span>{capitalize(status)}
</span>
