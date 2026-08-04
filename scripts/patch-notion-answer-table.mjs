import fs from 'node:fs/promises';

const parserFile='scripts/notion/daily-content.mjs';
const apiFile='scripts/notion/api.mjs';
const testFile='scripts/test-daily-content.mjs';

const parserStart='function answerKeySection(source) {';
const parserEnd='export function parseDailyQuestions';
const parserBlock=`function answerKeySection(source) {
  const headingStart = source.search(/^#{1,4}\\s+[^\\n]*Gabarito[^\\n]*$/im);
  if (headingStart >= 0) {
    const tail = source.slice(headingStart);
    const next = tail.slice(1).search(/^#\\s+\\d+\\.[^\\n]*$/m);
    return next >= 0 ? tail.slice(0, next + 1) : tail;
  }
  const htmlHeader = source.search(/<tr\\b[^>]*>[\\s\\S]*?<t[dh]\\b[^>]*>\\s*Quest(?:ão|ao)\\s*<\\/t[dh]>[\\s\\S]*?<t[dh]\\b[^>]*>[\\s\\S]*?(?:Resposta|Gabarito)[\\s\\S]*?<\\/t[dh]>[\\s\\S]*?<\\/tr>/i);
  if (htmlHeader >= 0) {
    const tableStart = source.lastIndexOf('<table', htmlHeader);
    const tableEnd = source.indexOf('</table>', htmlHeader);
    if (tableStart >= 0 && tableEnd >= 0) return source.slice(tableStart, tableEnd + '</table>'.length);
  }
  const markdownHeader = source.search(/^\\s*\\|\\s*Quest(?:ão|ao)\\s*\\|[^\\n]*(?:Resposta|Gabarito)[^\\n]*$/im);
  if (markdownHeader >= 0) {
    const tail = source.slice(markdownHeader);
    const lines = tail.split('\\n');
    const tableLines = [];
    for (const line of lines) {
      if (!/^\\s*\\|/.test(line)) break;
      tableLines.push(line);
    }
    return tableLines.join('\\n');
  }
  return '';
}

function parseAnswerKey(markdown) {
  const source = String(markdown ?? '').replace(/\\r/g, '');
  const section = answerKeySection(source);
  const key = new Map();
  const add = (number, answer) => {
    if (key.has(number) && key.get(number) !== answer) throw new Error(\`Gabarito divergente para a questão \${number}.\`);
    key.set(number, answer);
  };
  if (section) {
    for (const match of section.matchAll(/\\b(\\d{1,3})\\s*[-–—]\\s*([A-E])\\b/g)) add(Number(match[1]), match[2]);
  }
  const tableSource = section || source;
  for (const row of tableSource.matchAll(/<tr\\b[^>]*>([\\s\\S]*?)<\\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\\b[^>]*>([\\s\\S]*?)<\\/t[dh]>/gi)].map(cell => cleanQuestionText(cell[1]));
    if (/^\\d{1,3}$/.test(cells[0] || '') && /^[A-E]$/i.test(cells[1] || '')) add(Number(cells[0]), cells[1].toUpperCase());
  }
  for (const match of tableSource.matchAll(/^\\s*\\|\\s*(\\d{1,3})\\s*\\|\\s*(?:\\*\\*|__|\`)?([A-E])(?:\\*\\*|__|\`)?\\s*\\|/gmi)) add(Number(match[1]), match[2].toUpperCase());
  return key;
}

`;
let parser=await fs.readFile(parserFile,'utf8');
const start=parser.indexOf(parserStart),end=parser.indexOf(parserEnd);
if(start<0||end<0||end<=start)throw new Error('Bloco do parser de gabarito não localizado.');
parser=`${parser.slice(0,start)}${parserBlock}${parser.slice(end)}`;
await fs.writeFile(parserFile,parser,'utf8');

const apiBefore=`function blockText(block) {
  const payload = block?.[block.type];
  const text = plain(payload?.rich_text);
  if (!text) return '';
  const prefix = block.type === 'heading_1' ? '# ' : block.type === 'heading_2' ? '## ' : block.type === 'heading_3' ? '### ' : block.type.includes('bulleted') ? '- ' : block.type.includes('numbered') ? '1. ' : '';
  return \`${'${prefix}${text}'}\`;
}`;
const apiAfter=`function blockText(block) {
  const payload = block?.[block.type];
  if (block?.type === 'table_row') {
    const cells = (payload?.cells || []).map(items => plain(items).replace(/\\|/g, '\\\\|'));
    return cells.some(Boolean) ? \`| \${cells.join(' | ')} |\` : '';
  }
  const text = plain(payload?.rich_text);
  if (!text) return '';
  const prefix = block.type === 'heading_1' ? '# ' : block.type === 'heading_2' ? '## ' : block.type === 'heading_3' ? '### ' : block.type.includes('bulleted') ? '- ' : block.type.includes('numbered') ? '1. ' : '';
  return \`${'${prefix}${text}'}\`;
}`;
let api=await fs.readFile(apiFile,'utf8');
if(!api.includes(apiBefore))throw new Error('Conversor de blocos do Notion não localizado.');
api=api.replace(apiBefore,apiAfter);
await fs.writeFile(apiFile,api,'utf8');

const testMarker=`const html=renderMaterialMarkdown(`;
const regression=`const formattedAnswerTableMarkdown = \`# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
# 3. Resultado e fundamentos
<table header-row="true">
<tr><td>Questão</td><td>Resposta correta</td><td>Fundamento sintético</td></tr>
<tr><td>1</td><td>**A**</td><td>Fundamento um.</td></tr>
<tr><td>2</td><td><strong>B</strong></td><td>Fundamento dois.</td></tr>
</table>
\`;
const {key:formattedAnswerTableKey}=parseDailyQuestions(formattedAnswerTableMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'mno'});
assert.equal(formattedAnswerTableKey.answers[0].gabarito,'A');
assert.equal(formattedAnswerTableKey.answers[1].gabarito,'B');

const pipeAnswerTableMarkdown = \`# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
# 3. Resultado e fundamentos
| Questão | Resposta | Fundamento sintético |
| 1 | A | Fundamento um. |
| 2 | **B** | Fundamento dois. |
\`;
const {key:pipeAnswerTableKey}=parseDailyQuestions(pipeAnswerTableMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'pqr'});
assert.equal(pipeAnswerTableKey.answers[0].gabarito,'A');
assert.equal(pipeAnswerTableKey.answers[1].gabarito,'B');

`;
let tests=await fs.readFile(testFile,'utf8');
if(!tests.includes('const formattedAnswerTableMarkdown =')){
 if(!tests.includes(testMarker))throw new Error('Ponto de inserção dos testes de tabela não localizado.');
 tests=tests.replace(testMarker,`${regression}${testMarker}`);
 await fs.writeFile(testFile,tests,'utf8');
}

console.log('Leitura nativa e alternativa das tabelas de respostas corrigida.');
