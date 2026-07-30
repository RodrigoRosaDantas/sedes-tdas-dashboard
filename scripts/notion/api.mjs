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
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const seconds = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Math.min(30000, 800 * 2 ** attempt + Math.random() * 400));
    return request(endpoint, options, attempt + 1);
  }
  throw new Error(`Notion API ${response.status} em ${endpoint}: ${body.slice(0, 800)}`);
}

const SIMPLE = new Set([
  'title', 'rich_text', 'number', 'select', 'multi_select', 'status', 'date',
  'checkbox', 'url', 'email', 'phone_number', 'formula', 'unique_id',
  'created_time', 'last_edited_time'
]);

function assertCompleteList(data, endpoint) {
  const status = data?.request_status?.status;
  if (status && status !== 'complete') {
    throw new Error(`Resposta incompleta do Notion em ${endpoint}: ${status}.`);
  }
  if (!Array.isArray(data?.results)) throw new Error(`Resposta sem results em ${endpoint}.`);
  if (data.has_more && !data.next_cursor) throw new Error(`Paginação inconsistente em ${endpoint}: has_more sem next_cursor.`);
}

async function queryRoute(source, { pageSize, selectedProperties }) {
  let suffix = '';
  if (selectedProperties) {
    const schema = await request(`/data_sources/${source.dataSourceId}`);
    const params = new URLSearchParams();
    for (const property of Object.values(schema.properties || {})) {
      if (SIMPLE.has(property.type) && property.id) params.append('filter_properties[]', property.id);
    }
    if (params.size) suffix = `?${params.toString()}`;
  }

  const pages = [];
  let cursor;
  let rounds = 0;
  do {
    if (++rounds > 500) throw new Error(`Paginação excedeu o limite de segurança em ${source.name}.`);
    const body = {
      page_size: pageSize,
      result_type: 'page',
      in_trash: false,
      ...(cursor ? { start_cursor: cursor } : {})
    };
    const endpoint = `/data_sources/${source.dataSourceId}/query${suffix}`;
    const data = await request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    assertCompleteList(data, endpoint);
    pages.push(...data.results.filter(item => item.object === 'page'));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  const unique = new Map(pages.map(page => [page.id, page]));
  if (unique.size !== pages.length) throw new Error(`A consulta de ${source.name} retornou páginas duplicadas.`);
  return [...unique.values()];
}

async function searchFallback(source) {
  console.warn(`Usando rota alternativa de busca para ${source.name}.`);
  const found = [];
  let cursor;
  let rounds = 0;
  do {
    if (++rounds > 500) throw new Error(`Busca alternativa excedeu o limite de segurança em ${source.name}.`);
    const body = {
      page_size: 100,
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
  const pages = await mapLimit([...unique.values()], 4, page => request(`/pages/${page.id}`));
  return pages;
}

export async function queryAll(source) {
  const routes = [
    { pageSize: 100, selectedProperties: true, label: 'propriedades selecionadas, lote 100' },
    { pageSize: 25, selectedProperties: true, label: 'propriedades selecionadas, lote 25' },
    { pageSize: 25, selectedProperties: false, label: 'todas as propriedades, lote 25' },
    { pageSize: 10, selectedProperties: false, label: 'todas as propriedades, lote 10' }
  ];
  const errors = [];
  for (const route of routes) {
    try {
      const pages = await queryRoute(source, route);
      if (!pages.length) throw new Error('consulta retornou zero páginas');
      console.log(`${source.name}: ${pages.length} páginas pela rota ${route.label}.`);
      return pages.map(normalizePage);
    } catch (error) {
      errors.push(`${route.label}: ${error.message}`);
      console.warn(`${source.name}: falha na rota ${route.label}: ${error.message}`);
    }
  }
  try {
    const pages = await searchFallback(source);
    if (!pages.length) throw new Error('busca alternativa retornou zero páginas');
    console.log(`${source.name}: ${pages.length} páginas pela busca alternativa.`);
    return pages.map(normalizePage);
  } catch (error) {
    errors.push(`busca alternativa: ${error.message}`);
  }
  throw new Error(`Não foi possível consultar ${source.name} por nenhuma rota. ${errors.join(' | ')}`);
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

function normalizePage(page) {
  const properties = Object.fromEntries(Object.entries(page.properties || {}).map(([name, property]) => [name, value(property)]));
  const titleProperty = Object.values(page.properties || {}).find(property => property.type === 'title');
  return {
    id: page.id,
    title: titleProperty ? value(titleProperty) : '',
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties
  };
}

function blockText(block) {
  const payload = block?.[block.type];
  const text = plain(payload?.rich_text);
  if (!text) return '';
  const prefix = block.type === 'heading_1' ? '# ' : block.type === 'heading_2' ? '## ' : block.type === 'heading_3' ? '### ' : block.type.includes('bulleted') ? '- ' : block.type.includes('numbered') ? '1. ' : '';
  return `${prefix}${text}`;
}

async function blocksMarkdown(id, depth = 0) {
  if (depth > 4) return '';
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
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}
