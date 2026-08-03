export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export function dateInTimeZone(value = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Data inválida para a política de virada diária.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function requiresCalendarRefresh(state, currentDate) {
  return !state || typeof state !== 'object' || state.snapshotDate !== currentDate;
}

export function prepareCalendarState(state, currentDate) {
  const source = state && typeof state === 'object' ? state : {};
  if (!requiresCalendarRefresh(source, currentDate)) return { changed: false, state: source };
  const previousHash = typeof source.semanticHash === 'string' && source.semanticHash ? source.semanticHash : 'missing';
  return {
    changed: true,
    state: {
      ...source,
      semanticHash: `calendar-refresh:${currentDate}:${previousHash}`,
    },
  };
}
