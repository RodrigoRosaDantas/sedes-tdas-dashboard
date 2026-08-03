import { hash, localIso, norm } from './config.mjs';
import { fetchMarkdown, mapLimit, request } from './api.mjs';

export const DAILY_ROOTS = Object.freeze({
  materials: Object.freeze({
    id: '364cf5a26731813ca00ed9ba45ab6d51',
    name: 'Materiais Premium Diários',
    url: 'https://app.notion.com/p/364cf5a26731813ca00ed9ba45ab6d51'
  }),
  questions: Object.freeze({
    id: '364cf5a267318105abdbce6966704b5d',
    name: 'Questões Diárias',
    url: 'https://app.notion.com/p/364cf5a267318105abdbce6966704b5d'
  })
});

const PE_LIMIT = 112;
const OPTION_KEYS = Object.freeze(['A', 'B', 'C', 'D', 'E']);
const peCode = value => {
  const match = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/\bPE\s*0*(\d{1,3})\b/i);
  const number = Number(match?.[1]);
  return Number.isInteger(number) && number >= 1 && number <= PE_LIMIT ? `PE${String(number).padStart(2, '0')}` : null;
};
const compactId = value => String(value ?? '').replaceAll('-', '').toLowerCase();
const pageUrl = id => `https://app.notion.com/p/${compactId(id)}`;
const required = (condition, message) => { if (!condition) throw new Error(message); };

function plainRichText(items) {
  return Array.isArray(items) ? items.map(item => item.plain_text ?? item.text?.content ?? '').join('') : '';
}

async function listBlockChildren(parentId) {
  const output = [];
  let cursor;
  let rounds = 0;
  do {
    if (++rounds > 100) throw new Error(`Paginação excessiva nos filhos de ${parentId}.`);
    const params = new URLSearchParams({page_size: '100'});
    if (cursor) params.set('start_cursor', cursor);
    const endpoint = `/blocks/${parentId}/children?${params}`;
    const data = await request(endpoint);
    if (!Array.isArray(data?.results)) throw new Error(`Resposta sem filhos em ${endpoint}.`);
    output.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
    if (data.has_more && !cursor) throw new Error(`Paginação inconsistente em ${endpoint}.`);
  } while (cursor);
  return output;
}

function childPage(block, parentId) {
  if (block?.type !== 'child_page') return null;
  return {
    id: compactId(block.id),
    title: String(block.child_page?.title ?? '').trim(),
    parentId: compactId(parentId),
    url: pageUrl(block.id)
  };
}

export async function discoverDailyPages(root, {expected = PE_LIMIT} = {}) {
  const rootChildren = (await listBlockChildren(root.id)).map(block => childPage(block, root.id)).filter(Boolean);
  const direct = rootChildren.filter(page => peCode(page.title));
  const containers = rootChildren.filter(page => !peCode(page.title));
  const nestedGroups = await mapLimit(containers, 3, async container =>
    (await listBlockChildren(container.id)).map(block => childPage(block, container.id)).filter(Boolean)
  );
  const candidates = [...direct, ...nestedGroups.flat()].filter(page => peCode(page.title));
  const byPe = new Map();
  for (const page of candidates) {
    const pe = peCode(page.title);
    if (byPe.has(pe)) throw new Error(`${root.name}: mais de uma página localizada para ${pe}.`);
    byPe.set(pe, {...page, pe});
  }
  required(byPe.size === expected, `${root.name}: foram localizados ${byPe.size} PE; esperado ${expected}.`);
  for (let number = 1; number <= expected; number++) {
    const pe = `PE${String(number).padStart(2, '0')}`;
    required(byPe.has(pe), `${root.name}: página filha ausente para ${pe}.`);
  }
  return byPe;
}

function titleFromPage(page) {
  const property = Object.values(page?.properties || {}).find(item => item?.type === 'title');
  return plainRichText(property?.title).trim();
}

