import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.0.0';

const formatDate = value => new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
const topicKey = item => String(item?.subassunto || item?.assunto || 'Sem assunto').trim() || 'Sem assunto';
function buildRecurrences(errors = []) {
  const groups = new Map();
  for (const item of errors) {
    const topic = topicKey(item);
    const key = topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    const current = groups.get(key) || {topic, count: 0, pes: new Set(), latestAt: 0};
    current.count += 1;
    if (item.peId) current.pes.add(String(item.peId));
    current.latestAt = Math.max(current.latestAt, Number(item.createdAt || 0));
    groups.set(key, current);
  }
  return [...groups.values()].map(item => ({...item, pes: [...item.pes]})).sort((a, b) => b.count - a.count || b.latestAt - a.latestAt || a.topic.localeCompare(b.topic, 'pt-BR'));
}
const recurrenceLevel = count => count >= 3 ? {label: 'Frequente', className: 'critical'} : count === 2 ? {label: 'Recorrente', className: 'warning'} : {label: 'Pontual', className: ''};
try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const {errors, marked} = readModuleState();
  const recurrences = buildRecurrences(errors);
  const repeated = recurrences.filter(item => item.count >= 2);
  const top = repeated[0] || null;
  const recurrenceSection = errors.length ? `<section class="section" data-error-recurrences><div class="section-head"><div><h2>Padrões observados</h2><p>Assuntos agrupados pelos erros confirmados deste dispositivo. Repetição é um sinal para diagnóstico, não uma fila de revisão dentro do TDAS.</p></div><span class="stamp">${repeated.length} tópico${repeated.length === 1 ? '' : 's'} recorrente${repeated.length === 1 ? '' : 's'}</span></div><div class="grid three">${recurrences.slice(0, 9).map(item => {const level = recurrenceLevel(item.count); return `<article class="card panel"><small><span class="status ${level.className}">${level.label}</span> · ${item.pes.length} PE${item.pes.length === 1 ? '' : 's'}</small><h3>${escapeHTML(item.topic)}</h3><p><strong>${item.count}</strong> ocorrência${item.count === 1 ? '' : 's'} confirmada${item.count === 1 ? '' : 's'}${item.latestAt ? ` · último registro em ${formatDate(item.latestAt)}` : ''}</p><span>${item.pes.length ? `Origem: ${escapeHTML(item.pes.slice(0, 5).join(' · '))}${item.pes.length > 5 ? '…' : ''}` : 'Sessões locais sem PE informado'}</span></article>`}).join('')}</div>${top ? `<article class="card panel"><small>Sinal mais recorrente</small><h3>${escapeHTML(top.topic)}</h3><p>O assunto apareceu ${top.count} vezes no histórico local. Use Prioridades ou o Mentor para decidir o que merece atenção fora deste caderno.</p><div class="hero-actions"><a class="btn primary" href="${BASE}revisar/">Ver prioridades</a><a class="btn" href="${BASE}mentor/">Abrir Mentor</a></div></article>` : ''}</section>` : '';
  document.querySelector('main').innerHTML = `<section class="hero"><span class="kicker">Histórico local</span><h1>Caderno de erros</h1><p>Erros confirmados e marcações das sessões deste dispositivo. O TDAS usa este caderno para diagnóstico; a revisão acontece fora da plataforma.</p><div class="tags"><span class="tag">${errors.length} erros confirmados</span><span class="tag">${repeated.length} tópicos recorrentes</span><span class="tag">${marked.length} marcações</span></div><div class="hero-actions"><a class="btn primary" href="${BASE}resolver/">Resolver questões</a><a class="btn" href="${BASE}revisar/">Ver prioridades</a><a class="btn" href="${BASE}mentor/">Abrir Mentor</a></div></section>${recurrenceSection}<section class="section"><div class="section-head"><div><h2>Erros confirmados</h2><p>Ocorrências preservadas para consulta e diagnóstico.</p></div></div>${errors.length ? `<div class="grid two">${errors.map(item => `<article class="card panel"><small>${item.peId ? escapeHTML(item.peId) : 'Sessão local'} · questão ${item.numeroOriginal ?? '—'} · ${formatDate(item.createdAt)}</small><h3>${escapeHTML(topicKey(item))}</h3><p>Marcada: <strong>${escapeHTML(item.selected)}</strong> · Gabarito: <strong>${escapeHTML(item.correctAnswer)}</strong></p></article>`).join('')}</div>` : '<article class="card panel"><p>Nenhum erro confirmado neste módulo.</p></article>'}</section><section class="section"><div class="section-head"><div><h2>Marcações</h2><p>Questões sinalizadas durante as sessões para diagnóstico posterior.</p></div></div>${marked.length ? `<div class="grid two">${marked.map(item => `<article class="card panel"><small>${item.peId ? escapeHTML(item.peId) : 'Sessão local'} · questão ${item.numeroOriginal ?? '—'}</small><h3>${escapeHTML(topicKey(item))}</h3><p>${escapeHTML(item.confidence)}</p></article>`).join('')}</div>` : '<article class="card panel"><p>Nenhuma questão marcada neste módulo.</p></article>'}</section><section class="section"><article class="card panel"><small>Fonte separada</small><h2>Caderno oficial sincronizado</h2><p>O histórico local acima não substitui os registros oficiais sincronizados do TDAS/PRO.</p><div class="hero-actions"><a class="btn" href="${BASE}questoes-erros/">Abrir caderno oficial</a></div></article></section>`;
} catch (error) {
  setLoadingError(error);
}
