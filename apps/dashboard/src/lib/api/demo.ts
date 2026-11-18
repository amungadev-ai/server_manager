import type {
  InfrastructureApi,
  InfrastructureSnapshot,
} from '@cloudlane/contracts/preview';

/** Read-only synthetic UI fixtures. Never imported by the HTTP production branch. */
export class DemoInfrastructureApi implements InfrastructureApi {
  readonly mode = 'demo' as const;
  async getSnapshot(signal?: AbortSignal): Promise<InfrastructureSnapshot> {
    signal?.throwIfAborted();
    return {
      projects: [
        {
          id: 'proj_maid',
          name: 'Maid Finder',
          description: 'Your home services platform',
          updatedLabel: '12 minutes ago',
        },
        {
          id: 'proj_pulse',
          name: 'Pulse Analytics',
          description: 'Insights for every decision',
          updatedLabel: '38 minutes ago',
        },
        {
          id: 'proj_delivery',
          name: 'Delivery Platform',
          description: 'The engine behind every delivery',
          updatedLabel: '2 hours ago',
        },
      ],
      services: [
        {
          id: 'svc_maid_web',
          projectId: 'proj_maid',
          name: 'web',
          kind: 'application',
          framework: 'React',
          status: 'running',
        },
        {
          id: 'svc_maid_api',
          projectId: 'proj_maid',
          name: 'api',
          kind: 'application',
          framework: 'Express',
          status: 'running',
        },
        {
          id: 'svc_maid_db',
          projectId: 'proj_maid',
          name: 'maid-db',
          kind: 'database',
          framework: 'PostgreSQL',
          status: 'running',
        },
        {
          id: 'svc_maid_storage',
          projectId: 'proj_maid',
          name: 'media',
          kind: 'storage',
          framework: 'S3 compatible',
          status: 'active',
        },
        {
          id: 'svc_pulse',
          projectId: 'proj_pulse',
          name: 'dashboard',
          kind: 'application',
          framework: 'Next.js',
          status: 'running',
        },
        {
          id: 'svc_delivery',
          projectId: 'proj_delivery',
          name: 'delivery-api',
          kind: 'application',
          framework: 'NestJS',
          status: 'running',
        },
        {
          id: 'svc_delivery_db',
          projectId: 'proj_delivery',
          name: 'delivery-db',
          kind: 'database',
          framework: 'PostgreSQL',
          status: 'running',
        },
        {
          id: 'svc_cron',
          projectId: 'proj_delivery',
          name: 'Nightly sync',
          kind: 'cron',
          framework: 'Daily at 02:00',
          status: 'active',
        },
      ],
      domains: [
        {
          id: 'zone_maid',
          name: 'maid-finder.example',
          status: 'verified',
          dnsMode: 'manual',
          connections: 2,
        },
        {
          id: 'zone_pulse',
          name: 'pulse.example',
          status: 'verified',
          dnsMode: 'manual',
          connections: 1,
        },
        {
          id: 'zone_delivery',
          name: 'delivery.example',
          status: 'pending',
          dnsMode: 'manual',
          connections: 0,
        },
      ],
      activity: [
        {
          id: 'a1',
          title: 'Deployment is live',
          detail: 'web · Maid Finder',
          kind: 'application',
          timeLabel: '12 min ago',
        },
        {
          id: 'a2',
          title: 'Deployment is live',
          detail: 'dashboard · Pulse Analytics',
          kind: 'application',
          timeLabel: '38 min ago',
        },
        {
          id: 'a3',
          title: 'Database provisioned',
          detail: 'delivery-db · PostgreSQL',
          kind: 'database',
          timeLabel: '2 hr ago',
        },
        {
          id: 'a4',
          title: 'Cron job scheduled',
          detail: 'Nightly sync · Daily at 02:00',
          kind: 'cron',
          timeLabel: '3 hr ago',
        },
      ],
      server: {
        name: 'primary-vps',
        os: 'Ubuntu 24.04 LTS',
        health: 'healthy',
        observedAt: '2026-11-18T10:00:00Z',
        cpuPercent: 18,
        memoryUsedMb: 426,
        memoryTotalMb: 1024,
        diskUsedGb: 3.2,
        diskTotalGb: 10,
      },
    };
  }
}
