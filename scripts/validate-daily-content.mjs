import fs from 'node:fs/promises';
import path from 'node:path';
import{isValidQuestionStem}from'./question-stem-policy.mjs';
const ROOT=process.cwd(),read=file=>fs.readFile(path.join(ROOT,file),'utf8'),json=async file=>JSON.parse(await read(file)),exists=file=>fs.access(path.join(ROOT,file)).then(()=>true).catch(()=>false),required=(condition,message)=>{if(!condition)throw new Error(`Conteúdo diário: ${message}`)};
const[catalog,contract,today,answerService]=await Promise.all([json('data/integration/question-catalog.json'),json('data/integration/daily-execution.json'),json('data/today.json'),json('data/integration/answer-key-service.json')]);
const pipeline=await read('scripts/notion/daily-content.mjs'),sync=await read('scripts/sync-notion.mjs'),dashboard=await read('assets/integration/module-dashboard.js'),questionPage=await read('assets/integration/daily-question-page.js'),player=await read('assets/integration/module-player.js'),answerClient=await read('assets/integration/answer-key-client.js'),postprocess=await read('scripts/postprocess-v26.mjs'),sw=await read('sw.js');
required(pipeline.includes('discoverDailyPages')&&pipeline.includes('prepareDailyContent'),'pipeline de descoberta ausente');
for(const root of ['364cf5a26731813ca00ed9ba45ab6d51','364cf5a267318105abdbce6966704b5d'])required(pipeline.includes(root),`raiz oficial ausente: ${root}`);
required(pipeline.includes('`/blocks/${parentId}/children'),'pipeline não percorre filhos do Notion');
required(sync.includes('prepareDailyContent')&&sync.includes('data/integration/daily-material.json'),'sincronizador não publica material diário');
required(sync.includes('data/integration/question-catalog.json')&&sync.includes('question-keys'),'sincronizador não publica catálogo e correção separados');
required(dashboard.includes('daily-material.json')&&dashboard.includes('daily-material-content'),'Estudar não renderiza o material incorporado');
required(questionPage.includes('question-catalog.json')&&questionPage.includes('Correção separada'),'Questões não validam o catálogo diário');
required(player.indexOf('async function finishSession')>=0&&player.indexOf('loadAnswerKey(state.catalog')>player.indexOf('async function finishSession'),'correção pode ser carregada antes da finalização');
const precacheLists=(sw.match(/const (?:ASSETS|DATA)=\[[^;]+/g)||[]).join('\n');
required(!postprocess.includes("'data/integration/question-keys/")&&!precacheLists.includes('question-keys/'),'arquivo de correção não pode ser pré-carregado');
required(answerClient.includes("credentials:'omit'")&&answerClient.includes('publicFallbackAllowed'),'cliente privado ausente ou permissivo');

if(catalog.mode==='operational-empty'){
 required(catalog.questionCount===0&&catalog.questions?.length===0,'catálogo vazio contém questões');
 required(await exists('data/integration/daily-material.json'),'placeholder do material ausente');
 const material=await json('data/integration/daily-material.json');
 required(material.mode==='operational-empty','placeholder do material inválido');
 console.log('Conteúdo diário validado em modo de preparação: pipeline presente e nenhum conteúdo fictício ativo.');
}else if(catalog.mode==='notion-daily-empty'){
 required(catalog.peId===today.current.pe&&catalog.questionCount===0,'PE sem questões diverge do dia atual');
 console.log(`Conteúdo diário validado: ${catalog.peId} sem questões programadas.`);
}else{
 required(catalog.mode==='notion-daily','modo do catálogo diário inválido');
 required(catalog.peId===today.current.pe,`catálogo ${catalog.peId} diverge do dia ${today.current.pe}`);
 required(catalog.questionCount===catalog.questions.length&&catalog.questionCount===today.current.meta,'quantidade de questões diverge da meta oficial');
 const material=await json('data/integration/daily-material.json');
 required(material.mode==='notion-daily-material'&&material.peId===catalog.peId&&material.html?.length>200,'material diário inválido');
 if(answerService.mode==='legacy-public'){
  required(/^data\/integration\/question-keys\/pe\d+\.json$/i.test(catalog.keyPath||''),'caminho legado da correção inválido');
  required(await exists(catalog.keyPath),'arquivo legado de correção ausente durante a transição');
  const key=await json(catalog.keyPath);required(key.material_id===catalog.catalogId&&key.answers?.length===catalog.questionCount,'correção legada incompatível com o catálogo');
 }else{
  required(answerService.mode==='private'&&answerService.publicFallbackAllowed===false,'serviço privado inválido');
  required(catalog.keyPath==null&&/^daily\/tdas-pe\d+-[a-f0-9]+$/i.test(catalog.keyRef||''),'referência privada diária inválida');
 }
 const ids=new Set(catalog.questions.map(question=>question.id));
 required(ids.size===catalog.questionCount,'IDs de questões duplicados');
 const allowedQuestionKeys=['alternativas','assunto','enunciado','id','numeroOriginal'];
 const allowedCatalogKeys=['authorizedSource','catalogId','description','keyPath','keyRef','mode','peId','questionCount','questions','schemaVersion','suggestedMinutes','title'].filter(key=>Object.hasOwn(catalog,key));
 required(JSON.stringify(Object.keys(catalog).sort())===JSON.stringify(allowedCatalogKeys),'catálogo público contém campo não autorizado');
 for(const question of catalog.questions){
  required(JSON.stringify(Object.keys(question).sort())===JSON.stringify(allowedQuestionKeys),`${question.id||'questão'} contém campo não autorizado`);
  required(isValidQuestionStem(question.enunciado),`${question.id} sem enunciado suficiente`);
  const optionKeys=Object.keys(question.alternativas||{}).sort();
  required(optionKeys.length>=2&&optionKeys.length<=5,`${question.id} deve possuir entre duas e cinco alternativas`);
  required(JSON.stringify(optionKeys)===JSON.stringify(['A','B','C','D','E'].slice(0,optionKeys.length)),`${question.id} possui alternativas descontínuas`);
  required(optionKeys.every(option=>question.alternativas?.[option]),`${question.id} possui alternativa vazia`);
 }
 required(!('answers' in catalog)&&!('gabarito' in catalog)&&!('comentarios' in catalog)&&!('fundamentos' in catalog),'catálogo público contém estrutura de correção');
 required(contract.current?.peId===catalog.peId&&contract.current?.materialPageId===material.source?.pageId,'contrato atual diverge do conteúdo publicado');
 console.log(`Conteúdo diário validado: ${catalog.peId}, material completo e ${catalog.questionCount} questões com correção estruturalmente separada.`);
}
