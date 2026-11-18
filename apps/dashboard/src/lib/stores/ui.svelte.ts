export const ui = $state({
  modal: null as
    | null
    | 'create'
    | 'project'
    | 'domain'
    | 'application'
    | 'database'
    | 'cron'
    | 'storage'
    | 'assistant',
});
