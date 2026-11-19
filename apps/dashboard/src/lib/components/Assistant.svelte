<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { page } from '$app/state';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import Icon from './Icon.svelte';
  import Badge from './Badge.svelte';
  import { ui, askAssistant, notify } from '#lib/stores/ui.svelte.ts';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  let launcher: HTMLButtonElement;
  let drawer = $state<HTMLElement>();
  let position = $state<{ x: number; y: number } | null>(null);
  let saved: { x: number; y: number } | null = null;
  let dragging: {
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null = null;
  let ignoreUntil = 0;
  let prompt = $state('');
  let plan = $state<{
    summary: string;
    steps: string[];
    progress: number;
    approved: boolean;
    complete: boolean;
  } | null>(null);
  let timer: ReturnType<typeof setInterval>;
  const service = $derived(
    infrastructure.data?.services.find(
      (item) => item.id === page.params.serviceId,
    ),
  );
  const project = $derived(
    infrastructure.data?.projects.find(
      (item) => item.id === page.params.projectId,
    ),
  );
  const suggestions = $derived(
    service
      ? [
          `Explain the latest logs for ${service.name}`,
          `Check health and recovery options for ${service.name}`,
        ]
      : project
        ? [
            `Check the health and dependencies of ${project.name}`,
            'Connect an API to a PostgreSQL database',
          ]
        : [
            'Deploy my backend with PostgreSQL and a domain',
            'Diagnose a failed deployment and suggest safe recovery',
          ],
  );
  function place() {
    if (!saved || !launcher) return;
    const r = launcher.getBoundingClientRect();
    position = {
      x: 10 + saved.x * Math.max(0, innerWidth - r.width - 20),
      y: 10 + saved.y * Math.max(0, innerHeight - r.height - 20),
    };
  }
  onMount(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem('cloudlane:assistant-position') ?? 'null',
      );
      if (value && Number.isFinite(value.x) && Number.isFinite(value.y))
        saved = {
          x: Math.max(0, Math.min(1, value.x)),
          y: Math.max(0, Math.min(1, value.y)),
        };
    } catch {
      /* UI preference only. */
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  onDestroy(() => clearInterval(timer));
  $effect(() => {
    if (ui.assistantPrompt) {
      prompt = ui.assistantPrompt;
      ui.assistantPrompt = '';
    }
  });
  $effect(() => {
    if (ui.assistantOpen) {
      void tick().then(() =>
        drawer?.querySelector<HTMLTextAreaElement>('textarea')?.focus(),
      );
    }
  });
  function move(event: PointerEvent) {
    if (!dragging || dragging.id !== event.pointerId) return;
    const dx = event.clientX - dragging.x,
      dy = event.clientY - dragging.y;
    if (!dragging.moved && Math.hypot(dx, dy) < 5) return;
    dragging.moved = true;
    const rect = launcher.getBoundingClientRect();
    position = {
      x: Math.max(
        10,
        Math.min(innerWidth - rect.width - 10, dragging.left + dx),
      ),
      y: Math.max(
        10,
        Math.min(innerHeight - rect.height - 10, dragging.top + dy),
      ),
    };
    event.preventDefault();
  }
  function end(event: PointerEvent) {
    if (!dragging || dragging.id !== event.pointerId) return;
    const moved = dragging.moved;
    dragging = null;
    if (launcher.hasPointerCapture(event.pointerId))
      launcher.releasePointerCapture(event.pointerId);
    if (!moved || !position) return;
    const rect = launcher.getBoundingClientRect();
    saved = {
      x: Math.max(
        0,
        Math.min(
          1,
          (position.x - 10) / Math.max(1, innerWidth - rect.width - 20),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          1,
          (position.y - 10) / Math.max(1, innerHeight - rect.height - 20),
        ),
      ),
    };
    try {
      localStorage.setItem(
        'cloudlane:assistant-position',
        JSON.stringify(saved),
      );
    } catch {
      /* Optional preference. */
    }
    ignoreUntil = performance.now() + 320;
  }
  function generate(event: SubmitEvent) {
    event.preventDefault();
    const text = prompt.trim().toLowerCase();
    if (!text) return;
    let summary = 'Guided infrastructure action plan',
      steps = [
        'Inspect the current workspace context',
        'Validate supported actions and required permissions',
        'Present a scoped execution plan for approval',
      ];
    if (/storage|bucket|kyc|media|profile photos/.test(text)) {
      summary = 'Private object storage configuration plan';
      steps = [
        'Identify the workspace project and existing storage service',
        'Confirm provider and private bucket configuration',
        'Validate scoped application access, encryption and upload constraints',
        'Review retention, quota and audit requirements',
        'Request approval before applying any future live changes',
      ];
    } else if (
      /log|fail|debug|diagnos|health|error|recover|restart|rollback/.test(text)
    ) {
      summary = 'Diagnostic and safe recovery plan';
      steps = [
        'Inspect the selected service and latest deployment logs',
        'Compare build, startup, and health-check signals',
        'Explain the most likely failure and present evidence',
        'Propose a limited restart or healthy-release rollback for approval',
      ];
    } else if (
      /deploy|application|app|github|backend|api|zip|laravel|next/.test(text)
    ) {
      summary = 'Application deployment plan';
      steps = [
        'Review ZIP or GitHub source and detect framework',
        'Validate runtime, required environment variables, and resource limits',
      ];
      if (/postgres|mysql|database/.test(text))
        steps.push('Provision and privately connect the requested database');
      steps.push(
        'Build in an isolated environment and start candidate release',
        'Run health checks before activating the HTTPS endpoint',
      );
      if (/domain|ssl|https/.test(text))
        steps.push(
          'Verify an available hostname in the central Domains registry and activate TLS',
        );
    } else if (/domain|dns|ssl|certificate/.test(text)) {
      summary = 'Domain and HTTPS configuration plan';
      steps = [
        'Check domain registration and ownership verification',
        'Inspect DNS records and available hostnames',
        'Confirm application binding without a routing conflict',
        'Request or validate automatic TLS certificate',
      ];
    } else if (/cron|schedul/.test(text)) {
      summary = 'Scheduled task plan';
      steps = [
        'Validate the target HTTPS endpoint and auth requirements',
        'Check timezone, cron expression, timeout, and retry settings',
        'Request approval before enabling the schedule',
        'Verify execution history and failure alerts',
      ];
    }
    plan = { summary, steps, progress: -1, approved: false, complete: false };
  }
  function approve() {
    if (!plan) return;
    if (infrastructure.mode !== 'demo')
      return notify(
        'Live execution is not configured. No infrastructure was changed.',
        true,
      );
    plan.approved = true;
    clearInterval(timer);
    timer = setInterval(() => {
      if (!plan) return;
      plan.progress++;
      if (plan.progress >= plan.steps.length - 1) {
        plan.complete = true;
        clearInterval(timer);
        notify('Demo finished. No real resources were provisioned.');
      }
    }, 450);
  }
  function keys(event: KeyboardEvent) {
    if (!ui.assistantOpen) return;
    if (event.key === 'Escape') {
      ui.assistantOpen = false;
      launcher?.focus();
    }
    if (event.key === 'Tab' && drawer) {
      const nodes = drawer.querySelectorAll<HTMLElement>(
        'button,textarea,a[href]',
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={keys} />
<button
  bind:this={launcher}
  class="ai-fab"
  aria-label="Open Cloudlane Assistant (drag to reposition)"
  aria-haspopup="dialog"
  title="Drag to move · Tap to open Cloudlane Assistant"
  style:left={position ? `${position.x}px` : undefined}
  style:top={position ? `${position.y}px` : undefined}
  style:right={position ? 'auto' : undefined}
  style:bottom={position ? 'auto' : undefined}
  onpointerdown={(event) => {
    if (
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    const rect = launcher.getBoundingClientRect();
    dragging = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    launcher.setPointerCapture(event.pointerId);
  }}
  onpointermove={move}
  onpointerup={end}
  onpointercancel={end}
  onclick={() => {
    if (performance.now() > ignoreUntil) askAssistant();
  }}
>
  <Icon name="sparkles" size={18} />
</button>
{#if ui.assistantOpen}<button
    class="ai-overlay"
    tabindex="-1"
    aria-label="Close assistant overlay"
    onclick={() => {
      ui.assistantOpen = false;
      launcher?.focus();
    }}
  ></button>
  <div
    tabindex="-1"
    bind:this={drawer}
    class="ai-drawer"
    role="dialog"
    aria-modal="true"
    aria-label="Cloudlane assistant"
  >
    <div class="ai-drawer-head">
      <span class="status-icon mint"><Icon name="sparkles" size={19} /></span>
      <div style="flex:1">
        <strong>Cloudlane Assistant</strong>
        <div class="muted xs">Guided operations · demonstration</div>
      </div>
      <button
        class="icon-btn"
        onclick={() => {
          ui.assistantOpen = false;
          launcher?.focus();
        }}
        aria-label="Close assistant"
      >
        <Icon name="close" size={17} />
      </button>
    </div>
    <div class="ai-body">
      <div class="ai-safety">
        <Icon name="shield" size={16} /> This is a rule-based prototype, not a live
        AI model. Plans and execution are simulated; approval does not change real
        infrastructure.
      </div>
      <div class="col" style="gap:7px">
        <strong class="small">
          Try a prompt
        </strong>{#each suggestions as suggestion}<button
            class="ai-sample"
            onclick={() => (prompt = suggestion)}
          >
            {suggestion}
          </button>{/each}
      </div>
      <form class="ai-input-area" onsubmit={generate}>
        <label class="form-label" for="assistantQuery">
          What would you like Cloudlane to do?
        </label><textarea
          id="assistantQuery"
          required
          maxlength="400"
          bind:value={prompt}
          placeholder="e.g. Explain why my NestJS API failed to deploy"
        ></textarea><button class="btn btn-primary" type="submit">
          <Icon name="sparkles" size={15} /> Generate plan
        </button>
      </form>
      {#if plan}<div class="card">
          <div class="row space">
            <div>
              <h3 class="section-title">{plan.summary}</h3>
              <p class="muted xs">Proposed steps · review before approval</p>
            </div>
            <Badge
              label={plan.complete
                ? 'Simulated complete'
                : plan.approved
                  ? 'Running demo'
                  : 'Needs approval'}
              tone={plan.complete
                ? 'success'
                : plan.approved
                  ? 'info'
                  : 'warning'}
            />
          </div>
          <div class="divider"></div>
          {#each plan.steps as step, index}<div
              class="ai-plan-step"
              class:done={plan.progress >= index}
            >
              <span class="ai-step-no">
                {#if plan.progress >= index}<Icon
                    name="check"
                    size={12}
                  />{:else}{index + 1}{/if}
              </span><span>{step}</span>
            </div>{/each}{#if plan.complete}<p class="hint">
              Demo finished. No real resources were provisioned.
            </p>{:else if plan.approved}<p class="hint">
              Executing simulated operations…
            </p>{:else}<div class="row" style="margin-top:16px">
              <button class="btn btn-primary" onclick={approve}>
                Approve &amp; simulate
              </button><button class="btn" onclick={() => (plan = null)}>
                Discard
              </button>
            </div>{/if}
        </div>{/if}
      <p class="muted xs">
        Production design: least-privilege tools, audit trails, explicit
        approval for changes, and no unrestricted shell access.
      </p>
    </div>
  </div>{/if}
