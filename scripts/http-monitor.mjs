const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 20;
const MAX_TIMEOUT_MS = 60000;

export function normalizeTimeoutMs(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(value);
  const fallbackNumber = Number(fallback);
  const candidate = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : Number.isFinite(fallbackNumber) && fallbackNumber > 0
      ? fallbackNumber
      : DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(candidate)));
}

export async function fetchWithTimeout(url, options = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Implementação de fetch indisponível para o monitor HTTP.');
  const timeout = normalizeTimeoutMs(timeoutMs);
  const controller = new AbortController();
  let timedOut = false;
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`Timeout HTTP após ${timeout} ms em ${url}.`));
  }, timeout);

  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error(`Timeout HTTP após ${timeout} ms em ${url}.`, { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}
