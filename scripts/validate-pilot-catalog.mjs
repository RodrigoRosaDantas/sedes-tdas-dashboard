import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const catalog = JSON.parse(await fs.readFile('data/integration/pilot/pe76-catalog.json', 'utf8'));
const key = JSON.parse(await fs.readFile('data/integration/pilot/pe76-key.json', 'utf8'));
const pilotScript = await fs.readFile('assets/integration/pilot-catalog.js', 'utf8');
const studyHtml = await fs.readFile('estudar/index.html', 'utf8');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const expectedNumbers = [1, 2, 3, 4, 5, 6, 13, 14, 15, 16];
const expectedAnswers = new Map([[1,'D'],[2,'B'],[3,'A'],[4,'E'],[5,'C'],[6,'A'],[13,'C'],[14,'C'],[15,'A'],[16,'D']]);
const stable = value => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(name => `${JSON.stringify(name)}:${stable(value[name])}`).join(',')}}`
    : JSON.stringify(value);

required(catalog.schema_version === '1.0', 'Schema do catálogo inválido.');
required(catalog.id === 'pilot-pe76-2026-tdas', 'ID do piloto inválido.');
required(catalog.pilotMode === true, 'O modo piloto deve permanecer ativo.');
required(catalog.officialProgressWrite === false && catalog.notionWriteback === false, 'O piloto não pode escrever no progresso oficial ou no Notion.');
required(catalog.codigo_cargo === '202', 'O catálogo deve ser exclusivo do Cargo 202.');
required(catalog.quantidade_questoes === 10 && catalog.questoes.length === 10, 'O piloto deve conter exatamente dez questões.');
required(JSON.stringify(catalog.questoes.map(question => question.numero_original)) === JSON.stringify(expectedNumbers), 'Seleção do PE76 divergente.');
required(new Set(catalog.questoes.map(question => question.id)).size === 10, 'IDs de questões duplicados.');

for (const question of catalog.questoes) {
  required(question.id === `pilot-pe76-2026-tdas-${String(question.numero_original).padStart(2, '0')}`, `ID instável na questão ${question.numero_original}.`);
  required(Object.keys(question.alternativas).join('') === 'ABCDE', `Alternativas inválidas na questão ${question.numero_original}.`);
  required(Object.values(question.alternativas).every(value => String(value).trim()), `Alternativa vazia na questão ${question.numero_original}.`);
  required(!('gabarito' in question) && !('comentario' in question) && !('fundamento' in question), `Resposta ou comentário exposto no catálogo da questão ${question.numero_original}.`);
  required(!Object.keys(question).some(name => /resposta|percentual|acerto|erro|anot/i.test(name)), `Dado pessoal ou de desempenho presente na questão ${question.numero_original}.`);
}

const hash = crypto.createHash('sha256').update(stable(catalog.questoes)).digest('hex');
required(hash === catalog.content_sha256, 'Hash do conteúdo do piloto divergente.');
required(key.material_id === catalog.id && key.loaded_by_catalog === false, 'Separação do gabarito inválida.');
required(key.answers.length === 10, 'Quantidade de respostas inválida.');
for (const answer of key.answers) {
  const number = Number(answer.id.slice(-2));
  required(expectedAnswers.get(number) === answer.gabarito, `Gabarito divergente na questão ${number}.`);
}

const sharedText = catalog.questoes.filter(question => question.numero_original >= 13).map(question => question.texto_base);
required(new Set(sharedText).size === 1 && sharedText[0], 'Texto-base das questões 13 a 16 divergente ou ausente.');
required(studyHtml.includes('/assets/integration/pilot-catalog.js'), 'A rota Estudar não carrega o resumo do piloto.');
required(pilotScript.includes('pe76-catalog.json'), 'O resumo não carrega o catálogo do piloto.');
required(!pilotScript.includes('pe76-key.json'), 'O resumo do catálogo não pode carregar o gabarito.');
required(!/localStorage|sessionStorage|indexedDB/.test(pilotScript), 'A Fase 3 não pode persistir resultados.');
required(!/fetch\([^)]*notion/i.test(pilotScript), 'A Fase 3 não pode consultar o Notion em runtime.');
console.log(`Catálogo piloto PE76 validado: ${catalog.questoes.length} questões, hash ${hash.slice(0, 12)}…, sem dados pessoais e sem writeback.`);
