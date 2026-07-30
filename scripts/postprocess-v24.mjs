import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const VERSION='24.1';
const SYNC_TIMES=['00h50','06h50','12h50','18h50'];
const read=async(file,fallback=null)=>{try{return JSON.parse(await fs.readFile(path.join(ROOT,file),'utf8'))}catch{return fallback}};
const write=async(file,value)=>{const target=path.join(ROOT,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,`${JSON.stringify(value)}\n`,'utf8')};
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isRest=row=>/descanso|pausa/.test(norm(`${row?.title} ${row?.status} ${row?.type} ${row?.typ} ${row?.block}`));
const round=(value,digits=2)=>Number(Number(value||0).toFixed(digits));
function patchValue(base,patch){
 if(patch===undefined)return base;
 if(patch===null||typeof patch!=='object')return patch;
 if(Object.prototype.hasOwnProperty.call(patch,'$replace'))return patch.$replace;
 if(Array.isArray(base)){
  let out=[...base],key=patch.$key||'id';
  if(patch.$remove){const remove=new Set(patch.$remove);out=out.filter(item=>!remove.has(item?.[key]))}
  const merge=items=>{for(const item of items||[]){const index=out.findIndex(row=>row&&item&&row[key]===item[key]);if(index>=0)out[index]=patchValue(out[index],item);else out.push(item)}};
  if(patch.$upsert)merge(patch.$upsert);
  if(patch.$prepend){for(const item of [...patch.$prepend].reverse()){const index=out.findIndex(row=>row&&item&&row[key]===item[key]);if(index>=0)out.splice(index,1);out.unshift(item)}}
  if(patch.$append)merge(patch.$append);
  if(patch.$sortBy)out.sort((a,b)=>String(a?.[patch.$sortBy]??'').localeCompare(String(b?.[patch.$sortBy]??''),undefined,{numeric:true}));
  if(patch.$takeLast)out=out.slice(-Number(patch.$takeLast));
  if(patch.$limit)out=out.slice(0,Number(patch.$limit));
  return out;
 }
 const out=base&&typeof base==='object'&&!Array.isArray(base)?{...base}:{};
 for(const[key,value]of Object.entries(patch))if(!key.startsWith('$'))out[key]=patchValue(out[key],value);
 return out;
}
const localIso=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date());const get=type=>parts.find(part=>part.type===type)?.value;return`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-03:00`};

