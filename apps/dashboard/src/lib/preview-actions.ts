import { infrastructure } from '#lib/stores/infrastructure.svelte.ts';
import { notify } from '#lib/stores/ui.svelte.ts';
import type { PreviewModel } from '#lib/preview-model.ts';
import type { InfrastructureSnapshot } from '@cloudlane/contracts/preview';

/** Every presentation mutation stops at this explicit demo boundary. */
export function previewAction(
  action: (model: PreviewModel, snapshot: InfrastructureSnapshot) => void,
  message = 'Updated in this simulation only.',
) {
  if (
    import.meta.env.VITE_CLOUDLANE_DATA_MODE !== 'demo' ||
    !infrastructure.preview ||
    !infrastructure.data
  ) {
    notify(
      'This action requires the connected Cloudlane API. No infrastructure was changed.',
      true,
    );
    return false;
  }
  action(infrastructure.preview, infrastructure.data);
  notify(message);
  return true;
}
export const previewId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
