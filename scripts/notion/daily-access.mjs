export function isDailyContentPermissionError(error) {
  const message = String(error?.message ?? error ?? '');
  return /Notion API 404/i.test(message) && /(object_not_found|shared with your integration|TDAS Dashboard Sync)/i.test(message);
}

export function pendingDailySemantic({pe = '', materialsRootId = '', questionsRootId = ''} = {}) {
  return {
    status: 'pending_permission',
    pe,
    integration: 'TDAS Dashboard Sync',
    roots: {materials: materialsRootId, questions: questionsRootId}
  };
}
