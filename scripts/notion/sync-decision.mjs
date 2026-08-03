export function shouldRebuild({ previousHash = '', nextHash = '', syncKind = '', forceRebuild = false } = {}) {
  return Boolean(forceRebuild || syncKind === 'push' || previousHash !== nextHash);
}
