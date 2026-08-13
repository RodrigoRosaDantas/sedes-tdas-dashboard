import {BASE, loadJSON, setupShell, setLoadingError} from '../common.js?v=24.1';
import {readModuleState} from './module-store.js?v=2.1.0';
import {buildStudyAnalytics} from './study-analytics.js?v=1.0.0';

const pct=value=>value==null?'—':`${Number(value).toFixed(1).replace('.',',')}%`;
const num=value=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(Number(value||0));
const duration=ms=>{const s=Math.max(0,Math.round(Number(ms||0)/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return h?`${h}h ${m}min`:m?`${m}min ${r}s`:`${r}s`};
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};
const link=(href,label,primary=false)=>{const node=el('a',primary?'btn primary':'btn',label);node.href=href;return node};
function metric(label,value,detail){const node=el('article','card metric');node.append(el('small','',label),el('strong','',value),el('span','',detail));return node}
function section(title,detail,stamp=''){const node=el('section','section'),head=el('div','section-head'),copy=el('div');copy.append(el('h2','',title),el('p','',detail));head.append(copy);if(stamp)head.append(el('span','stamp',stamp));node.append(head);return node}
function metrics(items){const grid=el('div','grid metrics');for(const item of items)grid.append(metric(...item));return grid}
function topicCard(item){const node=el('article','card panel');node.append(el('small','',`Risco ${item.riskScore} = ${item.errors}×4 + ${item.uncertain}×2`),el('h3','',item.topic),el('p','',`${item.correct}/${item.total} corretas · ${pct(item.accuracy)} · ${item.peCount} PE${item.peCount===1?'':'s'}`));const tags=el('div','tags');tags.append(el('span','tag',`${item.errors} erros`),el('span','tag',`${item.uncertain} incertezas`),el('span','tag',`${item.attemptCount} sessões`));node.append(tags);return node}

try{
  const shell=await loadJSON('data/more.json');setupShell('mais',shell.meta);
  const state=readModuleState(),a=buildStudyAnalytics({attempts:state.attempts,reviews:state.reviews}),main=document.querySelector('main');main.replaceChildren();
  const hero=el('section','hero');hero.append(el('span','kicker','Inteligência local de estudo'),el('h1','','Desempenho'),el('p','','Métricas reconstruídas das suas sessões reais deste dispositivo. O registro oficial do Notion permanece separado.'));
  const tags=el('div','tags');tags.append(el('span','tag',`${a.total.attempts} tentativas`),el('span','tag',`${a.total.questions} questões`),el('span','tag',`${a.last30.activeDays} dias ativos em 30 dias`),el('span','tag','Sem índice oculto'));hero.append(tags);
  const actions=el('div','hero-actions');actions.append(link(`${BASE}resolver/`,'Resolver questões',true),link(`${BASE}revisar/`,'Revisar'),link(`${BASE}evolucao/`,'Evolução oficial'));hero.append(actions);main.append(hero);
  if(!a.total.attempts){const empty=section('Nenhuma tentativa local','O painel será preenchido quando uma sessão real for concluída.');empty.append(link(`${BASE}resolver/`,'Iniciar sessão',true));main.append(empty);}
  else{
    main.append(metrics([
      ['Aproveitamento local',pct(a.total.accuracy),`${a.total.correct}/${a.total.questions} respostas corretas`],
      ['Questões acumuladas',num(a.total.questions),`${a.study.questions} estudo · ${a.reviewMode.questions} revisão`],
      ['Tempo de sessão',duration(a.total.elapsedMs),a.total.averageMsPerQuestion==null?'—':`${duration(a.total.averageMsPerQuestion)} por questão`],
      ['Hoje',a.today.questions,`${pct(a.today.accuracy)} · ${duration(a.today.elapsedMs)}`]
    ]));
    const rhythm=section('Ritmo e consistência','Últimos 7 dias comparados aos 7 dias imediatamente anteriores. O aproveitamento é ponderado pelo número de questões.','Janela móvel');rhythm.append(metrics([
      ['Questões · 7 dias',num(a.last7.questions),`${a.trend.questionsDelta7>=0?'+':''}${a.trend.questionsDelta7} versus janela anterior`],
      ['Aproveitamento · 7 dias',pct(a.last7.accuracy),a.trend.accuracyDelta7==null?'sem base anterior':`${a.trend.accuracyDelta7>=0?'+':''}${a.trend.accuracyDelta7.toFixed(1).replace('.',',')} p.p.`],
      ['Dias ativos · 30 dias',a.last30.activeDays,a.last30.questionsPerActiveDay==null?'—':`${num(a.last30.questionsPerActiveDay)} questões por dia ativo`],
      ['Sequência atual',a.streak.current,`recorde local: ${a.streak.longest} dia${a.streak.longest===1?'':'s'}`]
    ]));main.append(rhythm);
    const quality=section('Qualidade das respostas','Erro, dúvida, chute e marcação são sinais diferentes; acerto inseguro não é tratado como domínio pleno.',`${a.total.questionResults} respostas classificadas`);quality.append(metrics([
      ['Erros confirmados',a.total.errors,`${pct(a.total.errorRate)} das classificadas`],
      ['Respostas com incerteza',a.total.uncertain,`${pct(a.total.uncertaintyRate)} · dúvida, chute ou marcação`],
      ['Acertos seguros',a.total.secureCorrect,`${pct(a.total.secureCorrectRate)} das classificadas`],
      ['Velocidade média',a.total.questionsPerHour==null?'—':`${num(a.total.questionsPerHour)}/h`,a.total.averageMsPerQuestion==null?'sem tempo suficiente':`${duration(a.total.averageMsPerQuestion)} por questão`]
    ]));main.append(quality);
    const reviews=section('Recuperação em revisão','Mede o resultado posterior do erro ou da incerteza, não apenas a abertura da tarefa.');reviews.append(metrics([
      ['Revisões vencidas',a.review.due,`${a.review.criticalDue} com sinal de erro/reincidência`],
      ['Domínio confirmado',a.review.mastered,`${pct(a.review.masteredRate)} das revisões com decisão`],
      ['Ainda com dúvida',a.review.unsure,'reforço adicional quando aplicável'],
      ['Errou novamente',a.review.wrongAgain,`${pct(a.review.wrongAgainRate)} das revisões com decisão`]
    ]));main.append(reviews);
    if(a.topics.length){const risks=section('Mapa de risco temático','Fórmula transparente: erro × 4 + incerteza × 2. Ela organiza atenção; não é uma nota secreta de domínio.',`${a.topics.length} tópicos observados`),grid=el('div','grid two');for(const item of a.topics.slice(0,10))grid.append(topicCard(item));risks.append(grid);main.append(risks)}
    const next=section('Próxima ação derivada dos dados',a.recommendation.detail);next.prepend(el('span','kicker','Recomendação transparente'));next.querySelector('h2').textContent=a.recommendation.title;const nextActions=el('div','hero-actions');nextActions.append(link(a.recommendation.kind==='review'?`${BASE}revisar/`:`${BASE}resolver/`,a.recommendation.kind==='review'?'Abrir revisões':'Resolver questões',true),link(`${BASE}caderno-erros/`,'Ver erros'),link(`${BASE}mentor/`,'Abrir Mentor'));next.append(nextActions);main.append(next);
    const history=section('Últimas tentativas','Histórico local usado para reconstruir as métricas acima.'),grid=el('div','grid two');for(const item of [...state.attempts].sort((x,y)=>Number(y.finishedAt||0)-Number(x.finishedAt||0)).slice(0,20)){const card=el('article','card panel');card.append(el('small','',`${item.mode==='review'?'Revisão':'Estudo'}${item.peId?` · ${item.peId}`:''}`),el('h3','',`${item.correct}/${item.total} · ${pct(item.percent)}`),el('p','',`Tempo de sessão: ${duration(item.elapsedMs)} · ${item.total?duration(item.elapsedMs/item.total):'—'} por questão`));grid.append(card)}history.append(grid);main.append(history);
  }
  const separation=section('Separação preservada','Estas métricas não alteram a Evolução oficial, os PE nem o Notion. O histórico local é a fonte desta análise; o snapshot oficial continua sendo a fonte do acompanhamento oficial.');main.append(separation);
}catch(error){setLoadingError(error)}
