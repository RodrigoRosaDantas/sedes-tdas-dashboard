import fs from 'node:fs/promises';
const read=file=>fs.readFile(file,'utf8');
const required=(condition,message)=>{if(!condition)throw new Error(`Persistência local-only: ${message}`)};
const [store,draft,syncPage,errorBook,performance,pwaGuard,navigation]=await Promise.all([
 read('assets/integration/module-store.js'),read('assets/integration/session-draft.js'),read('sincronizacao/index.html'),read('assets/integration/module-error-book-v3.js'),read('assets/integration/module-performance-v6.js'),read('scripts/preserve-private-history-pwa.mjs'),read('data/integration/navigation.json')
]);
required(store.includes("persistent:false")&&store.includes("cloudSync:false"),'resultado final precisa ser explicitamente efêmero e sem nuvem');
required(!store.includes('D+1')&&!store.includes('D+7')&&!store.includes('D+20'),'module-store não pode gerar fila D+1/D+7/D+20');
required(!store.includes('setItem(STORAGE_KEY'),'module-store não pode persistir tentativa concluída');
required(store.includes("mode!=='study'")&&store.includes('não executa nem persiste revisão interna'),'execução de revisão interna precisa estar bloqueada');
required(draft.includes("target.setItem(STORAGE_KEY")&&draft.includes('clearSessionDraft'),'rascunho da sessão em andamento precisa continuar local e removível');
required(syncPage.includes('Sincronização em nuvem aposentada')&&!/private-history-page|firebase-history-store|private-history-(?:auth|sync|runtime|materialize|login|config)/i.test(syncPage),'rota de sincronização não pode carregar autenticação/nuvem');
required(!/private-history|firebase/i.test(errorBook),'caderno não pode carregar histórico remoto');
required(!/private-history|firebase/i.test(performance),'desempenho não pode carregar histórico remoto');
required(pwaGuard.includes('const retired=')&&pwaGuard.includes('Service worker ainda referencia persistência pessoal em nuvem'),'pipeline precisa impedir reintrodução no PWA');
const nav=JSON.parse(navigation);required(nav.invariants.includes('active-session-draft-local-only')&&nav.invariants.includes('no-personal-cloud-sync')&&nav.invariants.includes('no-completed-attempt-history'),'contrato de navegação precisa declarar local-only');
const retired=['assets/integration/firebase-history-store.js','assets/integration/private-history-auth.js','assets/integration/private-history-config.js','assets/integration/private-history-login.js','assets/integration/private-history-materialize.js','assets/integration/private-history-page.js','assets/integration/private-history-runtime.js','assets/integration/private-history-runtime-v2.js','assets/integration/private-history-runtime-v3.js','assets/integration/private-history-sync.js','assets/integration/private-history-sync-v2.js','assets/integration/private-history-sync-v3.js'];
for(const file of retired){try{await fs.access(file);throw new Error(`Persistência local-only: arquivo aposentado ainda presente: ${file}`)}catch(error){if(error?.code!=='ENOENT')throw error}}
console.log('Persistência TDAS validada: sessão ativa local; tentativa concluída efêmera; sem Firebase, histórico pessoal ou revisão interna.');