const [home,audit,agenda,errorIndex,future1,future2,actual1,actual2,actual3,legacy]=await Promise.all([
 read('data/home.json',{}),read('data/audit.json',{}),read('data/agenda.json',{}),read('data/error-questions/index.json',{}),
 read('data/export/future-01.json',[]),read('data/export/future-02.json',[]),read('data/export/actual-01.json',[]),read('data/export/actual-02.json',[]),read('data/export/actual-03.json',[]),read('data/live-v23.json',{})
]);
const homeMerged=patchValue(home,legacy['data/home.json']);
const auditMerged=patchValue(audit,legacy['data/audit.json']);
const future=[...patchValue(future1,legacy['data/export/future-01.json']),...patchValue(future2,legacy['data/export/future-02.json'])];
const actual=[...patchValue(actual1,legacy['data/export/actual-01.json']),...patchValue(actual2,legacy['data/export/actual-02.json']),...patchValue(actual3,legacy['data/export/actual-03.json'])];
const snapshotDate=homeMerged.meta?.snapshotDate||home.meta?.snapshotDate;
const examDate=homeMerged.meta?.examDate||home.meta?.examDate||'2026-09-06';
const dayMs=86400000;
const days=Math.max(1,Math.ceil((new Date(`${examDate}T12:00:00-03:00`)-new Date(`${snapshotDate}T12:00:00-03:00`))/dayMs)+1);
const pastRests=[...future1,...future2].filter(row=>isRest(row)&&row.date&&row.date<=snapshotDate);
const fulfilled=Number(home.metrics?.completed||0)+pastRests.length;
const totalPE=Number(home.metrics?.totalPE||112);
const remaining=Math.max(0,totalPE-fulfilled);
const resultQuestions=Number(auditMerged.summary?.meta_with_result||homeMerged.metrics?.resultQuestions||homeMerged.metrics?.questions||0);
const correct=Number(auditMerged.summary?.correct||homeMerged.metrics?.correct||0);
const accuracy=resultQuestions?round(correct/resultQuestions*100):0;
const plannedQuestions=future.filter(row=>!isRest(row)).reduce((sum,row)=>sum+(Number(row.planned_questions)||0),0);
const notStarted=Number(auditMerged.summary?.redactions_not_started||0);
const weeks=round((new Date(`${examDate}T12:00:00-03:00`)-new Date(`${snapshotDate}T12:00:00-03:00`))/604800000,1);
const perWeek=weeks?round(notStarted/weeks,1):notStarted;
const cutoff=new Date(`${snapshotDate}T12:00:00-03:00`);cutoff.setDate(cutoff.getDate()-27);
const recent=actual.filter(row=>row.date&&row.attempted>0&&row.acertos!=null&&new Date(`${row.date}T12:00:00-03:00`)>=cutoff);
const recentQuestions=recent.reduce((sum,row)=>sum+Number(row.attempted||0),0);
const recentCorrect=recent.reduce((sum,row)=>sum+Number(row.acertos||0),0);
const recent4=recentQuestions?round(recentCorrect/recentQuestions*100):accuracy;
const trueHigh=Number(audit.summary?.error_bank_high||0);
const meta={version:VERSION,syncTimes:SYNC_TIMES};
const summary={completed:fulfilled,current:homeMerged.today?.pe||homeMerged.latest?.pe||'',result_days:Number(auditMerged.summary?.result_days||0),missing_result_days:Number(auditMerged.summary?.missing_result_days||0),rest_days:pastRests.length,meta_completed:resultQuestions,meta_with_result:resultQuestions,correct,accuracy_result_days:accuracy,conservative_index:accuracy,linked_error_records:Number(auditMerged.summary?.linked_error_records||0),error_bank_total:Number(auditMerged.summary?.error_bank_total||errorIndex.total||0),error_bank_recurrent:Number(auditMerged.summary?.error_bank_recurrent||0),error_bank_high:trueHigh,error_bank_critical:Number(auditMerged.summary?.error_bank_critical||0),redactions_valid:Number(auditMerged.summary?.redactions_valid||0),redactions_corrected:Number(auditMerged.summary?.redactions_corrected||0),redactions_not_started:notStarted};
const overlay={
 'data/home.json':{meta,metrics:{completed:fulfilled,totalPE,questions:resultQuestions,resultQuestions,correct,accuracy,errors:summary.error_bank_total,redactions:summary.redactions_valid,calendarDays:days,operationalDays:days},projections:{$replace:[{label:'Ritmo de PE',value:`${round(remaining/days).toFixed(2).replace('.',',')} PE/dia`,formula:`${remaining} PE não iniciados ÷ ${days} dias operacionais inclusivos`},{label:'Ritmo de redações',value:`${perWeek.toFixed(1).replace('.',',')}/semana`,formula:`${notStarted} redações não iniciadas ÷ ${weeks.toFixed(1).replace('.',',')} semanas`},{label:'Questões com resultado',value:resultQuestions.toLocaleString('pt-BR'),formula:`${correct.toLocaleString('pt-BR')} acertos ÷ ${resultQuestions.toLocaleString('pt-BR')} questões com resultado = ${accuracy.toFixed(2).replace('.',',')}%`}]}},
 'data/today.json':{meta},'data/evolution.json':{meta,summary:{historical:accuracy,recent4,trend:round(recent4-accuracy),resultDays:summary.result_days}},'data/risks.json':{meta},
 'data/agenda.json':{meta,summary:{remainingPE:remaining,operationalDays:days,pace:round(remaining/days),plannedQuestionsMidpoint:plannedQuestions}},
 'data/redactions.json':{meta,summary:{perWeek,weeksRemaining:weeks}},'data/audit.json':{meta,summary},'data/more.json':{meta},'data/subjects.json':{meta},'data/error-questions/index.json':{meta},
 'data/export/summary.json':{meta:{version:VERSION,snapshot_date:snapshotDate,exam_date:examDate,timezone:'America/Sao_Paulo',actual_records:fulfilled,completed_records:fulfilled,future_records:remaining},summary},
 'data/notion/state.json':{schemaVersion:VERSION},
 'data/sync-history.json':{meta:{version:VERSION},entries:{$prepend:[{at:localIso(),kind:process.env.SYNC_KIND==='schedule'?'Sincronização automática':'Execução manual',status:'success',summary:`Plataforma TDAS v${VERSION} consolidada`,detail:`${summary.current}; ${fulfilled}/${totalPE} PE cumpridos; ${resultQuestions.toLocaleString('pt-BR')} questões com resultado; ${summary.error_bank_total} erros e ${summary.redactions_valid} redações preservados.`}],$key:'at',$limit:40}}
};
await write('data/live-v24.json',overlay);
let sw=await fs.readFile(path.join(ROOT,'sw.js'),'utf8');
sw=sw.replace(/const VERSION='[^']+';/,`const VERSION='tdas-v24-1-${String(snapshotDate).replaceAll('-','')}-official';`);
if(!sw.includes("BASE+'data/live-v24.json'"))sw=sw.replace("BASE+'data/live-v23.json'","BASE+'data/live-v23.json',BASE+'data/live-v24.json'");
await fs.writeFile(path.join(ROOT,'sw.js'),sw,'utf8');
console.log(JSON.stringify({version:VERSION,fulfilled,remaining,days,resultQuestions,correct,accuracy,recent4,plannedQuestions,errors:summary.error_bank_total,redactions:summary.redactions_valid}));