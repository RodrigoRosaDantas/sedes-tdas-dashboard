// Compatibilidade temporária de PWA. Persistência remota desativada para o TDAS.
export function getCloudSession(){return Promise.resolve(null)}
export function getOrCreateDeviceId(){return 'local-only'}
export function readCloudMeta(){return null}
export function sendCloudMagicLink(){return Promise.reject(new Error('Sincronização remota desativada.'))}
export function signInCloudWithPassword(){return Promise.reject(new Error('Sincronização remota desativada.'))}
export function signOutCloud(){return Promise.resolve()}
export function synchronizeCloud(){return Promise.reject(new Error('Sincronização remota desativada.'))}
