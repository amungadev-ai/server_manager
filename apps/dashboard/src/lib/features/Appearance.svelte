<script lang="ts">
  import { onMount } from 'svelte';
  import Badge from '#lib/components/Badge.svelte';
  let theme = $state('dark'),
    palette = $state('original');
  const palettes = [
    ['original', 'Original · Teal / Slate'],
    ['slate', 'Slate & Charcoal'],
    ['sand', 'Sand & Saddle'],
    ['sage', 'Sage & Burgundy'],
    ['mauve', 'Mauve Meadow'],
  ];
  onMount(() => {
    theme = document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
    palette = document.documentElement.dataset.palette ?? 'original';
  });
  function update(nextTheme: string, nextPalette: string) {
    theme = nextTheme;
    palette = nextPalette;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.palette = palette;
    try {
      localStorage.setItem(
        'cloudlane:appearance',
        JSON.stringify({ theme, palette }),
      );
    } catch {
      /* Optional UI preference only. */
    }
  }
</script>

<section class="card design-pref-panel" aria-label="Appearance preferences">
  <div class="design-pref-header">
    <div>
      <h3 class="section-title">Appearance</h3>
      <p class="design-intro">
        Colors, typography, and control styling follow the uploaded design
        system. Cloudlane workflows remain unchanged.
      </p>
    </div>
    <Badge label="Visual preference" tone="info" />
  </div>
  <div class="design-pref-group">Appearance mode</div>
  <div class="design-mode-group" role="group" aria-label="Color mode">
    {#each [['light', 'Light'], ['dark', 'Dark']] as [mode, label]}<button
        type="button"
        aria-pressed={theme === mode}
        onclick={() => update(mode, palette)}
      >
        {label}
      </button>{/each}
  </div>
  <div class="design-pref-group">Color palette</div>
  <div class="design-palette-grid" role="group" aria-label="Color palette">
    {#each palettes as [id, label]}<button
        class="design-palette-choice"
        aria-pressed={palette === id}
        onclick={() => update(theme, id)}
      >
        <span class="design-swatch {id}" aria-hidden="true"></span><strong>
          {label}
        </strong>
      </button>{/each}
  </div>
  <p class="hint" style="margin-top:15px">
    This setting changes only how your local Cloudlane prototype looks. It does
    not affect projects, deployments, or DNS.
  </p>
</section>
