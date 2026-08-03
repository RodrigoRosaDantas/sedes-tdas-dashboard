import {loadJSON, setupShell, escapeHTML, setLoadingError} from '../common.js';

export const BACKUP_KIND = 'tdas-local-backup';
export const BACKUP_VERSION = 1;
export const DAILY_STORAGE_KEY = 'tdas.202.daily-execution.v1';
export const MODULE_STORAGE_KEY = 'tdas.202.question-module.v2.state';
const MODULE_SCHEMA = '2.0.0';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function') {
    throw new TypeError('O armazenamento local não está disponível neste navegador.');
  }
  return target;
}

function normalizePe(value) {
  const number = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isInteger(number) && number >= 1 && number <= 112
    ? `PE${String(number).padStart(2, '0')}`
    : null;
}

export function validateDailyStore(value) {
  if (value === null) return null;
  if (!isObject(value) || value.version !== 1 || !isObject(value.items)) {
    throw new Error('O acompanhamento diário do backup é incompatível.');
  }
  const items = {};
  for (const [key, raw] of Object.entries(value.items)) {
    const pe = normalizePe(key);
    if (!pe || pe !== key || !isObject(raw)) throw new Error(`Progresso diário inválido: ${key}.`);
    items[pe] = {
      material: raw.material === true,
      questions: raw.questions === true,
      registered: raw.registered === true,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    };
  }
  return {version: 1, items};
}

export function validateModuleStore(value) {
  if (value === null) return null;
  if (!isObject(value) || value.schemaVersion !== MODULE_SCHEMA) {
    throw new Error('Os dados do módulo de questões são incompatíveis.');
  }
  const clean = {
    schemaVersion: MODULE_SCHEMA,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : null,
  };
  for (const key of ['attempts', 'errors', 'marked', 'reviews', 'aiQueue']) {
    if (!Array.isArray(value[key])) throw new Error(`Coleção inválida no backup: ${key}.`);
    clean[key] = value[key].map(item => {
      if (!isObject(item)) throw new Error(`Registro inválido na coleção ${key}.`);
      return {...item};
    });
  }
  return clean;
}

