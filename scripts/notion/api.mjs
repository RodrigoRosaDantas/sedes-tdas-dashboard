import { API_BASE, API_VERSION, TOKEN, sleep } from './config.mjs';

export async function request(endpoint, options = {}, attempt = 0) {
  if (!TOKEN) throw new Error('O secret NOTION_TOKEN não está disponível no workflow.');
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': API_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (response.ok) return response.json();
  const body = await response.text();
  if ((response.status === 429 || response.status >= 500) && attempt < 7) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30000, 900 * 2 ** attempt + Math.random() * 500);
    await sleep(wait);
    return request(endpoint, options, attempt + 1);
  }
  throw new Error(`Notion API ${response.status} em ${endpoint}: ${body.slice(0, 1000)}`);
}

const SIMPLE = new Set([
  'title', 'rich_text', 'number', 'select', 'multi_select', 'status', 'date',
  'checkbox', 'url', 'email', 'phone_number', 'formula', 'unique_id',
  'created_time', 'last_edited_time'
]);

function assertCompleteList(data, endpoint) {
  const status = data?.request_status?.status;
  if (status && status !== 'complete') throw new Error(`Resposta incompleta do Notion em ${endpoint}: ${status}.`);
  if (!Array.isArray(data?.results)) throw new Error(`Resposta sem results em ${endpoint}.`);
  if (data.has_more && !data.next_cursor) throw new Error(`Paginação inconsistente em ${endpoint}: has_more sem next_cursor.`);
}

function plain(items) {
  return Array.isArray(items) ? items.map(item => item.plain_text ?? item.text?.content ?? '').join('') : '';
}

function value(property) {
  if (!property?.type) return null;
  const current = property[property.type];
  if (property.type === 'title' || property.type === 'rich_text') return plain(current);
  if (property.type === 'number' || property.type === 'checkbox' || ['url', 'email', 'phone_number', 'created_time', 'last_edited_time'].includes(property.type)) return current ?? null;
  if (property.type === 'select' || property.type === 'status') return current?.name ?? null;
  if (property.type === 'multi_select') return (current || []).map(item => item.name);
  if (property.type === 'date') return current?.start ?? null;
  if (property.type === 'unique_id') return current ? `${current.prefix || ''}${current.number ?? ''}` : null;
  if (property.type === 'formula') return !current ? null : current.type === 'date' ? current.date?.start ?? null : current[current.type] ?? null;
  return null;
}

export function normalizePage(page) {
  const propertyEntries = Object.entries(page.properties || {});
  const properties = Object.fromEntries(propertyEntries.map(([name, property]) => [name, value(property)]));
  const propertyIds = Object.fromEntries(propertyEntries.map(([name, property]) => [name, property.id]));
  const propertyTypes = Object.fromEntries(propertyEntries.map(([name, property]) => [name, property.type]));
  const titleProperty = propertyEntries.find(([, property]) => property.type === 'title')?.[1];
  return {
    id: page.id,
    title: titleProperty ? value(titleProperty) : '',
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties,
    propertyIds,
    propertyTypes
  };
}

async function selectedPropertiesSuffix(source) {
  const schema = await request(`/data_sources/${source.dataSourceId}`);
  const params = new URLSearchParams();
  for (const property of Object.values(schema.properties || {})) {
    if (SIMPLE.has(property.type) && property.id) params.append('filter_properties[]', property.id);
  }
  return params.toString() ? `?${params}` : '';
}

async function queryPaged(source, { pageSize = 20, selectedProperties = false, filter = undefined, label = 'consulta' } = {}) {
  if (pageSize < 5 || pageSize > 25) throw new Error(`Lote inválido em ${label}: ${pageSize}. Use entre 5 e 25.`);
  const suffix = selectedProperties ? await selectedPropertiesSuffix(source) : '';
  const endpoint = `/data_sources/${source.dataSourceId}/query${suffix}`;
  const pages = [];
  let cursor;
  let rounds = 0;
  do {
    if (++rounds > 1000) throw new Error(`Paginação excedeu o limite de segurança em ${source.name}.`);
    const body = { page_size: pageSize, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) };
    const data = await request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    assertCompleteList(data, endpoint);
    pages.push(...data.results.filter(item => item.object === 'page'));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  const unique = new Map(pages.map(page => [page.id, page]));
  if (unique.size !== pages.length) throw new Error(`${source.name}: páginas duplicadas na rota ${label}.`);
  return [...unique.values()];
}

