import fs from 'node:fs/promises';

const parserFile='scripts/notion/daily-content.mjs';
const testFile='scripts/test-daily-content.mjs';

const parserStart='function answerKeySection(source) {';
const parserEnd='export function parseDailyQuestions';
const parserBlock=`function answerKeySection(source) {
  const heading = source.match(/^#{1,4}\\s+[^\\n]*Gabarito[^\\n]*$/im);
  if (heading?.index >= 0) {
    const tail = source.slice(heading.index + heading[0].length).replace(/^\\n/, '');
    const next = tail.search(/^#\\s+\\d+\\.[^\\n]*$/m);
    return next >= 0 ? tail.slice(0, next) : tail;
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
    for (const match of section.matchAll(/(?:^|[,;\\s])(\\d{1,3})\\s*([A-E])(?=\\s*(?:[,;.]|$))/gmi)) add(Number(match[1]), match[2].toUpperCase());
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
const start=parser.indexOf(parserStart);
const end=parser.indexOf(parserEnd);
if(start<0||end<0||end<=start)throw new Error('Bloco integral do leitor de gabarito não localizado.');
parser=`${parser.slice(0,start)}${parserBlock}${parser.slice(end)}`;
await fs.writeFile(parserFile,parser,'utf8');

const marker=`const html=renderMaterialMarkdown(`;
const regression=`const compactKeyMarkdown = \`# 2. Questões
**1.** Primeira questão válida.
A) Correta
B) Incorreta
**2.** Segunda questão válida.
A) Incorreta
B) Correta
## 3.2 Gabarito definitivo
1A, 2B.
# 4. Correção detalhada dos erros reais
## Questão 1 — Exemplo posterior
**Resposta marcada:** B
**Gabarito:** A
\`;
const {catalog:compactKeyCatalog,key:compactKey}=parseDailyQuestions(compactKeyMarkdown,{pe:'PE79',title:'Arquivologia',expectedCount:2,sourcePageId:'stu'});
assert.equal(compactKeyCatalog.questionCount,2);
assert.equal(compactKey.answers.length,2);
assert.equal(compactKey.answers[0].gabarito,'A');
assert.equal(compactKey.answers[1].gabarito,'B');
assert.ok(!JSON.stringify(compactKeyCatalog).includes('Gabarito definitivo'));

`;
let tests=await fs.readFile(testFile,'utf8');
if(!tests.includes('const compactKeyMarkdown =')){
 if(!tests.includes(marker))throw new Error('Ponto de inserção do teste compacto não localizado.');
 tests=tests.replace(marker,`${regression}${marker}`);
 await fs.writeFile(testFile,tests,'utf8');
}

console.log('Bloco integral do gabarito substituído e teste compacto incluído.');
