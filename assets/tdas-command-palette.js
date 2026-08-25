import {readModuleState} from './integration/module-store.js?v=2.1.0';
import {readSessionDraft} from './integration/session-draft.js?v=1.0.0';

const BASE='/sedes-tdas-dashboard/';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let items=[],matches=[],selected=0,lastFocus=null;

const staticItems=[
 {group:'Ações',kind:'action',icon:'⌂',label:'Faça agora',meta:'Voltar à Central de Comando',href:BASE,keywords:'inicio home central comando hoje'},
 {group:'Ações',kind:'action',icon:'▶',label:'Resolver questões',meta:'Abrir o player de questões',href:BASE+'resolver/',keywords:'questoes simulado resolver executar player'},
 {group:'Ações',kind:'action',icon:'↻',label:'Prioridades',meta:'Ver focos para revisão externa',href:BASE+'revisar/',keywords:'prioridade revisao revisar diagnostico externo'},
 {group:'Ações',kind:'risk',icon:'!',label:'Caderno de erros',meta:'Reincidências, causas e marcações',href:BASE+'caderno-erros/',keywords:'erro erros reincidencia causa caderno'},
 {group:'Ações',kind:'action',icon:'▥',label:'Progresso',meta:'Desempenho local e diagnóstico',href:BASE+'desempenho/',keywords:'desempenho progresso estatistica diagnostico'},
 {group:'Navegação',kind:'route',icon:'✓',label:'Check do Edital',meta:'Raio-X do Cargo 202',href:BASE+'riscos/',keywords:'edital raio x risco topicos cobertura'},
 {group:'Navegação',kind:'route',icon:'↗',label:'Plano PE01–PE112',meta:'Cronograma e próximas execuções',href:BASE+'agenda/',keywords:'agenda plano cronograma pe ciclo'},
 {group:'Navegação',kind:'route',icon:'▤',label:'Biblioteca',meta:'Matérias e conteúdo',href:BASE+'materias/',keywords:'biblioteca materia conteudo material'},
 {group:'Navegação',kind:'route',icon:'✎',label:'Redações',meta:'Banco Discursivo TDAS',href:BASE+'redacoes/',keywords:'redacao discursiva texto'},
 {group:'Sistema',kind:'route',icon:'▦',label:'Bancos de dados',meta:'Auditoria, histórico e registros',href:BASE+'auditoria/',keywords:'auditoria banco dados sincronizacao historico'},
 {group:'Sistema',kind:'route',icon:'⚙',label:'Configurações',meta:'Preferências, release e dados locais',href:BASE+'configuracoes/',keywords:'configuracoes tema release dados locais'}
];
const peItems=Array.from({length:112},(_,index)=>{const number=index+1,pe=`PE${String(number).padStart(2,'0')}`;return{group:'PEs',kind:'pe',icon:'◎',label:pe,meta:'Abrir execução diária',href:`${BASE}estudar/?pe=${pe}`,keywords:`pe ${number} plano execucao material questoes`}});