function monthWindows() {
  const start = new Date('2024-01-01T00:00:00Z');
  const limit = new Date();
  limit.setUTCMonth(limit.getUTCMonth() + 2, 1);
  const windows = [];
  for (let cursor = new Date(start); cursor < limit;) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    windows.push([cursor.toISOString(), next.toISOString()]);
    cursor = next;
  }
  return windows;
}

async function queryByCreatedTimeRanges(source) {
  const collected = [];
  for (const [start, end] of monthWindows()) {
    const filter = {
      and: [
        { timestamp: 'created_time', created_time: { on_or_after: start } },
        { timestamp: 'created_time', created_time: { before: end } }
      ]
    };
    const pages = await queryPaged(source, { pageSize: 20, selectedProperties: true, filter, label: `faixa ${start.slice(0, 7)}` });
    collected.push(...pages);
  }
  const unique = new Map(collected.map(page => [page.id, page]));
  if (!unique.size) throw new Error('divisão por faixas de data retornou zero páginas');
  return [...unique.values()];
}

async function searchFallback(source) {
  const found = [];
  let cursor;
  let rounds = 0;
  do {
    if (++rounds > 1000) throw new Error(`Busca alternativa excedeu o limite de segurança em ${source.name}.`);
    const body = {
      page_size: 25,
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'ascending', timestamp: 'last_edited_time' },
      ...(cursor ? { start_cursor: cursor } : {})
    };
    const data = await request('/search', { method: 'POST', body: JSON.stringify(body) });
    assertCompleteList(data, '/search');
    for (const item of data.results) {
      const parentId = item.parent?.data_source_id || (item.parent?.type === 'data_source_id' ? item.parent?.data_source_id : null);
      if (parentId === source.dataSourceId) found.push(item);
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  const unique = new Map(found.map(page => [page.id, page]));
  if (!unique.size) throw new Error('busca alternativa retornou zero páginas');
  return mapLimit([...unique.values()], 3, page => request(`/pages/${page.id}`));
}

function comparePageSets(source, primary, verification) {
  const primaryById = new Map(primary.map(page => [page.id, page.url]));
  const verifyById = new Map(verification.map(page => [page.id, page.url]));
  const missing = [...primaryById.keys()].filter(id => !verifyById.has(id));
  const extra = [...verifyById.keys()].filter(id => !primaryById.has(id));
  const urlMismatch = [...primaryById].filter(([id, url]) => verifyById.has(id) && verifyById.get(id) !== url);
  if (missing.length || extra.length || urlMismatch.length) {
    throw new Error(`${source.name}: conferência independente divergiu (ausentes=${missing.length}, extras=${extra.length}, URLs divergentes=${urlMismatch.length}).`);
  }
}

async function independentlyVerify(source, candidate) {
  const attempts = [
    () => queryPaged(source, { pageSize: 10, selectedProperties: false, label: 'verificação independente lote 10' }),
    () => queryPaged(source, { pageSize: 5, selectedProperties: true, label: 'verificação independente lote 5' }),
    () => searchFallback(source)
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      const verification = await attempt();
      comparePageSets(source, candidate, verification);
      return;
    } catch (error) {
      failures.push(error.message);
    }
  }
  throw new Error(`${source.name}: nenhuma conferência independente fechou. ${failures.join(' | ')}`);
}

