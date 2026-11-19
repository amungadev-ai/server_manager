<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import Icon from './Icon.svelte';
  import CreateDialog from './CreateDialog.svelte';
  import Assistant from './Assistant.svelte';
  import {
    infrastructure,
    loadInfrastructure,
  } from '#lib/stores/infrastructure.svelte.ts';
  import { ui } from '#lib/stores/ui.svelte.ts';
  let { children }: { children: Snippet } = $props();
  let mobileOpen = $state(false);
  const groups = [
    {
      label: 'WORKSPACE',
      items: [
        { href: '/', label: 'Overview', icon: 'layout' },
        { href: '/projects', label: 'Projects', icon: 'folder' },
      ],
    },
    {
      label: 'RESOURCES',
      items: [
        { href: '/domains', label: 'Domains', icon: 'globe' },
        { href: '/databases', label: 'Databases', icon: 'database' },
        { href: '/email', label: 'Email', icon: 'mail' },
        { href: '/cron-jobs', label: 'Cron Jobs', icon: 'clock' },
      ],
    },
    {
      label: 'INFRASTRUCTURE',
      items: [
        { href: '/activity', label: 'Activity & Logs', icon: 'pulse' },
        { href: '/server', label: 'Server', icon: 'server' },
      ],
    },
    {
      label: 'PREFERENCES',
      items: [{ href: '/settings', label: 'Settings', icon: 'settings' }],
    },
  ];
  const service = $derived(
    infrastructure.data?.services.find((s) => s.id === page.params.serviceId),
  );
  const project = $derived(
    infrastructure.data?.projects.find(
      (p) => p.id === (page.params.projectId ?? service?.projectId),
    ),
  );
  const domain = $derived(
    infrastructure.data?.domains.find((d) => d.id === page.params.zoneId),
  );
  const current = $derived(
    page.url.pathname.startsWith('/services/')
      ? 'Projects'
      : (groups
          .flatMap((group) => group.items)
          .find((item) =>
            item.href === '/'
              ? page.url.pathname === '/'
              : page.url.pathname.startsWith(item.href),
          )?.label ??
          (page.url.pathname === '/storage'
            ? 'Object Storage'
            : 'Documentation')),
  );
  const title = $derived(
    service?.name ??
      (page.params.projectId ? project?.name : undefined) ??
      domain?.name ??
      current,
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
      /* Optional UI preference only. */
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
    class="mobile-shade open"
    aria-label="Close navigation"
    onclick={() => (mobileOpen = false)}
  ></button>{/if}
<div class="app">
  <aside class="sidebar" class:open={mobileOpen} aria-label="Main navigation">
    <a class="brand" href="/" aria-label="Cloudlane overview">
      <div class="logo"><Icon name="layers" size={22} /></div>
      <div>
        <div class="brand-name">
          cloudlane<span style="color:var(--mint)">.</span>
        </div>
        <div class="brand-tag">INFRASTRUCTURE, SIMPLIFIED</div>
      </div>
    </a>
    <nav class="nav-list" aria-label="Main navigation">
      {#each groups as group}<div class="nav-group-title">{group.label}</div>
        {#each group.items as item}<a
            class="nav-item"
            class:active={current === item.label}
            aria-current={current === item.label ? 'page' : undefined}
            href={item.href}
          >
            <Icon name={item.icon} size={16} /><span>{item.label}</span>
          </a>{/each}{/each}
    </nav>
    <div class="sidebar-bottom">
      <a class="side-small-link" href="/documentation">
        <Icon name="book" size={15} /> Documentation <Icon
          name="external"
          size={13}
        />
      </a>
      <div class="tiny-profile" style="margin-top:10px">
        <div class="avatar">{infrastructure.mode === 'demo' ? 'DW' : 'CW'}</div>
        <div>
          <div class="profile-name">
            {infrastructure.mode === 'demo'
              ? 'Demo Workspace'
              : 'Cloudlane Workspace'}
          </div>
          <div class="profile-meta">
            {infrastructure.mode === 'demo'
              ? 'Local browser storage'
              : 'Owner session required'}
          </div>
        </div>
      </div>
    </div>
  </aside>
  <div class="main">
    <header class="topbar">
      <button
        class="icon-btn mobile-toggle"
        onclick={() => (mobileOpen = !mobileOpen)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <Icon name="menu" size={19} />
      </button>
      <div class="crumb">
        <span>Workspace</span><Icon name="chevron" size={12} />{#if domain}<a
            class="link"
            href="/domains"
          >
            Domains
          </a><Icon name="chevron" size={12} />{/if}{#if service && project}<a
            class="link"
            href="/projects/{project.id}"
          >
            {project.name}
          </a><Icon name="chevron" size={12} />{/if}<strong>{title}</strong>
      </div>
      <div class="top-spacer"></div>
      {#if infrastructure.mode === 'demo'}<span class="top-server">
          <span class="dot"></span> VPS connected (demo)
        </span><span
          class="top-pill"
          aria-label="Design preview — simulation only"
        >
          <Icon name="alert" size={13} /> SIMULATION
        </span>{:else}<span class="top-server">
          {infrastructure.data?.server
            ? 'Reported server state'
            : 'No server connected'}
        </span>{/if}
    </header>
    <main id="main-content" class="content" tabindex="-1">
      {#if infrastructure.status === 'loading'}<div class="card empty">
          <Icon name="layers" size={30} />
          <p>Loading your workspace…</p>
        </div>{:else if infrastructure.status === 'error'}<section
          class="card empty"
        >
          <Icon name="server" size={28} />
          <h1>Connect your Cloudlane API</h1>
          <p>{infrastructure.error}</p>
          <p class="muted">
            The dashboard is ready. Owner setup and workspace data require the
            Cloudlane API.
          </p>
          <button class="btn" onclick={() => loadInfrastructure()}>
            <Icon name="refresh" size={16} />Try again
          </button>
        </section>{:else}{@render children()}{/if}
    </main>
  </div>
</div>
<Assistant />
<CreateDialog />
{#if ui.toast}<div
    class="toast"
    class:error-toast={ui.toast.error}
    role="status"
  >
    <Icon name={ui.toast.error ? 'alert' : 'check'} size={18} /><span>
      {ui.toast.message}
    </span><button aria-label="Dismiss" onclick={() => (ui.toast = null)}>
      <Icon name="close" size={15} />
    </button>
  </div>{/if}
