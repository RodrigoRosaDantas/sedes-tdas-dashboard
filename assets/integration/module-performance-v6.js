import './private-history-runtime-v3.js?v=3.0.0';
import {syncPrivateHistory} from './private-history-sync-v3.js?v=3.0.0';
import {hydratePrivateHistory} from './private-history-materialize.js?v=1.0.0';
try{if(navigator.onLine)await syncPrivateHistory();await hydratePrivateHistory()}catch(error){console.warn('Histórico remoto indisponível; usando cache local.',error)}
await import('./module-performance-v4.js?v=4.0.0');
await import('./performance-history-links-v2.js?v=2.0.0');
