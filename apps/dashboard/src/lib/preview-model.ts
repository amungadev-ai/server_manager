/** Presentation-only details; never a wire response or an authorization decision. */
export interface ServiceDetail {
  created: string;
  role?: string;
  source?: string;
  repo?: string;
  branch?: string;
  fileName?: string;
  autoDeploy?: boolean;
  engine?: string;
  version?: string;
  database?: string;
  external?: boolean;
  allowedIp?: string;
  schedule?: string;
  timezone?: string;
  method?: string;
  target?: string;
  enabled?: boolean;
  provider?: string;
  region?: string;
  displayStatus?: string;
  activeDeployment?: string;
  backups?: { id: string; created: string; status: string }[];
  variables?: { key: string; value: string }[];
}
export interface PreviewModel {
  workspace: string;
  githubConnected: boolean;
  apiKeys: {
    id: string;
    name: string;
    scope: string;
    last4: string;
    created: string;
    revoked: boolean;
  }[];
  projectCreated: Record<string, string>;
  domainCreated: Record<string, string>;
  pendingDnsMode: Record<string, 'manual' | 'managed'>;
  services: Record<string, ServiceDetail>;
  hostnames: {
    id: string;
    zoneId: string;
    name: string;
    kind: string;
    serviceId: string | null;
  }[];
  platformDomains: {
    id: string;
    serviceId: string;
    name: string;
    status: string;
    https: boolean;
  }[];
  dns: {
    id: string;
    zoneId: string;
    type: string;
    name: string;
    value: string;
    ttl: number;
    priority?: number;
  }[];
  mailboxes: { id: string; zoneId: string; local: string; quota: number }[];
  aliases: { id: string; zoneId: string; local: string; target: string }[];
  deployments: {
    id: string;
    serviceId: string;
    status: string;
    stage?: number;
    revision: string;
    created: string;
    logs: string[];
  }[];
  cronRuns: {
    id: string;
    serviceId: string;
    status: string;
    created: string;
    duration: string;
    code: string;
  }[];
  buckets: {
    id: string;
    serviceId: string;
    name: string;
    purpose: string;
    maxMB: number;
  }[];
  objects: {
    id: string;
    bucketId: string;
    key: string;
    size: number;
    type: string;
    created: string;
  }[];
  grants: {
    id: string;
    storageId: string;
    bucketId: string;
    serviceId: string;
    scope: string;
  }[];
  volumes: {
    id: string;
    serviceId: string;
    name: string;
    mountPoint: string;
    quota: number;
  }[];
  dbUsers: {
    id: string;
    serviceId: string;
    username: string;
    privileges: string[];
    revoked: boolean;
  }[];
  serviceLinks: { id: string; from: string; to: string }[];
}
