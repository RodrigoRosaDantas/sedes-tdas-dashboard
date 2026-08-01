import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const [classification, store, attemptStore, player, contracts, errorBook, errorPage, packageText] = await Promise.all([
  read('assets/integration/response-classification.js'),
  read('assets/integration/classification-store.js'),
  read('assets/integration/attempt-store.js'),
  read('assets/integration/player.js'),
  read('assets/integration/contracts.js'),
  read('assets/integration/error-book.js'),
  read('caderno-erros/index.html'),
  read('package.json'),
]);

for (const value of ['incorrect_confirmed','correct_secure','correct_with_doubt','correct_by_guess','marked','annulment_pending','source_error']) {
  required(contracts.includes(`"${value}"`), `Classificação ${value} ausente do contrato.`);
}
required(contracts.includes('ERROR_BOOK_ELIGIBLE = Object.freeze(["incorrect_confirmed"])'), 'Elegibilidade do caderno divergente.');
required(classification.indexOf("issue === 'source_error'") < classification.indexOf('!result.correct'), 'Erro da fonte não tem precedência sobre erro objetivo.');
required(classification.indexOf("issue === 'annulment_pending'") < classification.indexOf('!result.correct'), 'Possível anulação não tem precedência sobre erro objetivo.');
required(classification.includes("classification = 'incorrect_confirmed'"), 'Erro confirmado ausente.');
required(classification.includes("classification = 'correct_by_guess'"), 'Acerto por chute ausente.');
required(classification.includes("classification = 'correct_with_doubt'"), 'Acerto com dúvida ausente.');
required(classification.includes("classification = 'marked'"), 'Classificação de marcação ausente.');

required(attemptStore.includes('classifyQuestionResult'), 'Tentativa não incorpora a classificação.');
required(attemptStore.includes('classificationSummary'), 'Resumo de classificações ausente da tentativa.');
required(store.includes('STORAGE_KEYS.errors') && store.includes('STORAGE_KEYS.marked'), 'Índices não usam as chaves oficiais.');
required(/question\.classification\s*===\s*'incorrect_confirmed'/.test(store), 'Caderno não filtra erro confirmado.');
required(/question\.marked\s*===\s*true/.test(store), 'Índice de marcações ausente.');
for (const content of [classification, store, errorBook]) {
  required(!/notion\.com|api\.notion/i.test(content), 'Classificação não pode acessar o Notion.');
  required(!/fetch\s*\(/.test(content), 'Módulos de classificação não podem realizar requisições de rede.');
}

for (const marker of ['pilot-confidence','data-player-marked','data-player-issue','syncAttemptIndexes']) {
  required(player.includes(marker), `Player sem integração de classificação: ${marker}.`);
}
required(/responseMeta\s*:\s*state\.responseMeta/.test(player), 'Player não envia os metadados para a tentativa.');
required(player.includes('Possível anulação') && player.includes('Possível erro da fonte/gabarito'), 'Ressalvas editoriais ausentes da interface.');
required(errorPage.includes('/assets/integration/error-book.js'), 'Rota canônica não carrega o caderno local.');
required(!errorPage.includes('/assets/integration/navigation.js'), 'Rota canônica ainda carrega a página estrutural.');
required(errorBook.includes("classification <code>incorrect_confirmed</code>"), 'Caderno não declara a regra de erro confirmado.');
required(errorBook.includes(`${'${BASE}'}questoes-erros/`), 'Atalho para o acervo oficial ausente.');
required(packageText.includes('check:classification') && packageText.includes('test:classification'), 'Comandos da classificação ausentes.');

console.log('Classificação validada: precedência editorial, erro definitivo exclusivo, marcações independentes e caderno local isolado.');