function localActionItems(){
 const state=readModuleState(),draft=readSessionDraft(),now=Date.now(),signals=(state.reviews||[]).filter(item=>item.status==='pending'&&Number(item.dueAt)<=now),errors=state.errors||[];
 const out=[];
 if(draft){const progress=Object.keys(draft.session?.answers||{}).length,total=draft.session?.questionIds?.length||0;out.push({group:'Continuar',kind:'action',icon:'▶',label:`Continuar ${draft.peId||'sessão'}`,meta:`Questão ${Math.min(total,(draft.session?.currentIndex||0)+1)} de ${total} · ${progress} respondidas`,href:`${BASE}resolver/?resume=1${draft.peId?`&pe=${encodeURIComponent(draft.peId)}`:''}`,keywords:'continuar retomar sessao interrompida rascunho'})}
 if(signals.length)out.push({group:'Continuar',kind:'action',icon:'↻',label:`Ver prioridades · ${signals.length} ${signals.length===1?'sinal':'sinais'}`,meta:'Sinais locais para direcionar a revisão fora do TDAS',href:`${BASE}revisar/`,keywords:'prioridade revisao externa sinal pendente'});
 if(errors.length)out.push({group:'Continuar',kind:'risk',icon:'!',label:`Tratar ${errors.length} ${errors.length===1?'erro local':'erros locais'}`,meta:'Abrir reincidências e causas classificadas',href:BASE+'caderno-erros/',keywords:'tratar erros reincidencias causa'});
 return out;
}
async function remoteItems(){
 const [subjects,agenda,home]=await Promise.all([
  fetch(BASE+'data/subjects.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(BASE+'data/agenda.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch(BASE+'data/home.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
 ]);
 const out=[];
 for(const subject of subjects?.subjects||[])out.push({group:'Matérias',kind:'subject',icon:'▤',label:subject.subject,meta:`${subject.errors||0} erros · ${subject.recurrent||0} reincidentes`,href:`${BASE}materias/${subject.slug}/`,keywords:`materia ${subject.subject} ${(subject.top_patterns||[]).map(x=>x.pattern).join(' ')}`});
 for(const row of agenda?.allFuture||[])out.push({group:'Próximos PE',kind:'pe',icon:'↗',label:`${row.pe} · ${row.title}`,meta:`${row.date||''} · ${row.type||'atividade'} · ${row.planned_questions||0} questões`,href:`${BASE}estudar/?pe=${encodeURIComponent(row.pe)}`,keywords:`${row.pe} ${row.title} ${row.type} ${row.source}`});
 if(home?.today?.pe)out.unshift({group:'Continuar',kind:'action',icon:'◎',label:`PE de hoje · ${home.today.pe}`,meta:`${home.today.title} · ${home.today.status}`,href:`${BASE}estudar/?pe=${encodeURIComponent(home.today.pe)}`,keywords:`hoje ${home.today.pe} ${home.today.title} ${home.today.status}`});
 return out;
}
function scoreItem(item,query){if(!query)return item.group==='Continuar'?100:item.group==='Ações'?80:item.group==='Navegação'?60:20;const q=normalize(query),label=normalize(item.label),meta=normalize(item.meta),hay=normalize(`${item.label} ${item.meta} ${item.keywords||''}`),terms=q.split(/\s+/).filter(Boolean);if(!terms.every(term=>hay.includes(term)))return-1;let score=10;if(label===q)score+=100;else if(label.startsWith(q))score+=70;else if(label.includes(q))score+=45;if(meta.includes(q))score+=20;if(item.kind==='action')score+=12;if(item.group==='Continuar')score+=18;return score}
function groupedMarkup(rows){let group='';return rows.map((item,index)=>{const heading=item.group!==group?`<div class="tdas-command-group">${esc(item.group)}</div>`:'';group=item.group;return`${heading}<a class="tdas-command-item ${index===selected?'active':''}" data-command-index="${index}" data-kind="${esc(item.kind)}" href="${esc(item.href)}"><i>${esc(item.icon)}</i><span><b>${esc(item.label)}</b><small>${esc(item.meta)}</small></span><span>›</span></a>`}).join('')}
function render(query=''){
 const results=document.querySelector('[data-command-results]');if(!results)return;
 const ranked=items.map(item=>({item,score:scoreItem(item,query)})).filter(row=>row.score>=0).sort((a,b)=>b.score-a.score||a.item.group.localeCompare(b.item.group,'pt-BR')||a.item.label.localeCompare(b.item.label,'pt-BR'));
 matches=ranked.slice(0,query?18:10).map(row=>row.item);selected=Math.min(selected,Math.max(0,matches.length-1));
 results.innerHTML=matches.length?groupedMarkup(matches):'<div class="tdas-command-empty"><b>Nada encontrado</b><span>Tente PE88, Português, prioridade, redação ou edital.</span></div>';
 const counter=document.querySelector('[data-command-count]');if(counter)counter.textContent=query?`${ranked.length} resultado${ranked.length===1?'':'s'}`:'Ações e atalhos mais úteis';
}
function setSelected(index){if(!matches.length)return;selected=(index+matches.length)%matches.length;document.querySelectorAll('[data-command-index]').forEach((node,i)=>node.classList.toggle('active',i===selected));document.querySelector(`[data-command-index="${selected}"]`)?.scrollIntoView({block:'nearest'})}
function openPalette(){if(document.documentElement.classList.contains('tdas-player-focus'))return;const overlay=document.querySelector('[data-command-overlay]');if(!overlay)return;lastFocus=document.activeElement;overlay.hidden=false;document.documentElement.classList.add('tdas-command-open');const input=overlay.querySelector('[data-command-input]');input.value='';selected=0;const remotes=items.filter(item=>item._remote);items=[...localActionItems(),...staticItems,...peItems,...remotes];render('');setTimeout(()=>input.focus(),0)}
function closePalette(){const overlay=document.querySelector('[data-command-overlay]');if(!overlay||overlay.hidden)return;overlay.hidden=true;document.documentElement.classList.remove('tdas-command-open');lastFocus?.focus?.()}
function navigateSelected(){const target=matches[selected];if(target)location.href=target.href}
function renderShell(){if(document.querySelector('[data-command-overlay]'))return;const overlay=document.createElement('div');overlay.className='tdas-command-overlay';overlay.dataset.commandOverlay='';overlay.dataset.commandPaletteShell='';overlay.hidden=true;overlay.innerHTML=`<section class="tdas-command-dialog" role="dialog" aria-modal="true" aria-label="Comandos e busca TDAS"><div class="tdas-command-head"><span>⌕</span><input data-command-input autocomplete="off" spellcheck="false" placeholder="Digite uma ação, matéria ou PE…" aria-label="Buscar comando"><button class="tdas-command-close" type="button" data-command-close aria-label="Fechar">×</button></div><div class="tdas-command-meta"><span><kbd>↑↓</kbd> navegar <kbd>Enter</kbd> abrir</span><span data-command-count>Ações e atalhos mais úteis</span></div><div class="tdas-command-results" data-command-results></div><footer class="tdas-command-foot"><span>TDAS PRO · navegação sem perder contexto</span><span>Esc para fechar</span></footer></section>`;document.body.appendChild(overlay)}
function renderTrigger(){const actions=document.querySelector('.topbar .actions');if(!actions||actions.querySelector('[data-command-open]'))return;const button=document.createElement('button');button.type='button';button.className='tdas-command-trigger';button.dataset.commandOpen='';button.setAttribute('aria-label','Abrir comandos e busca');button.innerHTML='<span>⌕</span><span>Buscar</span><kbd>⌘K</kbd>';actions.prepend(button)}
function bind(){if(document.documentElement.dataset.commandPaletteReady)return;document.documentElement.dataset.commandPaletteReady='1';document.addEventListener('click',event=>{if(event.target.closest('[data-command-open]')){openPalette();return}if(event.target.closest('[data-command-close]')){closePalette();return}if(event.target.matches('[data-command-overlay]')){closePalette();return}const item=event.target.closest('[data-command-index]');if(item){selected=Number(item.dataset.commandIndex)||0;closePalette()}});document.addEventListener('input',event=>{if(event.target.matches('[data-command-input]')){selected=0;render(event.target.value)}});document.addEventListener('keydown',event=>{const overlay=document.querySelector('[data-command-overlay]'),open=overlay&&!overlay.hidden,editable=/input|textarea|select/i.test(document.activeElement?.tagName||'');if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open?closePalette():openPalette();return}if(!open&&event.key==='/'&&!editable){const homeSearch=document.querySelector('[data-pro-search]');event.preventDefault();if(homeSearch)homeSearch.focus();else openPalette();return}if(!open)return;if(event.key==='Escape'){event.preventDefault();closePalette()}else if(event.key==='ArrowDown'){event.preventDefault();setSelected(selected+1)}else if(event.key==='ArrowUp'){event.preventDefault();setSelected(selected-1)}else if(event.key==='Enter'){event.preventDefault();navigateSelected()}else if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('input,button,a[href]')].filter(node=>!node.hidden);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}})}
async function init(){renderShell();renderTrigger();bind();items=[...staticItems,...peItems];render('');const remotes=await remoteItems();remotes.forEach(item=>item._remote=true);items=[...localActionItems(),...staticItems,...peItems,...remotes];render('')}
init().catch(error=>console.error('TDAS command palette',error));
export{openPalette,closePalette};
