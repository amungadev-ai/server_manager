import type {
  InfrastructureApi,
  InfrastructureSnapshot,
} from '@cloudlane/contracts/preview';
import type { PreviewModel } from '#lib/preview-model.ts';

/** v1.13 presentation fixtures only; no credentials, bytes or resource persistence. */
export class DemoInfrastructureApi implements InfrastructureApi {
  readonly mode = 'demo' as const;
  readonly fixtureVersion = 'cloudlane-prototype-fixtures-v113';
  readonly details: PreviewModel;
  readonly snapshot: InfrastructureSnapshot;
  constructor() {
    const ago = (minutes: number) =>
      new Date(Date.now() - minutes * 60_000).toISOString();
    const projectRows = [
      ['proj_maid', 'Maid Finder', 600],
      ['proj_pulse', 'Pulse Analytics', 3000],
      ['proj_delivery', 'Delivery Platform', 2400],
      ['proj_external', 'External Services', 1300],
    ] as const;
    this.details = {
      workspace: 'Starter Workspace',
      githubConnected: false,
      apiKeys: [],
      domainCreated: { zone_example: ago(2100), zone_secondary: ago(240) },
      pendingDnsMode: {},
      projectCreated: Object.fromEntries(
        projectRows.map(([id, , minutes]) => [id, ago(minutes)]),
      ),
      services: {
        svc_pulse: {
          created: ago(2800),
          role: 'web',
          source: 'github',
          repo: 'demo/pulse-dashboard',
          branch: 'main',
          autoDeploy: true,
          variables: [{ key: 'NODE_ENV', value: 'production' }],
        },
        svc_api: {
          created: ago(2300),
          role: 'api',
          source: 'zip',
          fileName: 'delivery-api.zip',
          variables: [
            { key: 'NODE_ENV', value: 'production' },
            { key: 'PORT', value: '3000' },
          ],
        },
        svc_db: {
          created: ago(2200),
          engine: 'PostgreSQL',
          version: '16',
          database: 'delivery_prod',
          external: false,
        },
        svc_cron: {
          created: ago(1200),
          method: 'POST',
          target: 'https://example.org/api/sync',
          schedule: '0 2 * * *',
          timezone: 'Africa/Nairobi',
          enabled: true,
        },
        svc_maid_api: {
          created: ago(570),
          role: 'api',
          source: 'github',
          repo: 'demo/maidfinder-api',
          branch: 'main',
          autoDeploy: true,
          variables: [
            { key: 'NODE_ENV', value: 'production' },
            { key: 'MYSQL_HOST', value: 'maidfinder-db.internal' },
          ],
        },
        svc_maid_admin: {
          created: ago(540),
          role: 'web',
          source: 'github',
          repo: 'demo/maidfinder-admin',
          branch: 'main',
          autoDeploy: true,
          variables: [{ key: 'NODE_ENV', value: 'production' }],
        },
        svc_maid_db: {
          created: ago(520),
          engine: 'MySQL',
          version: '8.4',
          database: 'maidfinder_prod',
          external: false,
        },
        svc_maid_cron: {
          created: ago(470),
          method: 'POST',
          target: 'https://api.example.test/tasks/cleanup',
          schedule: '0 2 * * *',
          timezone: 'Africa/Nairobi',
          enabled: true,
        },
        svc_maid_media: {
          created: ago(450),
          provider: 'External S3-compatible',
          region: 'External region',
          displayStatus: 'ready',
        },
      },
      hostnames: [
        {
          id: 'host_root',
          zoneId: 'zone_example',
          name: 'example.com',
          kind: 'apex',
          serviceId: null,
        },
        {
          id: 'host_www',
          zoneId: 'zone_example',
          name: 'www.example.com',
          kind: 'subdomain',
          serviceId: null,
        },
        {
          id: 'host_api',
          zoneId: 'zone_example',
          name: 'api.example.com',
          kind: 'subdomain',
          serviceId: null,
        },
        {
          id: 'host_admin',
          zoneId: 'zone_example',
          name: 'admin.example.com',
          kind: 'subdomain',
          serviceId: null,
        },
        {
          id: 'host_example_org',
          zoneId: 'zone_secondary',
          name: 'example.org',
          kind: 'apex',
          serviceId: null,
        },
      ],
      platformDomains: [
        {
          id: 'dom_pulse',
          serviceId: 'svc_pulse',
          name: 'pulse.apps.example.test',
          status: 'active',
          https: true,
        },
        {
          id: 'dom_api',
          serviceId: 'svc_api',
          name: 'api.apps.example.test',
          status: 'active',
          https: true,
        },
        {
          id: 'dom_maid_api',
          serviceId: 'svc_maid_api',
          name: 'maidfinder-api.apps.example.test',
          status: 'active',
          https: true,
        },
        {
          id: 'dom_maid_admin',
          serviceId: 'svc_maid_admin',
          name: 'maidfinder-admin.apps.example.test',
          status: 'active',
          https: true,
        },
      ],
      dns: [
        {
          id: 'rec_a',
          zoneId: 'zone_example',
          type: 'A',
          name: '@',
          value: '203.0.113.42',
          ttl: 3600,
        },
        {
          id: 'rec_www',
          zoneId: 'zone_example',
          type: 'CNAME',
          name: 'www',
          value: 'example.com',
          ttl: 3600,
        },
        {
          id: 'rec_mx',
          zoneId: 'zone_example',
          type: 'MX',
          name: '@',
          value: 'mail.example.com',
          priority: 10,
          ttl: 3600,
        },
        {
          id: 'rec_spf',
          zoneId: 'zone_example',
          type: 'TXT',
          name: '@',
          value: 'v=spf1 -all',
          ttl: 3600,
        },
        {
          id: 'rec_verify',
          zoneId: 'zone_secondary',
          type: 'TXT',
          name: '_cloudlane',
          value: 'cloudlane-verify-demo',
          ttl: 3600,
        },
      ],
      mailboxes: [
        {
          id: 'mail_demo_admin',
          zoneId: 'zone_example',
          local: 'admin',
          quota: 250,
        },
        {
          id: 'mail_demo_support',
          zoneId: 'zone_example',
          local: 'support',
          quota: 100,
        },
      ],
      aliases: [
        {
          id: 'alias_hello',
          zoneId: 'zone_example',
          local: 'hello',
          target: 'admin@example.com',
        },
      ],
      deployments: [
        {
          id: 'dep_pulse',
          serviceId: 'svc_pulse',
          status: 'LIVE',
          revision: 'a8f27c1',
          created: ago(810),
          logs: [
            '[SOURCE] Retrieved demo/pulse-dashboard · main',
            '[BUILD] Next.js build completed',
            '[HEALTH] Candidate service healthy',
            '[ROUTE] Release activated',
          ],
        },
        {
          id: 'dep_api',
          serviceId: 'svc_api',
          status: 'LIVE',
          revision: 'zip-001',
          created: ago(510),
          logs: [
            '[SOURCE] Read delivery-api.zip',
            '[BUILD] NestJS build completed',
            '[HEALTH] /health returned 200',
            '[ROUTE] Release activated',
          ],
        },
        {
          id: 'dep_maid_api',
          serviceId: 'svc_maid_api',
          status: 'LIVE',
          revision: 'sample-api-01',
          created: ago(570),
          logs: [
            '[BUILD] Express API compiled (synthetic)',
            '[HEALTH] Candidate healthy (simulated)',
          ],
        },
        {
          id: 'dep_maid_admin',
          serviceId: 'svc_maid_admin',
          status: 'LIVE',
          revision: 'sample-admin-01',
          created: ago(530),
          logs: [
            '[BUILD] Next.js built (synthetic)',
            '[ROUTE] HTTPS endpoint assigned (simulated)',
          ],
        },
      ],
      cronRuns: [
        {
          id: 'run_seed',
          serviceId: 'svc_cron',
          status: 'success',
          created: ago(250),
          duration: '416ms',
          code: '200 OK',
        },
      ],
      buckets: [
        {
          id: 'bucket_kyc',
          serviceId: 'svc_maid_media',
          name: 'maidfinder-kyc',
          purpose: 'Sensitive identity verification documents',
          maxMB: 500,
        },
        {
          id: 'bucket_profiles',
          serviceId: 'svc_maid_media',
          name: 'maidfinder-profiles',
          purpose: 'Profile photographs',
          maxMB: 250,
        },
      ],
      objects: [
        {
          id: 'obj_kyc_1',
          bucketId: 'bucket_kyc',
          key: 'sample-user-001/id-front.jpg',
          size: 483200,
          type: 'image/jpeg',
          created: ago(425),
        },
        {
          id: 'obj_kyc_2',
          bucketId: 'bucket_kyc',
          key: 'sample-user-001/id-back.jpg',
          size: 379000,
          type: 'image/jpeg',
          created: ago(424),
        },
        {
          id: 'obj_kyc_3',
          bucketId: 'bucket_kyc',
          key: 'sample-user-001/selfie.jpg',
          size: 299200,
          type: 'image/jpeg',
          created: ago(423),
        },
        {
          id: 'obj_profile_1',
          bucketId: 'bucket_profiles',
          key: 'sample-user-001/avatar.webp',
          size: 92000,
          type: 'image/webp',
          created: ago(420),
        },
      ],
      grants: [
        {
          id: 'grant_maid_api',
          storageId: 'svc_maid_media',
          bucketId: 'bucket_kyc',
          serviceId: 'svc_maid_api',
          scope: 'read-write',
        },
      ],
      volumes: [],
      serviceLinks: [],
      dbUsers: [
        {
          id: 'dbuser_delivery',
          serviceId: 'svc_db',
          username: 'delivery_db_app',
          privileges: [
            'CONNECT',
            'USAGE',
            'SELECT',
            'INSERT',
            'UPDATE',
            'DELETE',
          ],
          revoked: false,
        },
      ],
    };
    const rows = [
      [
        'svc_pulse',
        'proj_pulse',
        'dashboard',
        'application',
        'Next.js',
        'running',
      ],
      [
        'svc_api',
        'proj_delivery',
        'delivery-api',
        'application',
        'NestJS',
        'running',
      ],
      [
        'svc_db',
        'proj_delivery',
        'delivery-db',
        'database',
        'PostgreSQL',
        'running',
      ],
      [
        'svc_cron',
        'proj_external',
        'Nightly sync',
        'cron',
        'Scheduled HTTP',
        'active',
      ],
      [
        'svc_maid_api',
        'proj_maid',
        'maidfinder-api',
        'application',
        'Node.js/Express',
        'running',
      ],
      [
        'svc_maid_admin',
        'proj_maid',
        'maidfinder-admin',
        'application',
        'Next.js',
        'running',
      ],
      [
        'svc_maid_db',
        'proj_maid',
        'maidfinder-db',
        'database',
        'MySQL',
        'running',
      ],
      [
        'svc_maid_cron',
        'proj_maid',
        'KYC cleanup',
        'cron',
        'Scheduled HTTP',
        'active',
      ],
      [
        'svc_maid_media',
        'proj_maid',
        'maidfinder-media',
        'storage',
        'External S3-compatible',
        'active',
      ],
    ] as const;
    this.snapshot = {
      projects: projectRows.map(([id, name, minutes]) => ({
        id,
        name,
        description: '',
        updatedLabel:
          minutes < 1440
            ? `${Math.floor(minutes / 60)}h ago`
            : `${Math.floor(minutes / 1440)}d ago`,
      })),
      services: rows.map(([id, projectId, name, kind, framework, status]) => ({
        id,
        projectId,
        name,
        kind,
        framework,
        status,
      })),
      domains: [
        {
          id: 'zone_example',
          name: 'example.com',
          status: 'verified',
          dnsMode: 'manual',
          connections: 0,
        },
        {
          id: 'zone_secondary',
          name: 'example.org',
          status: 'pending',
          dnsMode: 'managed',
          connections: 0,
        },
      ],
      activity: [
        {
          id: 'a1',
          title: 'Deployment is live',
          detail: 'dashboard · Pulse Analytics',
          kind: 'application',
          timeLabel: '13h ago',
        },
        {
          id: 'a2',
          title: 'Database provisioned',
          detail: 'delivery-db · PostgreSQL',
          kind: 'database',
          timeLabel: '20h ago',
        },
        {
          id: 'a3',
          title: 'Cron job scheduled',
          detail: 'Nightly sync · Daily at 02:00',
          kind: 'cron',
          timeLabel: '21h ago',
        },
      ],
      server: {
        name: 'primary-vps',
        os: 'Ubuntu 24.04 LTS',
        health: 'healthy',
        observedAt: new Date().toISOString(),
        cpuPercent: 23,
        memoryUsedMb: 522,
        memoryTotalMb: 1024,
        diskUsedGb: 4.6,
        diskTotalGb: 10,
      },
    };
  }
  async getSnapshot(signal?: AbortSignal): Promise<InfrastructureSnapshot> {
    signal?.throwIfAborted();
    return this.snapshot;
  }
}
