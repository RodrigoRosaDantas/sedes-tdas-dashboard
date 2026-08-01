import {STORAGE_KEYS} from './contracts.js?v=1.0.0';
import {saveAttempt} from './attempt-store.js?v=1.0.0';
import {syncAttemptIndexes} from './classification-store.js?v=1.0.0';
import {recordAttemptPeProgress} from './pe-progress-store.js?v=1.0.0';
import {completeReview, scheduleAttemptReviews} from './review-store.js?v=1.0.0';

const TRANSACTION_KEYS = Object.freeze([
  STORAGE_KEYS.attempts,
  STORAGE_KEYS.errors,
  STORAGE_KEYS.marked,
  STORAGE_KEYS.reviews,
  STORAGE_KEYS.peProgress,
]);

function resolveStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target || typeof target.getItem !== 'function' || typeof target.setItem !== 'function' || typeof target.removeItem !== 'function') {
    throw new TypeError('Armazenamento transacional indisponível.');
  }
  return target;
}

function snapshotStorage(storage) {
  return new Map(TRANSACTION_KEYS.map(key => [key, storage.getItem(key)]));
}

function restoreStorage(storage, snapshot) {
  const failures = [];
  for (const [key, value] of snapshot) {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (error) {
      failures.push({key, error});
    }
  }
  if (failures.length) {
    const error = new Error(`Rollback incompleto em ${failures.length} chave(s).`);
    error.failures = failures;
    throw error;
  }
}

export function commitCompletedAttempt(attempt, {storage, includeD0 = false} = {}) {
  if (!attempt || !['pilot','review'].includes(attempt.mode)) throw new TypeError('Tentativa concluída inválida para transação.');
  const target = resolveStorage(storage);
  const snapshot = snapshotStorage(target);
  try {
    const savedAttempt = saveAttempt(attempt, target);
    const indexes = syncAttemptIndexes(attempt, target);
    const reviews = attempt.mode === 'review'
      ? completeReview(attempt.sourceReviewId, {
          reviewAttemptId: attempt.id,
          outcome: attempt.questionResults[0]?.classification,
          completedAt: attempt.finishedAt,
        }, target)
      : scheduleAttemptReviews(attempt, target, {includeD0});
    const peProgress = recordAttemptPeProgress(attempt, target);
    return Object.freeze({savedAttempt, indexes, reviews, peProgress, committed: true});
  } catch (error) {
    try {
      restoreStorage(target, snapshot);
    } catch (rollbackError) {
      const aggregate = new AggregateError([error, rollbackError], 'Falha na conclusão e no rollback local.');
      aggregate.cause = error;
      throw aggregate;
    }
    const transactionError = new Error(`Conclusão local revertida: ${error.message}`, {cause: error});
    transactionError.rolledBack = true;
    throw transactionError;
  }
}

export function transactionKeys() {
  return Object.freeze([...TRANSACTION_KEYS]);
}
