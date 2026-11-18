<script lang="ts">
  import { onMount } from 'svelte';
  import PageHeading from '#lib/components/PageHeading.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Badge from '#lib/components/Badge.svelte';
  let theme = $state('dark');
  let palette = $state('original');
  const palettes = [
    {
      id: 'original',
      name: 'Original',
      colors: ['#020617', '#0f172a', '#2dd4bf'],
    },
    { id: 'slate', name: 'Slate', colors: ['#141621', '#353740', '#8c8e90'] },
    { id: 'sand', name: 'Sand', colors: ['#331d16', '#503d37', '#b9947a'] },
    { id: 'sage', name: 'Sage', colors: ['#260413', '#361725', '#ac7d84'] },
    { id: 'mauve', name: 'Mauve', colors: ['#070918', '#2a2b38', '#88963d'] },
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
      /* Optional UI preferences only. */
    }
  }
</script>

<svelte:head><title>Settings — Cloudlane</title></svelte:head>
<PageHeading
  title="Settings"
  eyebrow="Make yourself at home"
  description="A workspace that feels like yours."
/>
<section class="card settings-section">
  <h2>Appearance</h2>
  <p>
    Choose a theme for your workspace. Your preference stays on this device.
  </p>
  <div class="theme-choices">
    <button
      class="choice-button"
      aria-pressed={theme === 'light'}
      onclick={() => update('light', palette)}
    >
      <Icon name="sun" size={18} />Light
    </button><button
      class="choice-button"
      aria-pressed={theme === 'dark'}
      onclick={() => update('dark', palette)}
    >
      <Icon name="moon" size={18} />Dark
    </button>
  </div>
  <div class="divider" style="margin-top:26px"></div>
  <h2>Color palette</h2>
  <p>Five palette families from the Cloudlane design system.</p>
  <div class="palette-grid">
    {#each palettes as item}<button
        class="palette-choice"
        aria-pressed={palette === item.id}
        onclick={() => update(theme, item.id)}
      >
        <span class="palette-swatch">
          {#each item.colors as color}<i style:background={color}></i>{/each}
        </span><span class="row space">
          {item.name}{#if palette === item.id}<Icon
              name="check"
              size={14}
            />{/if}
        </span>
      </button>{/each}
  </div>
</section>
<section class="card settings-section">
  <h2>Platform connection</h2>
  <p>
    Owner authentication, API keys and integrations require the real Cloudlane
    API.
  </p>
  <div class="settings-kv">
    <div>
      <strong>Account and security</strong>
      <p>
        Secure first-owner setup, sessions and MFA are the next platform
        milestones.
      </p>
    </div>
    <Badge label="Not connected" />
  </div>
</section>
