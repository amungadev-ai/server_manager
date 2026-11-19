import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
import { notify } from '#lib/stores/ui.svelte.ts';
import { previewAction, previewId } from '#lib/preview-actions.ts';
import type { PreviewModel } from '#lib/preview-model.ts';
import type { InfrastructureSnapshot } from '@cloudlane/contracts/preview';

const stages = [
  'QUEUED',
  'FETCHING',
  'VALIDATING',
  'DETECTING',
  'BUILDING',
  'STARTING',
  'HEALTH_CHECKING',
  'ACTIVATING',
  'LIVE',
];
/** A browser-only, disposable animation. It never calls the deployment API. */
export function startDemoDeployment(
  model: PreviewModel,
  snapshot: InfrastructureSnapshot,
  serviceId: string,
  failure = '',
) {
  const service = snapshot.services.find((s) => s.id === serviceId);
  const detail = model.services[serviceId];
  if (
    import.meta.env.VITE_CLOUDLANE_DATA_MODE !== 'demo' ||
    !service ||
    !detail
  )
    return;
  const id = previewId('dep');
  const retained =
    detail.activeDeployment ??
    model.deployments.find(
      (d) => d.serviceId === serviceId && d.status === 'LIVE',
    )?.id;
  detail.activeDeployment = retained;
  model.deployments.unshift({
    id,
    serviceId,
    status: 'QUEUED',
    stage: 0,
    revision: previewId(detail.source === 'github' ? 'commit' : 'zip'),
    created: new Date().toISOString(),
    logs: ['[QUEUE] Deployment queued (simulation only)'],
  });
  if (!retained) {
    service.status = 'stopped';
    detail.displayStatus = 'deploying';
  }
  let stage = 0;
  const timer = setInterval(() => {
    // A reset/reload/replacement invalidates this entire simulated session.
    if (infrastructure.preview !== model || infrastructure.data !== snapshot) {
      clearInterval(timer);
      return;
    }
    const release = model.deployments.find((d) => d.id === id);
    if (!release) {
      clearInterval(timer);
      return;
    }
    stage++;
    release.stage = stage;
    release.status = stages[stage] ?? 'LIVE';
    const messages: Record<string, string> = {
      FETCHING: `[SOURCE] ${detail.source === 'github' ? `Checked out ${detail.repo} @ ${detail.branch}` : `Read ${detail.fileName}`}`,
      VALIDATING: '[VALIDATE] Source accepted · size and paths checked (demo)',
      DETECTING: `[DETECT] ${service.framework} · ${detail.role} service`,
      BUILDING: `[BUILD] Compiling ${service.framework} artifact (simulated)`,
      STARTING: '[RUNTIME] Candidate container started',
      HEALTH_CHECKING: '[HEALTH] Waiting for healthy response',
      ACTIVATING: '[ROUTE] Preparing atomic route switch',
      LIVE: '[READY] Deployment healthy and live (simulated)',
    };
    release.logs.push(messages[release.status] ?? `[STEP] ${release.status}`);
    if (
      (failure === 'build' && release.status === 'BUILDING') ||
      (failure === 'health' && release.status === 'HEALTH_CHECKING')
    ) {
      release.status = 'FAILED';
      release.logs.push(
        `[ERROR] Simulated ${failure} failure. Candidate not activated.`,
      );
      if (!retained) {
        service.status = 'failed';
        delete detail.displayStatus;
      }
      snapshot.activity.unshift({
        id: previewId('activity'),
        title: 'Deployment failed',
        detail: `${service.name} · existing healthy release retained`,
        kind: 'application',
        timeLabel: 'just now',
      });
      clearInterval(timer);
      notify(
        'Deployment failed safely. Previous working release retained.',
        true,
      );
    } else if (release.status === 'LIVE') {
      service.status = 'running';
      detail.activeDeployment = release.id;
      delete detail.displayStatus;
      snapshot.activity.unshift({
        id: previewId('activity'),
        title: 'Deployment is live',
        detail: `${service.name} · release ${release.revision}`,
        kind: 'application',
        timeLabel: 'just now',
      });
      clearInterval(timer);
      notify(
        `${service.name} is live (simulated). No real resources were changed.`,
      );
    }
  }, 650);
}
export function redeployDemo(serviceId: string, failure = '') {
  return previewAction(
    (m, d) => startDemoDeployment(m, d, serviceId, failure),
    'Demo deployment queued. No real build or container is started.',
  );
}
