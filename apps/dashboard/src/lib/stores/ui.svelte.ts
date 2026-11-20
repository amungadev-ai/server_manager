export const ui = $state({
  modal: null as string | null,
  modalBusy: false,
  modalData: {} as Record<string, string>,
  toast: null as { message: string; error: boolean } | null,
  assistantOpen: false,
  assistantPrompt: '',
  revealedKey: '',
});
let toastTimer: ReturnType<typeof setTimeout>;
export function openDialog(kind: string, data: Record<string, string> = {}) {
  ui.modalData = data;
  ui.modal = kind;
}
export function notify(message: string, error = false) {
  clearTimeout(toastTimer);
  ui.toast = { message, error };
  toastTimer = setTimeout(() => {
    ui.toast = null;
  }, 4400);
}
export function askAssistant(prompt = '') {
  ui.assistantPrompt = prompt;
  ui.assistantOpen = true;
}
export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    notify('Copied to clipboard.');
  } catch {
    notify('Clipboard access is unavailable in this browser.', true);
  }
}
