import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [scheduler, store, transaction, player, pageScript, reviewPage, attempts, contracts, packageText] = await Promise.all([
  read('assets/integration/review-scheduler.js'),
  read('assets/integration/review-store.js'),
  read('assets/integration/completion-transaction.js'),
  read('assets/integration/player.js'),
  read('assets/integration/reviews.js'),
  read('revisar/index.html'),
  read('assets/integration/attempt-store.js'),
  read('assets/integration/contracts.js'),
  read('package.json'),
]);

required(scheduler.includes("import {REVIEW_STAGES} from './contracts.js?v=1.0.0'"), 'A agenda não reutiliza as etapas do contrato central.');
for (const stage of ['D+1','D+7','D+20']) required(scheduler.includes(`'${stage}'`), `Etapa ${stage} ausente.`);
required(scheduler.includes("includeD0 = false"), 'D0 não está desativado por padrão.');
required(scheduler.includes("includeD0 ? ['D0', ...REVIEW_STAGES]"), 'D0 excepcional não está implementado como opt-in.');
for (const classification of ['incorrect_confirmed','correct_with_doubt','correct_by_guess','marked']) required(scheduler.includes(`'${classification}'`), `Classificação revisável ausente: ${classification}.`);
for (const excluded of ['correct_secure','annulment_pending','source_error']) required(!scheduler.match(new RegExp(`REVIEW_ELIGIBLE_CLASSIFICATIONS[\\s\\S]{0,300}'${excluded}'`)), `Classificação indevida na agenda: ${excluded}.`);

required(store.includes('STORAGE_KEYS.reviews'), 'Agenda não usa a chave oficial de revisões.');
required(contracts.includes("reviews: `${STORAGE_PREFIX}reviews`"), 'Chave de revisões ausente do contrato.');
required(store.includes('scheduleAttemptReviews') && store.includes('completeReview') && store.includes('readDueReviews'), 'Operações essenciais da agenda ausentes.');
required(store.includes('Agenda local de revisões corrompida'), 'Proteção contra corrupção ausente.');
for (const content of [scheduler, store, pageScript]) {
  required(!/notion\.com|api\.notion/i.test(content), 'Revisões não podem acessar o Notion.');
  required(!/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(content), 'Revisões não podem escrever por rede.');
}
required(!/fetch\s*\(/.test(store), 'Armazenamento de revisões não pode realizar fetch.');
required(!pageScript.includes('pe76-key.json'), 'A página de agenda não pode carregar o gabarito.');
required(pageScript.includes('Ainda não disponível'), 'A agenda não bloqueia visualmente itens futuros.');
required(reviewPage.includes('/assets/integration/reviews.js'), 'A rota Revisar não carrega a agenda funcional.');
required(!reviewPage.includes('/assets/integration/navigation.js'), 'A rota Revisar ainda carrega a estrutura antiga.');

required(attempts.includes("ATTEMPT_MODES = Object.freeze(['pilot', 'review'])"), 'Tentativas não distinguem revisão.');
required(/sourceReviewId\s*:\s*mode\s*===\s*'review'/.test(attempts), 'Tentativa não preserva a revisão de origem.');
required(transaction.includes("attempt.mode === 'review'") && transaction.includes('completeReview') && transaction.includes('scheduleAttemptReviews'), 'Transação não separa criação e conclusão das revisões.');
required(transaction.includes('scheduleAttemptReviews(attempt, target, {includeD0})'), 'Transação não controla D0 explicitamente.');
required(player.includes('commitCompletedAttempt(state.attemptRecord, {includeD0: false})'), 'Player não mantém D0 desativado.');
required(player.includes("mode: isReviewMode() ? 'review' : 'pilot'"), 'Modo da tentativa não acompanha o contexto.');
required(player.includes('sem nova agenda') && player.includes("if (review.dueAt > Date.now())"), 'Player não bloqueia recursão ou revisão futura.');
required(packageText.includes('check:reviews') && packageText.includes('test:reviews'), 'Comandos das revisões ausentes.');

console.log('Revisões validadas: D+1/D+7/D+20, D0 opt-in, agenda local, transação sem recursão e abertura futura bloqueada.');
