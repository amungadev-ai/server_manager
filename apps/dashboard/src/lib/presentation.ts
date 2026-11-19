import type { Service } from '@cloudlane/contracts/preview';
import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
export const capitalize = (value: string) =>
  value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
export const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
export const age = (value?: string) => {
  if (!value) return '—';
  const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000);
  return seconds < 60
    ? 'just now'
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
};
export const serviceDetail = (service?: Service) =>
  service ? infrastructure.preview?.services[service.id] : undefined;
export const serviceStatus = (service: Service) =>
  serviceDetail(service)?.displayStatus ?? service.status;
export const serviceIcon = (service: Service) =>
  service.kind === 'database'
    ? 'database'
    : service.kind === 'cron'
      ? 'clock'
      : service.kind === 'storage'
        ? 'bucket'
        : serviceDetail(service)?.role === 'api'
          ? 'code'
          : 'globe';
export const serviceTone = (service: Service) =>
  service.kind === 'database' || service.kind === 'storage'
    ? 'gold'
    : service.kind === 'cron'
      ? 'purple'
      : 'mint';
export const endpoint = (service: Service) =>
  infrastructure.preview?.hostnames.find(
    (host) => host.serviceId === service.id,
  )?.name ??
  infrastructure.preview?.platformDomains.find(
    (domain) => domain.serviceId === service.id,
  )?.name ??
  (service.kind === 'database'
    ? `${serviceDetail(service)?.database ?? 'Not reported'} · internal`
    : service.kind === 'cron'
      ? (serviceDetail(service)?.schedule ?? 'Not reported')
      : 'Not configured');
export const bytesHuman = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${bytes} B`;
