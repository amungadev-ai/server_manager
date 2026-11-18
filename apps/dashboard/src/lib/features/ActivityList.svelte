<script lang="ts">
  import type { Activity } from '@cloudlane/contracts/preview';
  import Icon from '#lib/components/Icon.svelte';
  let { items }: { items: Activity[] } = $props();
  const icons: Record<string, string> = {
    application: 'rocket',
    database: 'database',
    cron: 'clock',
    storage: 'storage',
    domain: 'globe',
  };
</script>

<div class="activity-list">
  {#each items as item}<div class="activity-item">
      <span class="activity-icon">
        <Icon name={icons[item.kind] ?? 'activity'} size={14} />
      </span>
      <div class="activity-copy">
        <strong>{item.title}</strong><span>{item.detail}</span>
      </div>
      <time class="activity-time">{item.timeLabel}</time>
    </div>{/each}
</div>
