import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [progress, transaction, player, panel, pePage, contracts, packageText] = await Promise.all([
  read('assets/integration/pe-progress-store.js'),
  read('assets/integration/completion-transaction.js'),
  read('assets/integration/player.js'),
  read('assets/integration/pe-pilot-status.js'),
  read('pe/76/index.html'),
  read('assets/integration/contracts.js'),
  read('package.json'),
]);

required(progress.includes('STORAGE_KEYS.peProgress'), 'Progresso do PE não usa a chave oficial.');
required(contracts.includes("peProgress: `${STORAGE_PREFIX}peProgress`"), 'Chave de progresso do PE ausente do contrato.');
required(progress.includes("scope: 'pilot-local'"), 'Escopo local do PE não está fixado.');
required(progress.includes('officialCompleted: false') && progress.includes("officialStatus: 'not_modified'") && progress.includes('notionWriteback: false'), 'Separação oficial do PE incompleta.');
required(progress.includes('11[0-2]'), 'Limite superior PE112 ausente.');
required(!progress.includes('1[01]\\d|112'), 'Expressão antiga que aceitava PE113–PE119 ainda presente.');
required(progress.includes('alreadyRecorded'), 'Deduplicação do progresso do PE ausente.');
required(progress.includes('pilotAttempts') && progress.includes('reviewAttempts'), 'Contadores piloto/revisão ausentes.');
required(progress.includes('bestPercent') && progress.includes('latestPercent'), 'Métricas locais do PE ausentes.');
required(!/notion\.com|api\.notion/i.test(progress), 'Progresso local não pode acessar o Notion.');
required(!/fetch\s*\(/.test(progress), 'Progresso local não pode realizar requisições.');

for (const key of ['attempts','errors','marked','reviews','peProgress']) required(transaction.includes(`STORAGE_KEYS.${key}`), `Chave transacional ausente: ${key}.`);
for (const operation of ['saveAttempt','syncAttemptIndexes','scheduleAttemptReviews','completeReview','recordAttemptPeProgress']) required(transaction.includes(operation), `Operação transacional ausente: ${operation}.`);
required(transaction.includes('snapshotStorage') && transaction.includes('restoreStorage'), 'Snapshot ou rollback ausente.');
required(transaction.includes('transactionError.rolledBack = true'), 'Falha transacional não informa rollback.');
required(transaction.includes("attempt.mode === 'review'"), 'Transação não separa piloto e revisão.');
required(!/notion\.com|api\.notion/i.test(transaction), 'Transação não pode acessar o Notion.');

required(player.includes("from './completion-transaction.js?v=1.0.0'"), 'Player não usa a transação central.');
required(player.includes('commitCompletedAttempt(state.attemptRecord, {includeD0: false})'), 'Player não conclui atomicamente.');
for (const forbidden of ['saveAttempt(', 'syncAttemptIndexes(', 'scheduleAttemptReviews(', 'completeReview(', 'recordAttemptPeProgress(']) {
  required(!player.includes(forbidden), `Player executa operação fora da transação: ${forbidden}.`);
}
required(player.includes("if (review.dueAt > Date.now())"), 'URL manual não bloqueia revisão futura.');
required(player.includes('scope=pilot-local') && player.includes('officialCompleted=false') && player.includes('notionWriteback=false'), 'Resultado não declara separação do PE.');

required(pePage.includes('/assets/integration/pe-pilot-status.js'), 'PE76 não carrega o painel piloto local.');
required(panel.includes("readPeProgress('PE76')"), 'Painel não lê o progresso local do PE76.');
required(panel.includes('Indicadores deste dispositivo, separados do registro oficial acima'), 'Painel não distingue dados locais e oficiais.');
required(panel.includes('officialCompleted=false') && panel.includes('officialStatus=not_modified') && panel.includes('notionWriteback=false'), 'Painel não exibe as garantias de separação.');
required(!/setItem|removeItem|recordAttemptPeProgress/.test(panel), 'Painel do PE não pode escrever dados.');
required(packageText.includes('check:pe') && packageText.includes('test:pe'), 'Comandos da integração com PE ausentes.');

console.log('Integração PE validada: progresso piloto separado, transação atômica, rollback, revisão futura bloqueada e painel PE76 somente leitura.');
