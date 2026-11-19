<script lang="ts">
  import type { Activity } from '@cloudlane/contracts/preview';
  import Icon from '#lib/components/Icon.svelte';
  let { items }: { items: Activity[] } = $props();
</script>

<div class="activity-list">
  {#each items as item}<div class="activity-item">
      <span class="activity-icon">
        <Icon
          name={item.kind === 'application'
            ? 'rocket'
            : item.kind === 'database'
              ? 'database'
              : item.kind === 'cron'
                ? 'clock'
                : item.kind === 'domain'
                  ? 'globe'
                  : 'settings'}
          size={15}
        />
      </span>
      <div class="activity-body">
        <span class="activity-text">{item.title}</span><span
          class="activity-detail"
        >
          {item.detail}
        </span><span class="activity-time">{item.timeLabel}</span>
      </div>
    </div>{:else}<p class="muted small">No activity yet.</p>{/each}
</div>
