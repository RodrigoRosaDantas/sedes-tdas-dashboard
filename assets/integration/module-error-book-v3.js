import './private-history-runtime-v3.js?v=3.0.0';
import {syncPrivateHistory} from './private-history-sync-v3.js?v=3.0.0';
import {hydratePrivateHistory} from './private-history-materialize.js?v=1.0.0';
try{if(navigator.onLine)await syncPrivateHistory();await hydratePrivateHistory()}catch(error){console.warn('Caderno remoto indisponível; usando cache local.',error)}
await import('./module-error-book-base.js?v=2.0.0');
await import('./error-book-enhancer-v2.js?v=2.0.0');
