import {escapeHTML} from '../common.js?v=26.17.0';
import {createLocalBackup} from './local-backup.js?v=1.0.0';
import {getCloudSession,getOrCreateDeviceId,readCloudMeta,sendCloudMagicLink,signInCloudWithPassword,signOutCloud,synchronizeCloud} from './cloud-sync-client.js?v=1.0.0';

const qs=(root,selector)=>root.querySelector(selector);
const formatDate=value=>{if(!value)return'Nunca';const date=new Date(value);return Number.isNaN(date.getTime())?'Não disponível':date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})};
const shortDevice=value=>String(value||'').slice(0,8)||'—';

function installStyles(){
 if(document.querySelector('[data-cloud-sync-style]'))return;
 const style=document.createElement('style');style.dataset.cloudSyncStyle='1';style.textContent=`
 .cloud-sync-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:16px}.cloud-sync-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
 .cloud-sync-form{display:grid;gap:10px;margin-top:16px}.cloud-sync-form label{display:grid;gap:6px;font-weight:700}.cloud-sync-form input{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit}
 .cloud-sync-status{margin-top:14px;padding:13px;border:1px solid var(--line);border-radius:13px;background:var(--surface)}.cloud-sync-status[data-state="success"]{border-color:var(--green)}.cloud-sync-status[data-state="error"]{border-color:var(--red)}
 .cloud-sync-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.cloud-sync-facts div{padding:11px;border:1px solid var(--line);border-radius:12px}.cloud-sync-facts small{display:block;color:var(--muted);margin-bottom:4px}.cloud-sync-facts strong{overflow-wrap:anywhere}
 .cloud-sync-note{color:var(--muted);font-size:.94rem}.cloud-sync-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;font-size:.85rem;font-weight:700}
 @media(max-width:760px){.cloud-sync-grid{grid-template-columns:1fr}.cloud-sync-actions{display:grid}.cloud-sync-actions .btn{width:100%}.cloud-sync-facts{grid-template-columns:1fr}}
 `;document.head.appendChild(style);
}

function sectionMarkup(){
 return `<section class="section" data-cloud-sync-section><div class="section-head"><div><span class="kicker">Opcional · autenticado · sem writeback</span><h2>Sincronização privada entre dispositivos</h2><p>Une o histórico local deste navegador ao seu histórico TDAS na nuvem. O Notion continua sendo apenas a fonte oficial de estudo e não recebe alterações desta função.</p></div><span class="cloud-sync-badge" data-cloud-badge>Verificando sessão…</span></div><div class="cloud-sync-grid"><article class="card panel" data-cloud-auth></article><article class="card panel"><h3>O que sincroniza</h3><p>Tentativas concluídas, erros, marcações, revisões, fila de IA e progresso diário. A mesclagem é por evento: um aparelho não apaga silenciosamente o histórico criado em outro.</p><div class="cloud-sync-facts"><div><small>Dispositivo</small><strong data-device>—</strong></div><div><small>Última sincronização</small><strong data-last-sync>Nunca</strong></div><div><small>Tentativas locais</small><strong data-local-attempts>0</strong></div><div><small>Revisões locais</small><strong data-local-reviews>0</strong></div></div><p class="cloud-sync-note">Continua funcionando offline sem login. A nuvem é uma camada de persistência pessoal; não altera PE concluído, gabarito, edital ou qualquer banco do Notion.</p></article></div><div class="cloud-sync-status" data-cloud-status aria-live="polite">Nenhuma operação de nuvem realizada.</div></section>`;
}

function signedOutMarkup(){
 return `<h3>Conectar sua conta</h3><p>Use a conta já cadastrada no armazenamento privado. A senha é enviada diretamente ao Supabase Auth e não é gravada pela plataforma.</p><form class="cloud-sync-form" data-cloud-login><label>E-mail<input type="email" name="email" autocomplete="email" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" required></label><div class="cloud-sync-actions"><button class="btn primary" type="submit">Entrar</button><button class="btn" type="button" data-magic-link>Receber link de acesso</button></div></form><p class="cloud-sync-note">O link de acesso usa a mesma conta e não cria usuário novo.</p>`;
}

