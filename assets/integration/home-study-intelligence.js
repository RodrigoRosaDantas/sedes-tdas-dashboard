import {BASE} from '../common.js?v=26.1';
import {readModuleState} from './module-store.js?v=2.1.0';
import {buildStudyAnalytics} from './study-analytics.js?v=1.0.0';

const pct=value=>value==null?'—':`${Number(value).toFixed(1).replace('.',',')}%`;
const num=value=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(Number(value||0));
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node};

function metric(label,value,detail){const card=el('article','card metric');card.append(el('small','',label),el('strong','',value),el('span','',detail));return card}
function action(href,label){const link=el('a','btn',label);link.href=href;return link}
function panel(label,title,detail,href,actionLabel){const card=el('article','card panel');card.append(el('small','',label),el('h3','',title),el('p','',detail),action(href,actionLabel));return card}

function buildSection(analytics){
  if(!analytics.total.attempts)return null;
  const section=el('section','tdas-dashboard-section');section.dataset.studyIntelligence='1';
  const head=el('div','section-head'),copy=el('div');copy.append(el('span','kicker','Dados locais · este dispositivo'),el('h2','','Seu ritmo real de estudo'),el('p','','Leitura das sessões concluídas no módulo. O snapshot oficial continua separado.'));head.append(copy,action(`${BASE}desempenho/`,'Abrir análise completa →'));
  const metrics=el('div','grid metrics');metrics.append(
    metric('Questões · 7 dias',num(analytics.last7.questions),`${analytics.trend.questionsDelta7>=0?'+':''}${analytics.trend.questionsDelta7} vs. janela anterior`),
    metric('Aproveitamento · 7 dias',pct(analytics.last7.accuracy),analytics.trend.accuracyDelta7==null?'sem base anterior':`${analytics.trend.accuracyDelta7>=0?'+':''}${analytics.trend.accuracyDelta7.toFixed(1).replace('.',',')} p.p. vs. 7 dias anteriores`),
    metric('Velocidade média',analytics.total.questionsPerHour==null?'—':`${num(analytics.total.questionsPerHour)}/h`,'baseada no tempo das sessões'),
    metric('Sequência atual',analytics.streak.current,`recorde local: ${analytics.streak.longest} dia${analytics.streak.longest===1?'':'s'}`)
  );
  const details=el('div','grid two'),top=analytics.topics[0]||null;
  const reviewTitle=analytics.review.due?`${analytics.review.due} revisão${analytics.review.due===1?'':'ões'} vencida${analytics.review.due===1?'':'s'}`:'Nenhuma revisão vencida';
  const reviewDetail=`Domínio confirmado em ${pct(analytics.review.masteredRate)} das revisões com decisão pedagógica.${analytics.review.criticalDue?` ${analytics.review.criticalDue} crítica${analytics.review.criticalDue===1?'':'s'}.`:''}`;
  const riskTitle=top?top.topic:'Sem risco temático calculável';
  const riskDetail=top?`Risco ${top.riskScore} = ${top.errors}×4 + ${top.uncertain}×2 · ${pct(top.accuracy)} de acerto.`:'Continue registrando respostas para formar uma amostra útil.';
  details.append(panel('Revisão',reviewTitle,reviewDetail,`${BASE}revisar/`,'Abrir revisões'),panel('Maior risco local',riskTitle,riskDetail,`${BASE}desempenho/`,'Ver mapa de risco'));
  section.append(head,metrics,details);return section;
}

function mount(){
  if(document.querySelector('[data-study-intelligence]'))return true;
  const main=document.querySelector('main'),anchor=main?.querySelector('.tdas-dashboard-section');if(!main||!anchor)return false;
  try{const state=readModuleState(),analytics=buildStudyAnalytics({attempts:state.attempts,reviews:state.reviews}),section=buildSection(analytics);if(section)anchor.after(section);return true}catch(error){console.warn('Inteligência local da Home indisponível:',error);return true}
}
if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000)}
