import { norm } from './config.mjs';

export const isRest = item => /descanso|pausa/.test(norm(`${item?.title} ${item?.status} ${item?.type} ${item?.typ} ${item?.block}`));

export const isCompletedStatus = status => !/nao concluid|incomplet/.test(norm(status)) && /concluid|finalizad|feito|realizad/.test(norm(status));

export function fulfilledCount(items, snapshotDate) {
  return items.filter(item => isCompletedStatus(item?.status) || Boolean(item?.date && item.date <= snapshotDate && isRest(item))).length;
}
