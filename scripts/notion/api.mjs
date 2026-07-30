import { API_BASE, API_VERSION, TOKEN, sleep } from './config.mjs';

export async function request(endpoint, options = {}, attempt = 0) {
  if (!TOKEN) throw new Error('O secret NOTION_TOKEN não está disponível no workflow.');
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': API_VERSION, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.ok) return response.json();
  const body = await response.text();
  if ((response.status === 429 || response.status >= 500) && attempt < 6) {
    const seconds = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Math.min(30000, 800 * 2 ** attempt + Math.random() * 400));
    return request(endpoint, options, attempt + 1);
  }
  throw new Error(`Notion API ${response.status} em ${endpoint}: ${body.slice(0, 800)}`);
}

const SIMPLE = new Set(['title','rich_text','number','select','multi_select','status','date','checkbox','url','email','phone_number','formula','unique_id','created_time','last_edited_time']);
export async function queryAll(source) {
  const schema = await request(`/data_sources/${source.dataSourceId}`);
  const params = new URLSearchParams();
  for (const p of Object.values(schema.properties || {})) if (SIMPLE.has(p.type) && p.id) params.append('filter_properties[]', p.id);
  const suffix = params.size ? `?${params}` : '';
  const pages = []; let cursor;
  do {
    const body = { page_size: 100, result_type: 'page', ...(cursor ? { start_cursor: cursor } : {}) };
    const data = await request(`/data_sources/${source.dataSourceId}/query${suffix}`, { method: 'POST', body: JSON.stringify(body) });
    pages.push(...data.results.filter(x => x.object === 'page'));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages.map(normalizePage);
}

function plain(items) { return Array.isArray(items) ? items.map(x => x.plain_text ?? x.text?.content ?? '').join('') : ''; }
function value(prop) {
  if (!prop?.type) return null; const v = prop[prop.type];
  if (prop.type === 'title' || prop.type === 'rich_text') return plain(v);
  if (prop.type === 'number' || prop.type === 'checkbox' || ['url','email','phone_number','created_time','last_edited_time'].includes(prop.type)) return v ?? null;
  if (prop.type === 'select' || prop.type === 'status') return v?.name ?? null;
  if (prop.type === 'multi_select') return (v || []).map(x => x.name);
  if (prop.type === 'date') return v?.start ?? null;
  if (prop.type === 'unique_id') return v ? `${v.prefix || ''}${v.number ?? ''}` : null;
  if (prop.type === 'formula') return !v ? null : v.type === 'date' ? v.date?.start ?? null : v[v.type] ?? null;
  return null;
}
function normalizePage(page) {
  const properties = Object.fromEntries(Object.entries(page.properties || {}).map(([n, p]) => [n, value(p)]));
  const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
  return { id: page.id, title: titleProp ? value(titleProp) : '', url: page.url, created_time: page.created_time, last_edited_time: page.last_edited_time, properties };
}
export async function fetchMarkdown(id) { try { return (await request(`/pages/${id}/markdown`)).markdown || ''; } catch (e) { console.warn(`Markdown indisponível para ${id}: ${e.message}`); return ''; } }
export async function mapLimit(items, limit, fn) { const out = new Array(items.length); let i = 0; async function worker(){ while (true){ const n=i++; if(n>=items.length)return; out[n]=await fn(items[n],n); } } await Promise.all(Array.from({length:Math.min(limit,items.length)},worker)); return out; }
