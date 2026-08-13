import assert from 'node:assert/strict';
import { fetchWithTimeout, normalizeTimeoutMs } from './http-monitor.mjs';

assert.equal(normalizeTimeoutMs('8000'), 8000);
assert.equal(normalizeTimeoutMs(''), 8000);
assert.equal(normalizeTimeoutMs('-1', 5000), 5000);
assert.equal(normalizeTimeoutMs('999999'), 60000);

let successSignal = null;
const successResponse = await fetchWithTimeout('https://monitor.test/ok', { cache: 'no-store' }, {
  timeoutMs: 250,
  fetchImpl: async (_url, options) => {
    successSignal = options.signal;
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }
});
assert.equal(successResponse.ok, true);
assert.ok(successSignal instanceof AbortSignal, 'Toda requisição monitorada deve receber AbortSignal.');

const startedAt = Date.now();
await assert.rejects(
  fetchWithTimeout('https://monitor.test/hang', {}, {
    timeoutMs: 40,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    })
  }),
  /Timeout HTTP após 40 ms/
);
const elapsed = Date.now() - startedAt;
assert.ok(elapsed < 1000, `Requisição pendurada deveria abortar rapidamente; levou ${elapsed} ms.`);

console.log(`Timeout HTTP do watchdog validado: conexão pendurada abortada em ${elapsed} ms.`);
