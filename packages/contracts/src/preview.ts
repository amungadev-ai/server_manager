import type { z } from 'zod';
import type { OverviewResponseSchema, ServiceKindSchema } from './api.js';
/** Synthetic identifiers are presentation-only. HTTP data must pass the API schemas. */
type WireSnapshot = z.infer<typeof OverviewResponseSchema>;
export type ServiceKind = z.infer<typeof ServiceKindSchema>;
export type Project = Omit<WireSnapshot['projects'][number], 'id'> & {
  id: string;
};
export type Service = Omit<
  WireSnapshot['services'][number],
  'id' | 'projectId'
> & { id: string; projectId: string };
export type DomainZone = Omit<WireSnapshot['domains'][number], 'id'> & {
  id: string;
};
export type Activity = Omit<WireSnapshot['activity'][number], 'id'> & {
  id: string;
};
export interface InfrastructureSnapshot extends Omit<
  WireSnapshot,
  'projects' | 'services' | 'domains' | 'activity'
> {
  projects: Project[];
  services: Service[];
  domains: DomainZone[];
  activity: Activity[];
}
export interface InfrastructureApi {
  readonly mode: 'demo' | 'http';
  getSnapshot(signal?: AbortSignal): Promise<InfrastructureSnapshot>;
}