export async function queryAll(source) {
  console.log(`${source.name}: SQL/json_object não é exposto pela API oficial usada no GitHub Actions; seguindo para os métodos de leitura disponíveis.`);
  const routes = [
    { label: 'consulta paginada lote 20 com propriedades selecionadas', run: () => queryPaged(source, { pageSize: 20, selectedProperties: true, label: 'lote 20 selecionado' }) },
    { label: 'divisão por faixas mensais de criação', run: () => queryByCreatedTimeRanges(source) },
    { label: 'consulta paginada lote 20 com todas as propriedades', run: () => queryPaged(source, { pageSize: 20, selectedProperties: false, label: 'lote 20 completo' }) },
    { label: 'coleta de URLs pela busca do workspace e fetch individual', run: () => searchFallback(source) },
    { label: 'nova divisão em lotes de 10', run: () => queryPaged(source, { pageSize: 10, selectedProperties: false, label: 'lote 10 completo' }) },
    { label: 'nova divisão em lotes de 5', run: () => queryPaged(source, { pageSize: 5, selectedProperties: false, label: 'lote 5 completo' }) }
  ];
  const failures = [];
  for (const route of routes) {
    try {
      const pages = await route.run();
      if (!pages.length) throw new Error('retornou zero páginas');
      await independentlyVerify(source, pages);
      console.log(`${source.name}: ${pages.length} páginas validadas por ${route.label}.`);
      return pages.map(normalizePage);
    } catch (error) {
      failures.push(`${route.label}: ${error.message}`);
      console.warn(`${source.name}: ${route.label} falhou: ${error.message}`);
    }
  }
  throw new Error(`Não foi possível consultar ${source.name} depois de esgotar todos os métodos disponíveis. ${failures.join(' | ')}`);
}

function propertyItemPlain(item) {
  if (!item) return '';
  if (item.type === 'rich_text') return item.rich_text?.plain_text ?? item.rich_text?.text?.content ?? '';
  if (item.type === 'title') return item.title?.plain_text ?? item.title?.text?.content ?? '';
  if (Array.isArray(item.rich_text)) return plain(item.rich_text);
  if (Array.isArray(item.title)) return plain(item.title);
  return item.plain_text ?? '';
}

export async function fetchPropertyText(pageId, propertyId) {
  if (!pageId || !propertyId) return '';
  const chunks = [];
  let cursor;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);
    const endpoint = `/pages/${pageId}/properties/${encodeURIComponent(propertyId)}?${params}`;
    const data = await request(endpoint);
    if (Array.isArray(data.results)) {
      chunks.push(...data.results.map(propertyItemPlain));
      cursor = data.has_more ? data.next_cursor : null;
    } else {
      chunks.push(propertyItemPlain(data));
      cursor = null;
    }
  } while (cursor);
  return chunks.join('');
}

function blockText(block) {
  const payload = block?.[block.type];
  if (block?.type === 'table_row') {
    const cells = (payload?.cells || []).map(items => plain(items).replace(/\|/g, '\\|'));
    return cells.some(Boolean) ? `| ${cells.join(' | ')} |` : '';
  }
  const text = plain(payload?.rich_text);
  if (!text) return '';
  const prefix = block.type === 'heading_1' ? '# ' : block.type === 'heading_2' ? '## ' : block.type === 'heading_3' ? '### ' : block.type.includes('bulleted') ? '- ' : block.type.includes('numbered') ? '1. ' : '';
  return `${prefix}${text}`;
}

async function blocksMarkdown(id, depth = 0) {
  if (depth > 5) return '';
  const lines = [];
  let cursor;
  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (cursor) params.set('start_cursor', cursor);
    const endpoint = `/blocks/${id}/children?${params}`;
    const data = await request(endpoint);
    assertCompleteList(data, endpoint);
    for (const block of data.results) {
      const line = blockText(block);
      if (line) lines.push(line);
      if (block.has_children) {
        const nested = await blocksMarkdown(block.id, depth + 1);
        if (nested) lines.push(nested);
      }
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return lines.join('\n');
}

export async function fetchMarkdown(id) {
  try {
    const data = await request(`/pages/${id}/markdown`);
    if (data?.markdown) return data.markdown;
  } catch (error) {
    console.warn(`Markdown nativo indisponível para ${id}: ${error.message}`);
  }
  try {
    return await blocksMarkdown(id);
  } catch (error) {
    console.warn(`Conteúdo por blocos indisponível para ${id}: ${error.message}`);
    return '';
  }
}

export async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      output[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return output;
}
