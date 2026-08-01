import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [store, player, transaction, contracts, packageText] = await Promise.all([
  read('assets/integration/attempt-store.js'),
  read('assets/integration/player.js'),
  read('assets/integration/completion-transaction.js'),
  read('assets/integration/contracts.js'),
  read('package.json'),
]);

required(store.includes("from './contracts.js?v=1.0.0'"), 'O histórico não reutiliza o contrato central.');
required(store.includes('STORAGE_KEYS.attempts'), 'O histórico não usa a chave oficial de tentativas.');
required(contracts.includes("attempts: `${STORAGE_PREFIX}attempts`"), 'A chave de tentativas não existe no contrato central.');
required(store.includes('MAX_LOCAL_ATTEMPTS = 100'), 'O limite de tentativas locais diverge do plano.');
required(store.includes("ATTEMPT_MODES = Object.freeze(['pilot', 'review', 'legacy'])"), 'Modos piloto, revisão e legado não estão declarados.');
required(store.includes("INTERACTIVE_ATTEMPT_MODES = Object.freeze(['pilot', 'review'])"), 'Modo legado não está bloqueado na criação interativa.');
required(store.includes("profileId: 'rodrigo'") && store.includes("cargoCode: '202'"), 'Perfil ou cargo não estão fixados no registro interativo.');
required(store.includes('pilot: true') && store.includes('officialProgress: false') && store.includes('notionWriteback: false'), 'Isolamento do piloto ausente no registro.');
required(store.includes("attempt.mode === 'legacy'") && store.includes("attempt.pilot !== false"), 'Isolamento do histórico legado ausente.');
required(store.includes("sourceSystem !== 'sedes-df-questoes'"), 'Procedência do histórico legado não é exigida.');
required(store.includes("mode === 'review' && !sourceReviewId"), 'Tentativa de revisão não exige origem.');
required(store.includes("sourceReviewId: mode === 'review'"), 'Origem da revisão não é preservada.');
required(!/notion\.com|api\.notion/i.test(store), 'O armazenamento não pode acessar o Notion.');
required(!/fetch\s*\(/.test(store), 'O armazenamento não pode realizar requisições de rede.');
required(!/sessionStorage|indexedDB/.test(store), 'Mecanismo de persistência não autorizado.');
required(store.includes('Histórico local de tentativas corrompido'), 'Proteção contra corrupção ausente.');
required(store.includes('filter(item => item.id !== valid.id)'), 'Deduplicação por ID ausente.');

required(player.includes("import {createAttemptRecord} from './attempt-store.js?v=1.0.0'"), 'O player não cria o registro pelo módulo controlado.');
required(!/localStorage|sessionStorage|indexedDB/.test(player), 'O player acessa diretamente o armazenamento.');
const evaluatePosition = player.indexOf('state.evaluation = evaluateSession');
const recordPosition = player.indexOf('state.attemptRecord = createAttemptRecord');
const commitPosition = player.indexOf('commitCompletedAttempt(state.attemptRecord');
required(evaluatePosition >= 0 && recordPosition > evaluatePosition && commitPosition > recordPosition, 'Ordem correção → registro → commit inválida.');
required(transaction.includes('const savedAttempt = saveAttempt(attempt, target)'), 'Transação não salva a tentativa pelo módulo oficial.');
required(player.includes('Nenhum dado foi enviado ao Notion ou ao progresso oficial'), 'A interface não informa o isolamento externo.');
required(packageText.includes('check:attempts') && packageText.includes('test:attempts'), 'Comandos de validação das tentativas ausentes.');

console.log('Histórico local validado: piloto/revisão interativos, legado isolado, deduplicação, limite e zero writeback.');
