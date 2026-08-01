import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [store, player, contracts, packageText] = await Promise.all([
  read('assets/integration/attempt-store.js'),
  read('assets/integration/player.js'),
  read('assets/integration/contracts.js'),
  read('package.json'),
]);

required(store.includes("from './contracts.js?v=1.0.0'"), 'O histórico não reutiliza o contrato central.');
required(store.includes('STORAGE_KEYS.attempts'), 'O histórico não usa a chave oficial de tentativas.');
required(contracts.includes("attempts: `${STORAGE_PREFIX}attempts`"), 'A chave de tentativas não existe no contrato central.');
required(store.includes('MAX_LOCAL_ATTEMPTS = 100'), 'O limite de tentativas locais diverge do plano.');
required(store.includes("ATTEMPT_MODES = Object.freeze(['pilot', 'review'])"), 'Modos piloto e revisão não estão declarados.');
required(store.includes("profileId: 'rodrigo'") && store.includes("cargoCode: '202'"), 'Perfil ou cargo não estão fixados no registro.');
required(store.includes('pilot: true') && store.includes('officialProgress: false') && store.includes('notionWriteback: false'), 'Isolamento do piloto ausente no registro.');
required(store.includes("mode === 'review' && !sourceReviewId"), 'Tentativa de revisão não exige origem.');
required(store.includes("sourceReviewId: mode === 'review'"), 'Origem da revisão não é preservada.');
required(!/notion\.com|api\.notion/i.test(store), 'O armazenamento não pode acessar o Notion.');
required(!/fetch\s*\(/.test(store), 'O armazenamento não pode realizar requisições de rede.');
required(!/sessionStorage|indexedDB/.test(store), 'Mecanismo de persistência não autorizado.');
required(store.includes('Histórico local de tentativas corrompido'), 'Proteção contra corrupção ausente.');
required(store.includes('filter(item => item.id !== valid.id)'), 'Deduplicação por ID ausente.');

required(player.includes("from './attempt-store.js?v=1.0.0'"), 'O player não usa o módulo controlado de tentativas.');
required(!/localStorage|sessionStorage|indexedDB/.test(player), 'O player acessa diretamente o armazenamento.');
const evaluatePosition = player.indexOf('state.evaluation = evaluateSession');
const savePosition = player.indexOf('state.savedAttempt = saveAttempt');
required(evaluatePosition >= 0 && savePosition > evaluatePosition, 'A tentativa é salva antes da correção.');
required(player.includes('Tentativa salva neste dispositivo'), 'A interface não informa o histórico local.');
required(player.includes('Nenhum dado foi enviado ao Notion ou ao progresso oficial'), 'A interface não informa o isolamento externo.');
required(packageText.includes('check:attempts') && packageText.includes('test:attempts'), 'Comandos de validação das tentativas ausentes.');

console.log('Histórico local validado: piloto/revisão, namespace oficial, deduplicação, limite, corrupção protegida e zero writeback.');
