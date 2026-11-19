<script lang="ts">
  import { startDemoDeployment } from '#lib/demo-deployment.ts';
  import { goto } from '$app/navigation';
  import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
  import { ui, notify } from '#lib/stores/ui.svelte.ts';
  import { previewAction, previewId } from '#lib/preview-actions.ts';
  import { inspectZip } from '#lib/inspect-zip.ts';
  import Icon from '#lib/components/Icon.svelte';
  import FormFooter from '#lib/components/FormFooter.svelte';
  let { kind }: { kind: string } = $props();
  let projectId = $state(
      ui.modalData.project ?? infrastructure.data?.projects[0]?.id ?? '__new__',
    ),
    newProject = $state(''),
    name = $state(''),
    source = $state('zip'),
    repo = $state(''),
    branch = $state('main'),
    autoDeploy = $state(true),
    framework = $state('auto'),
    engine = $state('PostgreSQL'),
    database = $state(''),
    method = $state('POST'),
    schedule = $state('*/5 * * * *'),
    target = $state(''),
    timezone = $state('Africa/Nairobi');
  let fileName = $state(''),
    fileCount = $state(0),
    detected = $state('Not detected yet'),
    error = $state(''),
    inspecting = $state(false);
  async function file(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files?.[0];
    if (!selected) return;
    fileName = '';
    error = '';
    inspecting = true;
    try {
      const result = await inspectZip(selected);
      fileName = selected.name;
      fileCount = result.count;
      detected = result.framework;
      if (!name)
        name = selected.name
          .replace(/\.zip$/i, '')
          .replace(/[^a-zA-Z0-9_-]/g, '-');
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : 'Unable to inspect archive.';
    } finally {
      inspecting = false;
    }
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    try {
      if (kind === 'application' && source === 'zip' && !fileName)
        throw new Error('Choose a ZIP archive first.');
      if (
        kind === 'application' &&
        source === 'github' &&
        !/^[\w.-]+\/[\w.-]+$/.test(repo)
      )
        throw new Error('Use a repository in owner/name format.');
      if (projectId === '__new__' && !newProject.trim())
        throw new Error('Enter the new project name.');
      let destination = '';
      const ok = previewAction((m, d) => {
        const now = new Date().toISOString();
        if (kind === 'project') {
          const id = previewId('proj');
          d.projects.push({
            id,
            name: name.trim(),
            description: '',
            updatedLabel: 'just now',
          });
          m.projectCreated[id] = now;
          destination = `/projects/${id}`;
          return;
        }
        let pid = projectId;
        if (pid === '__new__') {
          pid = previewId('proj');
          d.projects.push({
            id: pid,
            name: newProject.trim(),
            description: '',
            updatedLabel: 'just now',
          });
          m.projectCreated[pid] = now;
        }
        const id = previewId('svc');
        let type =
          kind === 'application'
            ? framework === 'auto'
              ? detected === 'Not detected yet'
                ? 'Node.js/Express'
                : detected
              : framework
            : kind === 'database'
              ? engine
              : kind === 'storage'
                ? 'External S3-compatible'
                : 'Scheduled HTTP';
        d.services.push({
          id,
          projectId: pid,
          name: name.trim(),
          kind: kind as 'application' | 'database' | 'cron' | 'storage',
          framework: type,
          status: kind === 'cron' || kind === 'storage' ? 'active' : 'running',
        });
        if (kind === 'application') {
          m.services[id] = {
            created: now,
            source,
            repo,
            branch,
            fileName,
            autoDeploy,
            role: /Nest|Express/.test(type) ? 'api' : 'web',
            variables: [],
          };
          m.platformDomains.push({
            id: previewId('dom'),
            serviceId: id,
            name: `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.apps.example.test`,
            status: 'active',
            https: true,
          });
        } else if (kind === 'database') {
          m.services[id] = {
            created: now,
            engine,
            version: engine === 'PostgreSQL' ? '16' : '8.4',
            database,
            external: false,
          };
        } else if (kind === 'cron') {
          m.services[id] = {
            created: now,
            method,
            target,
            schedule,
            timezone,
            enabled: true,
          };
        } else {
          m.services[id] = {
            created: now,
            provider: 'External S3-compatible',
            region: 'External region',
            displayStatus: 'ready',
          };
        }
        d.activity.unshift({
          id: previewId('activity'),
          title:
            kind === 'application'
              ? 'Deployment queued'
              : kind === 'database'
                ? 'Database provisioned'
                : kind === 'cron'
                  ? 'Cron job scheduled'
                  : 'Object storage created',
          detail: `${name} · simulated`,
          kind: kind as 'application' | 'database' | 'cron' | 'storage',
          timeLabel: 'just now',
        });
        if (kind === 'application') startDemoDeployment(m, d, id);
        destination = `/services/${id}`;
      }, 'Created in simulation only. No real resources were provisioned.');
      if (ok) {
        ui.modal = null;
        void goto(destination);
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Review the form.';
    }
  }
</script>

<form onsubmit={submit}>
  {#if kind !== 'project'}<div class="form-row">
      <label class="form-label" for="projectId">Project</label><select
        id="projectId"
        bind:value={projectId}
        required
      >
        {#each infrastructure.data?.projects ?? [] as project}<option
            value={project.id}
          >
            {project.name}
          </option>{/each}<option value="__new__">+ Create new project</option>
      </select>{#if kind !== 'storage'}<p class="hint">
          Every service belongs to a project. Create one here without leaving
          this form.
        </p>{/if}
    </div>
    {#if projectId === '__new__'}<div class="form-row">
        <label class="form-label" for="newProjectName">
          New project name
        </label><input
          id="newProjectName"
          bind:value={newProject}
          required
          maxlength="62"
          placeholder="e.g. Delivery platform"
        />
        <p class="hint">A production environment is created automatically.</p>
      </div>{/if}{/if}
  {#if kind === 'project'}<div class="form-row">
      <label class="form-label" for="resourceName">Project name</label><input
        id="resourceName"
        bind:value={name}
        required
        maxlength="62"
        placeholder="e.g. My delivery app"
      />
      <p class="hint">Creates a production environment automatically.</p>
    </div>
    <FormFooter label="Create project" icon="arrow" />
  {:else if kind === 'application'}
    <div class="form-row">
      <label class="form-label" for="resourceName">Service name</label><input
        id="resourceName"
        bind:value={name}
        required
        maxlength="48"
        placeholder="my-app"
        pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*"
        title="Use letters, numbers, hyphens, or underscores"
      />
      <p class="hint">
        We automatically identify the application type and suggest a runtime
        from its source.
      </p>
    </div>
    <div class="form-row">
      <span class="form-label">Source code</span>
      <div class="tile-options">
        {#each [['zip', 'archive', 'Upload ZIP'], ['github', 'github', 'GitHub']] as [id, icon, label]}<button
            type="button"
            class="tile-option"
            style:border-color={source === id ? '#8ce5c8' : 'var(--border2)'}
            onclick={() => (source = id)}
          >
            <Icon name={icon} size={19} />
            <strong>{label}</strong>{#if source === id}<Icon
                name="check"
                size={14}
              />{/if}
          </button>{/each}
      </div>
    </div>
    {#if source === 'zip'}<label class="dropzone" for="zipfile">
        <Icon name="upload" size={25} />
        <div style="margin-top:8px">
          <strong>
            {inspecting
              ? 'Inspecting archive…'
              : fileName || 'Choose a .zip project archive'}
          </strong>
        </div>
        <p>
          {fileName
            ? `${fileCount} file entries scanned · detected: ${detected}`
            : 'ZIP is inspected locally. Nothing is uploaded in demo mode.'}
        </p>
        <input
          id="zipfile"
          type="file"
          accept=".zip,application/zip"
          onchange={file}
        />
      </label>
      <p class="hint">
        Real deployments would upload, validate, and extract this file in a
        secure build environment.
      </p>{:else}<div class="form-row">
        {#if !infrastructure.preview?.githubConnected}<div
            class="callout"
            style="margin-bottom:13px"
          >
            <div class="row space">
              <span class="small">GitHub not connected (demo)</span><button
                type="button"
                class="btn btn-small"
                onclick={() =>
                  previewAction(
                    (m) => (m.githubConnected = true),
                    'Connected in simulation only.',
                  )}
              >
                Connect demo
              </button>
            </div>
          </div>{:else}<div
            class="row"
            style="margin-bottom:12px;color:var(--mint)"
          >
            <Icon name="check" size={15} /><span class="small">
              GitHub demo account connected
            </span>
          </div>{/if}<label class="form-label" for="repo">
          Repository
        </label><input
          id="repo"
          placeholder="owner/my-repository"
          bind:value={repo}
          required
        />
        <p class="hint">Example: my-org/awesome-api · simulated GitHub fetch</p>
      </div>
      <div class="form-grid">
        <div class="form-row">
          <label class="form-label" for="branch">Branch</label><input
            id="branch"
            bind:value={branch}
            required
          />
        </div>
        <div class="form-row">
          <span class="form-label">Deploy on push</span><label
            class="form-check"
            style="margin-top:14px"
          >
            <input type="checkbox" bind:checked={autoDeploy} /> Automatically deploy
            commits
          </label>
        </div>
      </div>{/if}
    <div class="form-grid" style="margin-top:16px">
      <div class="form-row">
        <label class="form-label" for="framework">Framework</label><select
          id="framework"
          bind:value={framework}
        >
          <option value="auto">
            Auto detect{source === 'zip' && fileName ? ` (${detected})` : ''}
          </option>{#each ['Static HTML', 'React/Vite', 'Next.js', 'Node.js/Express', 'NestJS', 'Dockerfile'] as item}<option
              value={item}
            >
              {item === 'Static HTML'
                ? 'Static HTML/CSS/JS'
                : item === 'Dockerfile'
                  ? 'Custom Dockerfile'
                  : item}
            </option>{/each}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label" for="strategy">Build strategy</label><select
          id="strategy"
        >
          <option>Automatic (recommended)</option><option>
            Custom configuration later
          </option>
        </select>
      </div>
    </div>
    <div class="callout" style="margin-top:3px">
      <div class="row">
        <span style="color:var(--mint)">
          <Icon name="zap" size={18} />
        </span><span class="callout-title">One unified deployment engine</span>
      </div>
      <p>Validate → Detect → Build → Start → Health Check → Activate HTTPS.</p>
    </div>
    <FormFooter label="Start deployment" icon="rocket" disabled={inspecting} />
  {:else if kind === 'database'}
    <div class="form-grid">
      <div class="form-row">
        <label class="form-label" for="resourceName">Service name</label><input
          id="resourceName"
          bind:value={name}
          placeholder="customer-db"
          pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*"
          required
        />
      </div>
      <div class="form-row">
        <label class="form-label" for="engine">Database engine</label><select
          id="engine"
          bind:value={engine}
        >
          {#each ['PostgreSQL', 'MySQL', 'MariaDB'] as item}<option>
              {item}
            </option>{/each}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label class="form-label" for="database">Database name</label><input
        id="database"
        bind:value={database}
        placeholder="my_app_production"
        pattern="[a-zA-Z][a-zA-Z0-9_]*"
        required
      />
    </div>
    <div class="callout">
      <div class="row">
        <Icon name="lock" size={17} /><span class="callout-title">
          Private by default
        </span>
      </div>
      <p>
        External connections must be explicitly enabled with source-IP
        restrictions, encryption, and authentication.
      </p>
    </div>
    <FormFooter label="Provision database" icon="arrow" />
  {:else if kind === 'cron'}
    <div class="form-row">
      <label class="form-label" for="resourceName">Job name</label><input
        id="resourceName"
        bind:value={name}
        maxlength="64"
        placeholder="Daily cleanup"
        required
      />
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label class="form-label" for="method">HTTP method</label><select
          id="method"
          bind:value={method}
        >
          {#each ['POST', 'GET', 'PUT', 'PATCH'] as item}<option>
              {item}
            </option>{/each}
        </select>
      </div>
      <div class="form-row">
        <label class="form-label" for="schedule">Schedule</label><select
          id="schedule"
          bind:value={schedule}
        >
          {#each [['*/5 * * * *', 'Every 5 minutes'], ['0 * * * *', 'Every hour'], ['0 0 * * *', 'Daily at midnight'], ['0 2 * * *', 'Daily at 02:00'], ['0 0 * * 1', 'Every Monday']] as [value, label]}<option
              {value}
            >
              {label}
            </option>{/each}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label class="form-label" for="target">HTTPS callback URL</label><input
        id="target"
        type="url"
        bind:value={target}
        required
        placeholder="https://api.example.com/tasks/cleanup"
        pattern="https://.+"
        title="Must be an HTTPS URL"
      />
      <p class="hint">
        In production, requests are authenticated and restricted from
        private/metadata endpoints.
      </p>
    </div>
    <div class="form-row">
      <label class="form-label" for="timezone">Timezone</label><select
        id="timezone"
        bind:value={timezone}
      >
        {#each ['Africa/Nairobi', 'UTC', 'Europe/London', 'America/New_York'] as item}<option>
            {item}
          </option>{/each}
      </select>
    </div>
    <FormFooter label="Create schedule" icon="clock" />
  {:else if kind === 'storage'}
    <div class="form-row">
      <label class="form-label" for="resourceName">
        Storage service name
      </label><input
        id="resourceName"
        bind:value={name}
        required
        placeholder="maidfinder-media"
      />
    </div>
    <div class="form-row">
      <label class="form-label" for="provider">Storage provider</label><select
        id="provider"
      >
        <option>External S3-compatible (recommended)</option><option disabled>
          Self-hosted storage (later, capacity dependent)
        </option>
      </select>
    </div>
    <div class="notice">
      Simulated connection only. No real provider credentials are collected.
      Designed for the 1 GB VPS target.
    </div>
    <FormFooter label="Create storage" />
  {/if}{#if error}<p class="form-error" role="alert">{error}</p>{/if}
</form>