async function fetchPageMetadata(id) {
  const page = await request(`/pages/${compactId(id)}`);
  return {
    id: compactId(page.id || id),
    title: titleFromPage(page),
    url: page.url || pageUrl(id),
    createdTime: page.created_time || '',
    lastEditedTime: page.last_edited_time || ''
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return text;
}

function renderTable(source) {
  const rows = [...source.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map(match =>
    [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map(cell => inlineMarkdown(cell[1].trim().replace(/\s+/g, ' ')))
  ).filter(row => row.length);
  if (!rows.length) return '';
  const header = /header-row=["']true["']/i.test(source);
  return `<div class="daily-table-wrap"><table>${rows.map((row, index) => `<tr>${row.map(cell => index === 0 && header ? `<th>${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</table></div>`;
}

function renderDetails(source) {
  const summary = source.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1]?.trim() || 'Detalhes';
  const body = source.replace(/^[\s\S]*?<summary>[\s\S]*?<\/summary>/i, '').replace(/<\/details>[\s\S]*$/i, '').trim();
  return `<details class="daily-details"><summary>${inlineMarkdown(summary)}</summary>${renderMaterialMarkdown(body)}</details>`;
}

export function renderMaterialMarkdown(markdown) {
  let source = String(markdown ?? '').replace(/\r/g, '').replace(/\\\|/g, '|');
  const protectedBlocks = [];
  const protect = html => {
    const token = `@@TDAS_BLOCK_${protectedBlocks.length}@@`;
    protectedBlocks.push(html);
    return token;
  };
  source = source.replace(/<table\b[\s\S]*?<\/table>/gi, table => protect(renderTable(table)));
  source = source.replace(/<details>[\s\S]*?<\/details>/gi, details => protect(renderDetails(details)));
  source = source.replace(/<page\b[^>]*>[\s\S]*?<\/page>/gi, '').replace(/<database\b[^>]*>[\s\S]*?<\/database>/gi, '');

  const lines = source.split('\n');
  const html = [];
  let list = null;
  const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };
  const paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    closeList();
    html.push(`<p>${inlineMarkdown(paragraph.join(' ').trim())}</p>`);
    paragraph.length = 0;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const token = line.match(/^@@TDAS_BLOCK_(\d+)@@$/);
    if (token) { flushParagraph(); closeList(); html.push(protectedBlocks[Number(token[1])] || ''); continue; }
    if (!line) { flushParagraph(); closeList(); continue; }
    if (/^---+$/.test(line)) { flushParagraph(); closeList(); html.push('<hr>'); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { flushParagraph(); closeList(); const level = Math.min(4, heading[1].length + 1); html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushParagraph(); closeList(); html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`); continue; }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) { flushParagraph(); if (list !== 'ul') { closeList(); html.push('<ul>'); list = 'ul'; } html.push(`<li>${inlineMarkdown(bullet[1])}</li>`); continue; }
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) { flushParagraph(); if (list !== 'ol') { closeList(); html.push('<ol>'); list = 'ol'; } html.push(`<li>${inlineMarkdown(numbered[1])}</li>`); continue; }
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return html.filter(Boolean).join('\n');
}

function cleanQuestionText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/\\\|/g, '|')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionSegments(markdown) {
  const source = String(markdown ?? '').replace(/\r/g, '');
  const matches = [...source.matchAll(/^##\s+Quest(?:ão|ao)\s+(\d+)\s*$/gim)];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    body: source.slice(match.index + match[0].length, matches[index + 1]?.index ?? source.length)
      .split(/\n#\s+\d+\.[^\n]*/)[0]
      .trim()
  }));
}

function parseQuestionBody(body) {
  const lines = String(body ?? '').split('\n');
  const stem = [];
  const alternatives = {};
  let currentOption = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^#{1,4}\s+/.test(line)) continue;
    const option = line.match(/^([A-E])\)\s*(.*)$/);
    if (option) {
      currentOption = option[1];
      alternatives[currentOption] = option[2].trim();
      continue;
    }
    if (currentOption) alternatives[currentOption] = `${alternatives[currentOption]} ${line}`.trim();
    else stem.push(line);
  }
  return {
    enunciado: cleanQuestionText(stem.join(' ')),
    alternativas: Object.fromEntries(OPTION_KEYS.map(option => [option, cleanQuestionText(alternatives[option])]))
  };
}

function parseAnswerKey(markdown) {
  const source = String(markdown ?? '').replace(/\r/g, '');
  const start = source.search(/^#\s+[^\n]*Gabarito[^\n]*$/im);
  if (start < 0) return new Map();
  const tail = source.slice(start);
  const next = tail.slice(1).search(/^#\s+\d+\.[^\n]*$/m);
  const section = next >= 0 ? tail.slice(0, next + 1) : tail;
  const key = new Map();
  for (const match of section.matchAll(/\b(\d{1,3})\s*[-–—]\s*([A-E])\b/g)) {
    const number = Number(match[1]);
    if (key.has(number)) throw new Error(`Gabarito duplicado para a questão ${number}.`);
    key.set(number, match[2]);
  }
  return key;
}

export function parseDailyQuestions(markdown, {pe, title, expectedCount = 0, sourcePageId = ''} = {}) {
  const segments = questionSegments(markdown);
  if (expectedCount === 0 && segments.length === 0) {
    return {
      catalog: {
        schemaVersion: '2.1.0', mode: 'notion-daily-empty', catalogId: `tdas-${String(pe).toLowerCase()}-empty`,
        title: `${pe} — ${title}`, description: 'Este PE não possui questões programadas.', peId: pe,
        questionCount: 0, suggestedMinutes: 0, keyPath: null,
        authorizedSource: {type: 'notion-daily-child-page', pageId: sourcePageId, contentHash: hash(markdown)}, questions: []
      },
      key: null
    };
  }
  required(segments.length > 0, `${pe}: nenhuma questão reconhecida na página diária.`);
  if (expectedCount > 0) required(segments.length === expectedCount, `${pe}: foram reconhecidas ${segments.length} questões; meta oficial ${expectedCount}.`);
  const seenNumbers = new Set();
  const questions = segments.map(segment => {
    required(Number.isInteger(segment.number) && segment.number > 0, `${pe}: numeração de questão inválida.`);
    required(!seenNumbers.has(segment.number), `${pe}: questão ${segment.number} duplicada.`);
    seenNumbers.add(segment.number);
    const parsed = parseQuestionBody(segment.body);
    required(parsed.enunciado.length >= 12, `${pe}: questão ${segment.number} sem enunciado suficiente.`);
    for (const option of OPTION_KEYS) required(parsed.alternativas[option]?.length > 0, `${pe}: questão ${segment.number} sem alternativa ${option}.`);
    return {
      id: `${pe}-Q${String(segment.number).padStart(3, '0')}`,
      numeroOriginal: segment.number,
      assunto: title,
      enunciado: parsed.enunciado,
      alternativas: parsed.alternativas
    };
  });
  const answerKey = parseAnswerKey(markdown);
  required(answerKey.size === questions.length, `${pe}: gabarito possui ${answerKey.size} respostas para ${questions.length} questões.`);
  const contentHash = hash({questions, answers: [...answerKey]});
  const catalogId = `tdas-${pe.toLowerCase()}-${contentHash.slice(0, 12)}`;
  const catalog = {
    schemaVersion: '2.1.0',
    mode: 'notion-daily',
    catalogId,
    title: `${pe} — ${title}`,
    description: 'Questões importadas da página filha oficial do dia. A correção só é carregada ao finalizar.',
    peId: pe,
    questionCount: questions.length,
    suggestedMinutes: Math.max(10, Math.ceil(questions.length * 1.5)),
    keyPath: `data/integration/question-keys/${pe.toLowerCase()}.json`,
    authorizedSource: {type: 'notion-daily-child-page', pageId: sourcePageId, contentHash},
    questions
  };
  const key = {
    schemaVersion: '1.0.0',
    material_id: catalogId,
    peId: pe,
    sourcePageId,
    contentHash,
    answers: questions.map(question => ({id: question.id, gabarito: answerKey.get(question.numeroOriginal)}))
  };
  required(!/gabarito|coment[aá]rio|fundamento|resposta correta/i.test(JSON.stringify(catalog)), `${pe}: catálogo público contém pista ou correção.`);
  return {catalog, key};
}

export async function prepareDailyContent({controls, snapshotDate, runStartedAt = new Date().toISOString()} = {}) {
  required(Array.isArray(controls) && controls.length >= 100, 'Controle insuficiente para localizar o conteúdo diário.');
  const current = controls.find(item => item.date === snapshotDate);
  required(current?.pe, `Nenhum PE programado para ${snapshotDate}.`);
  const pe = peCode(current.pe);
  required(pe, `Dia ID atual inválido: ${current.pe}.`);

  const [materials, questions] = await Promise.all([
    discoverDailyPages(DAILY_ROOTS.materials),
    discoverDailyPages(DAILY_ROOTS.questions)
  ]);
  const materialPage = materials.get(pe);
  const questionPage = questions.get(pe);
  required(materialPage && questionPage, `${pe}: vínculo diário incompleto.`);

  const [materialMeta, questionMeta, materialMarkdown, questionMarkdown] = await Promise.all([
    fetchPageMetadata(materialPage.id),
    fetchPageMetadata(questionPage.id),
    fetchMarkdown(materialPage.id),
    fetchMarkdown(questionPage.id)
  ]);
  required(peCode(materialMeta.title || materialPage.title) === pe, `${pe}: título do material não corresponde ao Dia ID.`);
  required(peCode(questionMeta.title || questionPage.title) === pe, `${pe}: título das questões não corresponde ao Dia ID.`);
  required(materialMarkdown.trim().length >= 200, `${pe}: material diário vazio ou incompleto.`);
  required(questionMarkdown.trim().length >= 100 || Number(current.meta || 0) === 0, `${pe}: página de questões vazia ou incompleta.`);

  const title = String(current.title || questionMeta.title || materialMeta.title || pe).trim();
  const parsed = parseDailyQuestions(questionMarkdown, {
    pe,
    title,
    expectedCount: Math.max(0, Number(current.meta || 0)),
    sourcePageId: questionPage.id
  });
  parsed.catalog.authorizedSource = {
    ...parsed.catalog.authorizedSource,
    url: questionMeta.url,
    rootId: DAILY_ROOTS.questions.id,
    parentId: questionPage.parentId,
    lastEditedTime: questionMeta.lastEditedTime
  };
  if (parsed.key) parsed.key.sourceUrl = questionMeta.url;

  const material = {
    schemaVersion: '1.0.0',
    mode: 'notion-daily-material',
    peId: pe,
    title: materialMeta.title || title,
    capturedAt: localIso(runStartedAt),
    source: {
      type: 'notion-daily-child-page',
      pageId: materialPage.id,
      url: materialMeta.url,
      rootId: DAILY_ROOTS.materials.id,
      parentId: materialPage.parentId,
      lastEditedTime: materialMeta.lastEditedTime
    },
    contentHash: hash(materialMarkdown),
    html: renderMaterialMarkdown(materialMarkdown)
  };
  required(material.html.length >= 200, `${pe}: material não produziu HTML suficiente.`);

  const contract = {
    schemaVersion: '1.1.0',
    mode: 'daily-execution-contract',
    capturedAt: localIso(runStartedAt),
    sources: {
      execution: 'https://app.notion.com/p/366cf5a2673181959f8dca36b606e78a',
      materials: DAILY_ROOTS.materials.url,
      questions: DAILY_ROOTS.questions.url
    },
    materialPageIds: Array.from({length: PE_LIMIT}, (_, index) => materials.get(`PE${String(index + 1).padStart(2, '0')}`).id),
    questionPageIds: Array.from({length: PE_LIMIT}, (_, index) => questions.get(`PE${String(index + 1).padStart(2, '0')}`).id),
    current: {
      peId: pe,
      materialPath: 'data/integration/daily-material.json',
      catalogPath: 'data/integration/question-catalog.json',
      keyPath: parsed.catalog.keyPath,
      materialPageId: materialPage.id,
      questionPageId: questionPage.id
    },
    invariants: [
      'one-material-page-per-pe', 'one-primary-question-page-per-pe', 'children-discovered-from-official-roots',
      'theory-and-questions-separated', 'question-content-authorized-by-user', 'answer-key-loaded-after-finish', 'no-notion-writeback'
    ]
  };

  return {
    pe,
    material,
    catalog: parsed.catalog,
    key: parsed.key,
    contract,
    semantic: {
      pe,
      materialPageId: materialPage.id,
      questionPageId: questionPage.id,
      materialHash: material.contentHash,
      questionHash: parsed.catalog.authorizedSource.contentHash,
      questionCount: parsed.catalog.questionCount,
      roots: {materials: DAILY_ROOTS.materials.id, questions: DAILY_ROOTS.questions.id}
    }
  };
}
