import type {
  InfrastructureApi,
  InfrastructureSnapshot,
} from '@cloudlane/contracts/preview';
import { HttpInfrastructureApi } from '#lib/api/http.ts';
import type { PreviewModel } from '#lib/preview-model.ts';

export const infrastructure = $state({
  mode: import.meta.env.VITE_CLOUDLANE_DATA_MODE === 'demo' ? 'demo' : 'http',
  status: 'loading' as 'loading' | 'ready' | 'error',
  data: null as InfrastructureSnapshot | null,
  error: '',
  preview: null as PreviewModel | null,
});

export async function loadInfrastructure(signal?: AbortSignal) {
  infrastructure.status = 'loading';
  infrastructure.error = '';
  infrastructure.data = null;
  infrastructure.preview = null;
  try {
    let api: InfrastructureApi = new HttpInfrastructureApi();
    if (import.meta.env.VITE_CLOUDLANE_DATA_MODE === 'demo') {
      const { DemoInfrastructureApi } = await import('#lib/api/demo.ts');
      const demo = new DemoInfrastructureApi();
      api = demo;
      infrastructure.preview = demo.details;
    }
    const data = await api.getSnapshot(signal);
    if (signal?.aborted) return;
    infrastructure.data = data;
    infrastructure.status = 'ready';
  } catch (error) {
    if (signal?.aborted) return;
    infrastructure.status = 'error';
    infrastructure.error =
      error instanceof Error ? error.message : 'Unable to load workspace.';
  }
}
