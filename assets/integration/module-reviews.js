import {BASE, escapeHTML, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.0.0';

const formatDate = value => new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
try {
  const shell = await loadJSON('data/more.json');
  setupShell('mais', shell.meta);
  const now = Date.now();
  const reviews = [...readModuleState().reviews].sort((a, b) => a.dueAt - b.dueAt);
  const due = reviews.filter(item => item.status === 'pending' && item.dueAt <= now);
  const upcoming = reviews.filter(item => item.status === 'pending' && item.dueAt > now);
  const completed = reviews.filter(item => item.status === 'completed');
  const card = item => `<article class="card panel"><small>${escapeHTML(item.stage)} · ${item.peId ? escapeHTML(item.peId) : 'Sessão local'} · questão ${item.numeroOriginal ?? '—'}</small><h3>${escapeHTML(item.subassunto || item.assunto || 'Questão')}</h3><p>${item.status === 'completed' ? `Concluída em ${formatDate(item.completedAt)}` : item.dueAt <= now ? 'Disponível agora' : `Agendada para ${formatDate(item.dueAt)}`}</p>${item.status === 'pending' && item.dueAt <= now ? `<a class="btn primary" href="${BASE}resolver/?review=${encodeURIComponent(item.id)}">Revisar questão</a>` : ''}</article>`;
  document.querySelector('main').innerHTML = `<section class="hero"><span class="kicker">Revisão espaçada local</span><h1>Revisar</h1><p>Agenda D+1, D+7 e D+20 gerada exclusivamente por sessões concluídas neste módulo.</p><div class="tags"><span class="tag">${due.length} disponíveis</span><span class="tag">${upcoming.length} futuras</span><span class="tag">${completed.length} concluídas</span></div><div class="hero-actions"><a class="btn primary" href="${due[0] ? `${BASE}resolver/?review=${encodeURIComponent(due[0].id)}` : `${BASE}resolver/`}">${due.length ? 'Iniciar próxima revisão' : 'Abrir Resolver'}</a><a class="btn" href="${BASE}caderno-erros/">Abrir caderno</a></div></section><section class="section"><div class="section-head"><div><h2>Disponíveis agora</h2></div></div>${due.length ? `<div class="grid two">${due.map(card).join('')}</div>` : '<article class="card panel"><p>Nenhuma revisão disponível neste dispositivo.</p></article>'}</section><section class="section"><div class="section-head"><div><h2>Próximas revisões</h2></div></div>${upcoming.length ? `<div class="grid two">${upcoming.map(card).join('')}</div>` : '<article class="card panel"><p>Nenhuma revisão futura.</p></article>'}</section><section class="section"><div class="section-head"><div><h2>Concluídas</h2></div></div>${completed.length ? `<div class="grid two">${completed.slice(-20).reverse().map(card).join('')}</div>` : '<article class="card panel"><p>Nenhuma revisão concluída.</p></article>'}</section><footer class="footer"><span>Revisões do módulo · dados locais</span><span>Sem writeback</span></footer>`;
} catch (error) {
  setLoadingError(error);
}