function signedInMarkup(session){
 const email=escapeHTML(session?.user?.email||'Conta autenticada');
 return `<h3>Conta conectada</h3><p><strong>${email}</strong></p><p>Sincronização manual nesta primeira versão: você decide quando enviar e mesclar o histórico.</p><div class="cloud-sync-actions"><button class="btn primary" type="button" data-sync-now>Sincronizar agora</button><button class="btn" type="button" data-cloud-logout>Sair</button></div><p class="cloud-sync-note">Ao sincronizar, registros novos de ambos os lados são preservados. Exclusões locais não apagam o histórico da nuvem.</p>`;
}

async function mount(){
 if(document.querySelector('[data-cloud-sync-section]'))return true;
 const main=document.querySelector('main'),footer=main?.querySelector('footer.footer');if(!main||!footer)return false;
 installStyles();footer.insertAdjacentHTML('beforebegin',sectionMarkup());const section=qs(main,'[data-cloud-sync-section]'),auth=qs(section,'[data-cloud-auth]'),status=qs(section,'[data-cloud-status]'),badge=qs(section,'[data-cloud-badge]');
 const setStatus=(message,state='neutral')=>{status.textContent=message;status.dataset.state=state};
 const refreshFacts=()=>{try{const backup=createLocalBackup();qs(section,'[data-local-attempts]').textContent=String(backup.summary.attempts);qs(section,'[data-local-reviews]').textContent=String(backup.summary.reviews)}catch{}const meta=readCloudMeta();qs(section,'[data-device]').textContent=shortDevice(meta?.deviceId||getOrCreateDeviceId());qs(section,'[data-last-sync]').textContent=formatDate(meta?.lastSyncAt)};
 const renderAuth=async()=>{
  try{const session=await getCloudSession();badge.textContent=session?'Nuvem conectada':'Nuvem desconectada';auth.innerHTML=session?signedInMarkup(session):signedOutMarkup();bind(session)}catch(error){badge.textContent='Nuvem indisponível';auth.innerHTML=`<h3>Sincronização indisponível</h3><p>${escapeHTML(error.message||'Não foi possível carregar o serviço agora.')}</p><p class="cloud-sync-note">Seus dados locais continuam intactos e o backup manual permanece disponível.</p>`}
 };
 const bind=session=>{
  const form=qs(auth,'[data-cloud-login]');if(form)form.addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;setStatus('Autenticando…');try{await signInCloudWithPassword(data.get('email'),data.get('password'));setStatus('Conta conectada. Você já pode sincronizar.', 'success');await renderAuth()}catch(error){setStatus(error.message||'Falha ao entrar.','error')}finally{button.disabled=false}});
  const magic=qs(auth,'[data-magic-link]');if(magic)magic.addEventListener('click',async()=>{const email=form?.elements?.email?.value?.trim();if(!email){setStatus('Informe o e-mail para receber o link.','error');return}magic.disabled=true;try{await sendCloudMagicLink(email);setStatus('Link enviado. Abra o e-mail neste navegador ou dispositivo.','success')}catch(error){setStatus(error.message||'Não foi possível enviar o link.','error')}finally{magic.disabled=false}});
  const sync=qs(auth,'[data-sync-now]');if(sync)sync.addEventListener('click',async()=>{sync.disabled=true;setStatus('Lendo, enviando e mesclando seu histórico…');try{const result=await synchronizeCloud();refreshFacts();setStatus(`Sincronização concluída: ${result.uploadedEvents} evento(s) novo(s) enviado(s), ${result.remoteEvents} evento(s) lido(s) e ${result.mergedRecords} registro(s) consolidados.`, 'success')}catch(error){setStatus(error.message||'Falha ao sincronizar. Seus dados locais foram preservados.','error')}finally{sync.disabled=false}});
  const logout=qs(auth,'[data-cloud-logout]');if(logout)logout.addEventListener('click',async()=>{logout.disabled=true;try{await signOutCloud();setStatus('Conta desconectada. Os dados locais continuam neste dispositivo.','success');await renderAuth()}catch(error){setStatus(error.message||'Falha ao sair.','error')}finally{logout.disabled=false}});
 };
 refreshFacts();await renderAuth();return true;
}

if(!await mount()){
 const observer=new MutationObserver(async()=>{if(await mount())observer.disconnect()});observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000);
}