function parseStoredValue(storage, key, validator) {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return validator(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Não foi possível ler ${key}: ${error.message}`);
  }
}

export function summarizeBackup(backup) {
  const dailyItems = Object.values(backup.stores.dailyExecution?.items || {});
  const module = backup.stores.questionModule;
  return Object.freeze({
    peWithProgress: dailyItems.filter(item => item.material || item.questions || item.registered).length,
    completedSteps: dailyItems.reduce((total, item) => total + Number(item.material) + Number(item.questions) + Number(item.registered), 0),
    attempts: module?.attempts.length || 0,
    errors: module?.errors.length || 0,
    reviews: module?.reviews.length || 0,
    aiQueue: module?.aiQueue.length || 0,
  });
}

export function createLocalBackup(storage, now = new Date().toISOString()) {
  const target = resolveStorage(storage);
  const backup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    app: 'sedes-tdas-dashboard',
    exportedAt: String(now),
    stores: {
      dailyExecution: parseStoredValue(target, DAILY_STORAGE_KEY, validateDailyStore),
      questionModule: parseStoredValue(target, MODULE_STORAGE_KEY, validateModuleStore),
    },
  };
  return Object.freeze({...backup, summary: summarizeBackup(backup)});
}

export function parseLocalBackup(text) {
  let raw;
  try {
    raw = JSON.parse(String(text));
  } catch {
    throw new Error('O arquivo selecionado não contém JSON válido.');
  }
  if (!isObject(raw) || raw.kind !== BACKUP_KIND || raw.version !== BACKUP_VERSION || !isObject(raw.stores)) {
    throw new Error('Este arquivo não é um backup compatível da Plataforma TDAS.');
  }
  const backup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    app: 'sedes-tdas-dashboard',
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
    stores: {
      dailyExecution: validateDailyStore(raw.stores.dailyExecution ?? null),
      questionModule: validateModuleStore(raw.stores.questionModule ?? null),
    },
  };
  return Object.freeze({...backup, summary: summarizeBackup(backup)});
}

function writeStore(storage, key, value) {
  if (value === null) storage.removeItem?.(key);
  else storage.setItem(key, JSON.stringify(value));
}

export function restoreLocalBackup(backup, storage) {
  const target = resolveStorage(storage);
  const clean = parseLocalBackup(JSON.stringify(backup));
  const previous = new Map([
    [DAILY_STORAGE_KEY, target.getItem(DAILY_STORAGE_KEY)],
    [MODULE_STORAGE_KEY, target.getItem(MODULE_STORAGE_KEY)],
  ]);
  try {
    writeStore(target, DAILY_STORAGE_KEY, clean.stores.dailyExecution);
    writeStore(target, MODULE_STORAGE_KEY, clean.stores.questionModule);
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value === null) target.removeItem?.(key);
        else target.setItem(key, value);
      } catch {}
    }
    throw new Error(`A restauração foi revertida: ${error.message}`);
  }
  return clean.summary;
}

function downloadBackup(backup) {
  const date = String(backup.exportedAt || new Date().toISOString()).slice(0, 10);
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tdas-backup-local-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function installStyles() {
  if (document.querySelector('[data-local-backup-style]')) return;
  const style = document.createElement('style');
  style.dataset.localBackupStyle = '1';
  style.textContent = `
    .backup-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px}.backup-note{margin-top:14px;color:var(--muted)}
    .backup-status{margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .backup-status[data-state="success"]{border-color:var(--green)}.backup-status[data-state="error"]{border-color:var(--red)}
    .backup-file{margin-top:16px}.backup-file[hidden]{display:none}.backup-file dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 0}
    .backup-file dl div{padding:12px;border:1px solid var(--line);border-radius:12px}.backup-file dt{color:var(--muted);font-size:.86rem}.backup-file dd{margin:4px 0 0;font-weight:800}
    @media(max-width:760px){.backup-actions{display:grid}.backup-actions .btn{width:100%}.backup-file dl{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function summaryCards(summary) {
  return [
    ['PE com progresso', summary.peWithProgress, 'Acompanhamento diário neste dispositivo'],
    ['Etapas marcadas', summary.completedSteps, 'Material, questões e registro'],
    ['Tentativas locais', summary.attempts, 'Sessões concluídas no módulo'],
    ['Erros locais', summary.errors, 'Erros confirmados no módulo'],
    ['Revisões locais', summary.reviews, 'Agenda D+1, D+7 e D+20'],
    ['Fila de IA', summary.aiQueue, 'Ressalvas aguardando análise'],
  ].map(([label, value, detail]) => `<article class="card metric"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><span>${escapeHTML(detail)}</span></article>`).join('');
}

function selectedBackupMarkup(file, backup) {
  const summary = backup.summary;
  return `<h3>Backup selecionado</h3><p><strong>${escapeHTML(file.name)}</strong><br>Exportado em ${escapeHTML(backup.exportedAt || 'data não registrada')}.</p><dl><div><dt>PE com progresso</dt><dd>${summary.peWithProgress}</dd></div><div><dt>Tentativas</dt><dd>${summary.attempts}</dd></div><div><dt>Revisões</dt><dd>${summary.reviews}</dd></div></dl><p class="backup-note">A restauração substituirá os dois conjuntos de dados locais atuais. Os bancos do Notion não serão alterados.</p>`;
}

async function renderPage() {
  const data = await loadJSON('data/more.json');
  setupShell('mais', data.meta);
  installStyles();
  const main = document.querySelector('main');
  main.innerHTML = `<section class="hero"><span class="kicker">Proteção dos dados do navegador</span><h1>Backup dos dados locais</h1><p>Baixe um arquivo com o acompanhamento diário e o histórico do módulo de questões. O arquivo não é enviado para servidor, GitHub ou Notion.</p></section><section class="section"><div class="section-head"><div><h2>Resumo deste dispositivo</h2><p>Somente dados criados localmente no navegador.</p></div></div><div class="grid three" data-current-summary></div></section><section class="section"><div class="grid two"><article class="card panel"><h3>1 · Baixar backup</h3><p>Guarde o arquivo em local seguro antes de limpar o navegador, reinstalar o aplicativo ou trocar de aparelho.</p><div class="backup-actions"><button type="button" class="btn primary" data-export-backup>Baixar backup JSON</button></div></article><article class="card panel"><h3>2 · Restaurar backup</h3><p>Selecione um arquivo gerado por esta página. A restauração só ocorre depois de uma confirmação adicional.</p><input type="file" id="backup-file" accept="application/json,.json" hidden><div class="backup-actions"><label class="btn" for="backup-file">Selecionar arquivo</label><button type="button" class="btn primary" data-restore-backup disabled>Restaurar backup</button></div><div class="backup-file card" data-selected-backup hidden></div></article></div><div class="backup-status" data-backup-status aria-live="polite">Nenhuma operação realizada.</div><p class="backup-note">Este recurso não substitui os registros oficiais dos bancos do Notion. Ele protege apenas as marcações e sessões salvas neste dispositivo.</p></section><footer class="footer"><span>Dados locais · backup manual</span><span>Sem servidor e sem writeback</span></footer>`;

  const summaryNode = main.querySelector('[data-current-summary]');
  const statusNode = main.querySelector('[data-backup-status]');
  const exportButton = main.querySelector('[data-export-backup]');
  const restoreButton = main.querySelector('[data-restore-backup]');
  const fileInput = main.querySelector('#backup-file');
  const selectedNode = main.querySelector('[data-selected-backup]');
  let selectedBackup = null;

  const setStatus = (message, state = 'neutral') => {
    statusNode.textContent = message;
    statusNode.dataset.state = state;
  };
  const refreshSummary = () => {
    try {
      const backup = createLocalBackup();
      summaryNode.innerHTML = summaryCards(backup.summary);
      exportButton.disabled = false;
      return backup;
    } catch (error) {
      summaryNode.innerHTML = `<article class="card alert" data-level="critical"><span class="alert-icon">!</span><div><b>Dados locais precisam de recuperação</b><p>${escapeHTML(error.message)}</p></div></article>`;
      exportButton.disabled = true;
      return null;
    }
  };

  refreshSummary();
  exportButton.addEventListener('click', () => {
    try {
      downloadBackup(createLocalBackup());
      setStatus('Backup baixado. Guarde o arquivo em local seguro.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
  fileInput.addEventListener('change', async () => {
    selectedBackup = null;
    restoreButton.disabled = true;
    selectedNode.hidden = true;
    const [file] = fileInput.files || [];
    if (!file) return;
    try {
      selectedBackup = parseLocalBackup(await file.text());
      selectedNode.innerHTML = selectedBackupMarkup(file, selectedBackup);
      selectedNode.hidden = false;
      restoreButton.disabled = false;
      setStatus('Arquivo válido. Revise o resumo e confirme a restauração.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
  restoreButton.addEventListener('click', () => {
    if (!selectedBackup) return;
    if (!confirm('Restaurar este backup e substituir os dados locais atuais?')) return;
    try {
      restoreLocalBackup(selectedBackup);
      refreshSummary();
      selectedBackup = null;
      fileInput.value = '';
      selectedNode.hidden = true;
      restoreButton.disabled = true;
      setStatus('Backup restaurado com sucesso neste dispositivo.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
}

if (typeof document !== 'undefined') renderPage().catch(setLoadingError);
