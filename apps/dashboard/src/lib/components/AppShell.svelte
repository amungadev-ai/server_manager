<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import Icon from './Icon.svelte';
  import CreateDialog from './CreateDialog.svelte';
  import {
    infrastructure,
    loadInfrastructure,
  } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  let { children }: { children: Snippet } = $props();
  let mobileOpen = $state(false);
  const groups = [
    {
      label: 'Workspace',
      items: [
        { href: '/', label: 'Overview', icon: 'overview' },
        { href: '/projects', label: 'Projects', icon: 'folder' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { href: '/domains', label: 'Domains', icon: 'globe' },
        { href: '/databases', label: 'Databases', icon: 'database' },
        { href: '/email', label: 'Email', icon: 'mail' },
        { href: '/cron-jobs', label: 'Cron Jobs', icon: 'clock' },
      ],
    },
    {
      label: 'Infrastructure',
      items: [
        { href: '/activity', label: 'Activity & Logs', icon: 'activity' },
        { href: '/server', label: 'Server', icon: 'server' },
      ],
    },
    {
      label: 'Preferences',
      items: [{ href: '/settings', label: 'Settings', icon: 'settings' }],
    },
  ];
  const current = $derived(
    groups
      .flatMap((group) => group.items)
      .find((item) =>
        item.href === '/'
          ? page.url.pathname === '/'
          : page.url.pathname.startsWith(item.href),
      )?.label ?? 'Cloudlane',
  );
  onMount(() => {
    const controller = new AbortController();
    try {
      const prefs = JSON.parse(
        localStorage.getItem('cloudlane:appearance') ?? 'null',
      );
      if (
        prefs &&
        ['original', 'slate', 'sand', 'sage', 'mauve'].includes(prefs.palette)
      )
        document.documentElement.dataset.palette = prefs.palette;
      if (prefs?.theme === 'light' || prefs?.theme === 'dark')
        document.documentElement.classList.toggle(
          'dark',
          prefs.theme === 'dark',
        );
    } catch {
      /* Appearance storage is optional. */
    }
    void loadInfrastructure(controller.signal);
    return () => controller.abort();
  });
  $effect(() => {
    page.url.pathname;
    mobileOpen = false;
  });
</script>

<a class="skip-link" href="#main-content">Skip to content</a>
{#if mobileOpen}<button
    class="sidebar-backdrop"
    onclick={() => (mobileOpen = false)}
    aria-label="Close navigation"
  ></button>{/if}
<aside
  class:mobile-open={mobileOpen}
  class="sidebar"
  aria-label="Main navigation"
>
  <a class="brand" href="/">
    <span class="logo"><Icon name="cloud" size={23} /></span><span>
      <strong>Cloudlane</strong><small>INFRASTRUCTURE, SIMPLIFIED</small>
    </span>
  </a>
  <nav class="nav-list">
    {#each groups as group}<div class="nav-group">
        <p class="nav-label">{group.label}</p>
        {#each group.items as item}<a
            class="nav-item"
            class:active={current === item.label}
            aria-current={current === item.label ? 'page' : undefined}
            href={item.href}
          >
            <Icon name={item.icon} size={18} /><span>
              {item.label}
            </span>{#if item.label === 'Projects' && infrastructure.data}<span
                class="nav-count"
              >
                {infrastructure.data.projects.length}
              </span>{/if}
          </a>{/each}
      </div>{/each}
  </nav>
  <div class="sidebar-bottom">
    <a class="nav-item" href="/documentation">
      <Icon name="book" size={18} /><span>Documentation</span>
    </a><a class="profile" href="/settings">
      <span class="avatar"><Icon name="cloud" size={18} /></span><span
        class="grow"
      >
        <strong>Starter Workspace</strong><small>
          {infrastructure.mode === 'demo'
            ? 'Development preview'
            : 'Owner setup pending'}
        </small>
      </span><Icon name="down" size={14} />
    </a>
  </div>
</aside>
<div class="main-area">
  <header class="topbar">
    <button
      class="icon-button mobile-toggle"
      onclick={() => (mobileOpen = !mobileOpen)}
      aria-label="Open navigation"
      aria-expanded={mobileOpen}
    >
      <Icon name="menu" />
    </button>
    <div class="breadcrumbs">
      <span>Workspace</span><Icon name="chevron" size={12} /><strong>
        {current}
      </strong>
    </div>
    <div class="grow"></div>
    <span class="connection-label">
      <Icon name="server" size={14} />{infrastructure.mode === 'demo'
        ? 'Sample infrastructure'
        : 'API connection'}
    </span>{#if infrastructure.mode === 'demo'}<span class="preview-badge">
        Design preview
      </span>{/if}<a
      class="icon-button top-settings"
      href="/settings"
      aria-label="Appearance settings"
    >
      <Icon name="sun" size={18} />
    </a>
  </header>
  <main id="main-content" class="content" tabindex="-1">
    {#if infrastructure.status === 'loading'}<div class="loading-state">
        <Icon name="cloud" size={30} />
        <p>Loading your workspace…</p>
      </div>
    {:else if infrastructure.status === 'error'}<div class="empty-state card">
        <span class="empty-icon"><Icon name="server" size={28} /></span>
        <h1>Connect your Cloudlane API</h1>
        <p>{infrastructure.error}</p>
        <p class="muted">
          The dashboard is ready. Owner setup and workspace data require the
          Cloudlane API.
        </p>
        <button class="button" onclick={() => loadInfrastructure()}>
          <Icon name="refresh" size={16} />Try again
        </button>
      </div>
    {:else}{@render children()}{/if}
    <footer class="content-footer">
      <span>Cloudlane</span><span>
        {infrastructure.mode === 'demo'
          ? 'Read-only sample data · No server connected'
          : 'Foundation build · v0.1.0'}
      </span>
    </footer>
  </main>
</div>
<button
  class="assistant-launcher"
  aria-label="Open Cloudlane Assistant"
  onclick={() => (ui.modal = 'assistant')}
>
  <Icon name="sparkles" size={20} />
</button>
<CreateDialog />
