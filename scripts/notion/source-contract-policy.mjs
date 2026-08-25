const DAY_MS=86_400_000;
export const peCode=value=>{const match=String(value??'').match(/\bPE\s*0*(\d{1,3})\b/i);if(!match)return null;const n=Number(match[1]);return n>=1&&n<=112?`PE${String(n).padStart(2,'0')}`:null};
const strip=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\*\*|__|`/g,'').replace(/\\\|/g,'|').replace(/\s+/g,' ').trim();
const isoDate=value=>{const match=String(value??'').match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);return match?`${match[3]}-${match[2]}-${match[1]}`:''};
function parseRange(value){const text=strip(value);const range=text.match(/\b(\d{1,3})\s*(?:a|até|–|—|-)\s*(\d{1,3})\b/i);if(range)return{min:Number(range[1]),max:Number(range[2])};const exact=text.match(/\b(\d{1,3})\b/);return exact?{min:Number(exact[1]),max:Number(exact[1])}:null}
function tableRangeAfter(section,label){
 const source=String(section??''),labelNorm=String(label).toLocaleLowerCase('pt-BR');
 for(const row of source.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match=>match[1]);
  if(cells.length<2)continue;
  if(strip(cells[0]).toLocaleLowerCase('pt-BR').includes(labelNorm)){const parsed=parseRange(cells.at(-1));if(parsed)return parsed}
 }
 const markdownLine=source.split('\n').find(line=>line.includes('|')&&strip(line).toLocaleLowerCase('pt-BR').includes(labelNorm));
 if(markdownLine){const cells=markdownLine.split('|').map(strip).filter(Boolean);const parsed=parseRange(cells.at(-1));if(parsed)return parsed}
 return null;
}
function firstRangeAfter(section,label){return tableRangeAfter(section,label)}
function firstNumberAfter(section,labels){for(const label of labels){const range=tableRangeAfter(section,label);if(range&&range.min===range.max)return range.min}return null}
function field(section,label){const source=String(section??'');const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=source.match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([^\\n<]+)`,'i'));return match?strip(match[1]):''}
export function parseMicroMarkdown(markdown,week){
 const source=String(markdown??'').replace(/\r/g,'');
 const headings=[...source.matchAll(/^##\s+PE\s*0*(\d{1,3})\b[^\n]*$/gim)];
 const days=[];
 for(let index=0;index<headings.length;index++){
  const heading=headings[index],number=Number(heading[1]),pe=`PE${String(number).padStart(2,'0')}`;
  const section=source.slice(heading.index,headings[index+1]?.index??source.length);
  const headingText=strip(heading[0]).replace(/^#+\s*/,'');
  const rest=/\bdescanso\b/i.test(headingText)||/\*\*Obrigatório:\*\*\s*descanso/i.test(section);
  const officialExam=number===112||/\bprova oficial\b/i.test(headingText);
  const range=firstRangeAfter(section,'Total estimado')||firstRangeAfter(section,'Total do dia');
  const expectation=officialExam?{mode:'official_exam',min:null,max:null}:rest?{mode:'rest',min:0,max:0}:range?{mode:week===16?'adaptive':'strict',...range}:{mode:week===16?'adaptive':'unknown',min:null,max:null};
  days.push({
   pe,number,week,date:isoDate(headingText),title:headingText.replace(/^PE\d+\s*[—–-]?\s*/i,''),
   theme:field(section,'Tema principal'),block:field(section,'Bloco predominante'),type:field(section,'Tipo'),
   mainQuestions:firstNumberAfter(section,['Questões do tema principal','Questões cronometradas do pior bloco','Questões leves']),
   portugueseDose:firstNumberAfter(section,['Microdose Português']),
   specificDose:firstNumberAfter(section,['Microdose Específicos peso 2','Microdose Específicos']),
   expectation
  });
 }
 return days;
}
export function matchesExpectation(value,expectation){const n=Number(value);if(expectation?.mode==='official_exam')return true;if(!Number.isFinite(n))return false;if(expectation?.min==null||expectation?.max==null)return true;return n>=expectation.min&&n<=expectation.max}
const dateToNumber=value=>{const date=new Date(`${value}T12:00:00-03:00`);return Number.isNaN(date.getTime())?null:date.getTime()};
function severityFor({pe,currentPe,date,snapshotDate}){if(pe===currentPe)return'critical';const t=dateToNumber(date),today=dateToNumber(snapshotDate);if(t!=null&&today!=null&&t>today&&t-today<=DAY_MS)return'warning';return'info'}
function countOf(control){const raw=control?.planned_questions??control?.meta??0;const value=Number(raw);return Number.isFinite(value)?value:null}
function validatedCanonicalAgreement({pe,currentPe,control,catalog}){
 const controlCount=countOf(control),catalogCount=Number(catalog?.questionCount);
 const source=catalog?.authorizedSource||{};
 const explicitResolution=source.resolution==='validated-child-page';
 const traceableChildSource=source.type==='notion-daily-child-page'
  &&String(source.pageId||'').trim().length>0
  &&String(source.primaryPageId||'').trim().length>0
  &&String(source.pageId).replaceAll('-','').toLowerCase()!==String(source.primaryPageId).replaceAll('-','').toLowerCase();
 return pe===currentPe
  &&peCode(catalog?.peId)===currentPe
  &&(explicitResolution||traceableChildSource)
  &&String(source.url||'').trim().length>0
  &&Number.isFinite(controlCount)&&controlCount>0
  &&Number.isFinite(catalogCount)&&catalogCount===controlCount;
}
export function buildContractAssessment({controls=[],microDays=[],catalog=null,currentPe='',snapshotDate=''}){
 const byMicro=new Map(microDays.map(day=>[day.pe,day]));
 const byControl=new Map();
 for(const control of controls){const pe=peCode(control?.pe);if(pe&&!byControl.has(pe))byControl.set(pe,control)}
 const conflicts=[];
 for(const [pe,control]of byControl){
  const micro=byMicro.get(pe);if(!micro){conflicts.push({code:'micro_missing',pe,severity:severityFor({pe,currentPe,date:control.date,snapshotDate}),message:`${pe}: Micro não localizado.`});continue}
  if(micro.date&&control.date&&micro.date!==control.date)conflicts.push({code:'date_mismatch',pe,severity:severityFor({pe,currentPe,date:control.date,snapshotDate}),message:`${pe}: data do Micro ${micro.date} diverge do Controle ${control.date}.`});
  const count=countOf(control);
  if(micro.expectation.mode==='strict'||micro.expectation.mode==='rest'){
   if(!matchesExpectation(count,micro.expectation)){
    const canonical=validatedCanonicalAgreement({pe,currentPe,control,catalog});
    conflicts.push(canonical
     ?{code:'canonical_control_overrides_micro',pe,severity:'warning',message:`${pe}: Controle e bateria canônica validada concordam em ${count} questões; Micro ainda registra ${micro.expectation.min===micro.expectation.max?micro.expectation.min:`${micro.expectation.min}–${micro.expectation.max}`}.`}
     :{code:'control_vs_micro',pe,severity:severityFor({pe,currentPe,date:control.date,snapshotDate}),message:`${pe}: Controle prevê ${count??'—'} questões; Micro exige ${micro.expectation.min===micro.expectation.max?micro.expectation.min:`${micro.expectation.min}–${micro.expectation.max}`}.`});
   }
  }else if(micro.expectation.mode==='adaptive'&&!matchesExpectation(count,micro.expectation)){
   conflicts.push({code:'adaptive_control_gap',pe,severity:'info',message:`${pe}: Controle registra bateria-base ${count??'—'}; Micro da Semana 16 permanece soberano e adaptativo.`});
  }
 }
 const currentMicro=byMicro.get(currentPe)||null,currentControl=byControl.get(currentPe)||null,catalogCount=Number(catalog?.questionCount);
 if(currentMicro&&catalog&&['strict','rest'].includes(currentMicro.expectation.mode)&&!matchesExpectation(catalogCount,currentMicro.expectation)){
  const canonical=validatedCanonicalAgreement({pe:currentPe,currentPe,control:currentControl,catalog});
  conflicts.push(canonical
   ?{code:'canonical_catalog_overrides_micro',pe:currentPe,severity:'warning',message:`${currentPe}: catálogo canônico validado publicou ${catalogCount} questões e concorda com o Controle; Micro ainda registra ${currentMicro.expectation.min===currentMicro.expectation.max?currentMicro.expectation.min:`${currentMicro.expectation.min}–${currentMicro.expectation.max}`}.`}
   :{code:'catalog_vs_micro',pe:currentPe,severity:'critical',message:`${currentPe}: catálogo publicou ${Number.isFinite(catalogCount)?catalogCount:'—'} questões; Micro exige ${currentMicro.expectation.min===currentMicro.expectation.max?currentMicro.expectation.min:`${currentMicro.expectation.min}–${currentMicro.expectation.max}`}.`});
 }
 if(currentMicro&&catalog&&currentMicro.expectation.mode==='adaptive'&&!matchesExpectation(catalogCount,currentMicro.expectation))conflicts.push({code:'adaptive_catalog_gap',pe:currentPe,severity:'info',message:`${currentPe}: catálogo contém ${Number.isFinite(catalogCount)?catalogCount:'—'} questões; Micro da Semana 16 continua soberano e pode exigir complemento adaptativo.`});
 const currentConflicts=conflicts.filter(item=>item.pe===currentPe),critical=currentConflicts.filter(item=>item.severity==='critical');
 return{
  status:critical.length?'blocked':conflicts.some(item=>item.severity==='warning')?'ready_with_warnings':'ready',
  current:{pe:currentPe,status:critical.length?'blocked':'ready',micro:currentMicro,control:currentControl?{questions:countOf(currentControl),date:currentControl.date,status:currentControl.status||''}:null,catalog:catalog?{questions:Number.isFinite(catalogCount)?catalogCount:null,sourceUrl:catalog.authorizedSource?.url||''}:null,conflicts:currentConflicts},
  conflicts
 };
}
