import {BASE,escapeHTML} from '../common.js?v=26.1';
const waitForAudit=()=>new Promise((resolve,reject)=>{let attempts=0;const tick=()=>{const quality=document.querySelector('#qualidade');if(quality)return resolve(quality);if(attempts++>150)return reject(new Error('Auditoria não ficou pronta.'));setTimeout(tick,40)};tick()});
try{
 const[quality,data]=await Promise.all([waitForAudit(),fetch(BASE+'data/audit.json',{cache:'no-store'}).then(r=>r.json())]);
 const items=(data.quality||[]).filter(item=>item.title==='Registro incompleto no Caderno de Erros'&&/Origem \/ Dia ID/.test(item.detail||''));
 const section=document.createElement('section');section.className='section';section.id='erros-sem-origem';section.dataset.unlinkedErrors=String(items.length);section.innerHTML=`<div class="section-head"><div><span class="kicker">Rastreabilidade pendente</span><h2>Erros sem origem confirmada</h2><p>Estes registros existem no Caderno de Erros, mas ainda não possuem vínculo comprovado com um PE. Nenhuma origem foi presumida pelo site.</p></div><span class="stamp">${items.length} pendentes</span></div><div class="grid two">${items.map((item,index)=>`<article class="card alert" data-level="warning"><span class="alert-icon">${index+1}</span><div><b>${escapeHTML(item.title)}</b><p>${escapeHTML(item.detail)} · aguardando confirmação no Notion.</p></div><a href="${item.url}" target="_blank" rel="noopener">Conferir registro ↗</a></article>`).join('')}</div>`;
 quality.before(section);
}catch(error){console.error('Erros sem origem indisponíveis',error)}
