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
const recurrenceLevel = count => count >= 3 ? {label: 'Crítico', className: 'critical'} : count === 2 ? {label: 'Reincidente', className: 'warning'} : {label: 'Isolado', className: ''};
try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const {errors, marked} = readModuleState();
  const recurrences = buildRecurrences(errors);
  const repeated = recurrences.filter(item => item.count >= 2);
  const top = recurrences[0] || null;
  const recurrenceSection = errors.length ? `<section class="section" data-error-recurrences><div class="section-head"><div><h2>Reincidências prioritárias</h2><p>Assuntos agrupados pelos erros confirmados deste dispositivo. Quanto mais vezes o mesmo tópico reaparece, maior a prioridade de revisão.</p></div><span class="stamp">${repeated.length} tópico${repeated.length === 1 ? '' : 's'} reincidente${repeated.length === 1 ? '' : 's'}</span></div><div class="grid three">${recurrences.slice(0, 9).map(item => {const level = recurrenceLevel(item.count); return `<article class="card panel"><small><span class="status ${level.className}">${level.label}</span> · ${item.pes.length} PE${item.pes.length === 1 ? '' : 's'}</small><h3>${escapeHTML(item.topic)}</h3><p><strong>${item.count}</strong> erro${item.count === 1 ? '' : 's'} confirmado${item.count === 1 ? '' : 's'}${item.latestAt ? ` · último em ${formatDate(item.latestAt)}` : ''}</p><span>${item.pes.length ? `Origem: ${escapeHTML(item.pes.slice(0, 5).join(' · '))}${item.pes.length > 5 ? '…' : ''}` : 'Sessões locais sem PE informado'}</span></article>`}).join('')}</div>${top ? `<article class="card panel"><small>Próxima ação sugerida</small><h3>${top.count >= 2 ? `Revisar ${escapeHTML(top.topic)} antes de ampliar volume` : 'Ainda não há padrão reincidente'}</h3><p>${top.count >= 2 ? `O tópico concentra ${top.count} erros locais. Use a revisão adaptativa e confirme domínio antes de tratá-lo como resolvido.` : 'Há somente ocorrências isoladas; continue classificando as sessões para formar um padrão confiável.'}</p><div class="hero-actions"><a class="btn primary" href="${BASE}revisar/">Abrir revisões</a><a class="btn" href="${BASE}resolver/">Resolver questões</a></div></article>` : ''}</section>` : '';
  document.querySelector('main').innerHTML = `<section class="hero"><span class="kicker">Caderno do módulo</span><h1>Caderno de erros</h1><p>Erros confirmados e questões marcadas nas sessões reais deste módulo.</p><div class="tags"><span class="tag">${errors.length} erros confirmados</span><span class="tag">${repeated.length} tópicos reincidentes</span><span class="tag">${marked.length} marcações</span><span class="tag">Armazenamento local v2</span></div><div class="hero-actions"><a class="btn primary" href="${BASE}resolver/">Resolver questões</a><a class="btn" href="${BASE}questoes-erros/">Abrir caderno oficial sincronizado</a></div></section>${recurrenceSection}<section class="section"><div class="section-head"><div><h2>Erros confirmados locais</h2><p>Registro bruto preservado para você conferir cada ocorrência individual.</p></div></div>${errors.length ? `<div class="grid two">${errors.map(item => `<article class="card panel"><small>${item.peId ? escapeHTML(item.peId) : 'Sessão local'} · questão ${item.numeroOriginal ?? '—'} · ${formatDate(item.createdAt)}</small><h3>${escapeHTML(topicKey(item))}</h3><p>Marcada: <strong>${escapeHTML(item.selected)}</strong> · Gabarito: <strong>${escapeHTML(item.correctAnswer)}</strong></p></article>`).join('')}</div>` : '<article class="card panel"><p>Nenhum erro confirmado neste módulo.</p></article>'}</section><section class="section"><div class="section-head"><div><h2>Marcações</h2></div></div>${marked.length ? `<div class="grid two">${marked.map(item => `<article class="card panel"><small>${item.peId ? escapeHTML(item.peId) : 'Sessão local'} · questão ${item.numeroOriginal ?? '—'}</small><h3>${escapeHTML(topicKey(item))}</h3><p>${escapeHTML(item.confidence)}</p></article>`).join('')}</div>` : '<article class="card panel"><p>Nenhuma questão marcada neste módulo.</p></article>'}</section><section class="section"><article class="card panel"><h2>Separação preservada</h2><p>Este diagnóstico usa somente erros locais confirmados e não substitui nem modifica o Caderno de Erros TDAS/PRO sincronizado na plataforma.</p></article></section>`;
} catch (error) {
  setLoadingError(error);
}
