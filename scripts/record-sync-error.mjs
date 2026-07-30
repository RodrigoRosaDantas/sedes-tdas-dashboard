import { localDate, localIso, readJson, writeJson } from './notion/config.mjs';

const now = new Date().toISOString();
const previous = await readJson('data/sync-history.json', { entries: [] });
const detail = String(process.env.SYNC_ERROR_DETAIL || 'A execução falhou sem detalhe disponível.').slice(-5000);
const kind = process.env.SYNC_KIND === 'schedule' ? 'Sincronização agendada' : process.env.SYNC_KIND === 'workflow_dispatch' ? 'Sincronização manual' : 'Sincronização de preparação';
await writeJson('data/sync-history.json', {
  meta: { snapshotDate: localDate(now), examDate: '2026-09-06', syncTimes: ['00h50', '06h50', '12h50', '18h50'], version: '20.3' },
  entries: [{ at: localIso(now), kind, status: 'error', summary: 'Sincronização bloqueada antes da publicação', detail }, ...(previous.entries || [])].slice(0, 40)
});
