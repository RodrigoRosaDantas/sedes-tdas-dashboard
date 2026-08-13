// Compatibilidade temporária de PWA. O TDAS permanece local-only nesta versão.
export function exportCloudState(){return null}
export function importCloudState(){throw new Error('Sincronização remota desativada.')}
