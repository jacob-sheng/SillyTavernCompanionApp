import { StClient, StHttpError, StProtocolError, type BasicAuthCredentials } from './StClient';
import { fingerprintVersion } from '../discovery/fingerprint';
import type { DiscoveredInstance } from '../discovery/types';
import type { FetchLike } from '../net/http';

export type ConnectionErrorCode = 'invalidUrl' | 'unauthorized' | 'forbidden' | 'notSillyTavern' | 'timeout' | 'cancelled' | 'network' | 'server';
export class ConnectionError extends Error {
  constructor(readonly code: ConnectionErrorCode) {
    super(code);
    this.name = 'ConnectionError';
  }
}

/** This release supports an origin, not a reverse-proxy path prefix. */
export function normalizeServerUrl(input: string): string {
  const value = input.trim();
  try {
    if (!value || /[\s\\?#]/.test(value)) throw new Error();
    const candidate = value.includes('://') ? value : `https://${value}`;
    if (!/^https?:\/\/[^/@]+\/?$/i.test(candidate)) throw new Error();
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname ||
        url.username || url.password || url.pathname !== '/' || url.port === '0') throw new Error();
    return url.origin;
  } catch {
    throw new ConnectionError('invalidUrl');
  }
}

export interface ValidatedConnection { instance: DiscoveredInstance; client: StClient }

/** Validate the full authenticated session before publishing it to the UI. */
export async function validateConnection(options: {
  baseUrl: string;
  fetchImpl: FetchLike;
  basicAuth?: BasicAuthCredentials;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ValidatedConnection> {
  const baseUrl = normalizeServerUrl(options.baseUrl);
  const controller = new AbortController();
  let phase: 'validating' | 'ready' | 'failed' = 'validating';
  let rejectBoundary!: (error: ConnectionError) => void;
  const boundary = new Promise<never>((_, reject) => { rejectBoundary = reject; });
  const stop = (code: 'timeout' | 'cancelled') => {
    phase = 'failed';
    rejectBoundary(new ConnectionError(code));
    controller.abort();
  };
  const onAbort = () => stop('cancelled');
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => stop('timeout'), options.timeoutMs ?? 15_000);
  // After validation the same client uses normal request signals, not the expired handshake signal.
  const client = new StClient({
    baseUrl,
    ...(options.basicAuth ? { basicAuth: options.basicAuth } : {}),
    fetchImpl: async (url, init) => {
      if (phase === 'failed') return Promise.reject(new ConnectionError('cancelled'));
      const response = await options.fetchImpl(url, phase === 'validating' ? { ...init, signal: controller.signal } : init);
      // Caddy errors can be HTML/plain text; classify the HTTP status before attempting JSON.
      if (phase === 'validating' && !response.ok) throw new StHttpError(response.status);
      return response;
    },
  });
  const checkStatus = (status: number, ok: boolean) => {
    if (!ok) throw new StHttpError(status);
  };
  const handshake = async (): Promise<ValidatedConnection> => {
    if (options.signal?.aborted) throw new ConnectionError('cancelled');
    const version = await client.get('/version');
    checkStatus(version.status, version.ok);
    const fp = fingerprintVersion(version.data);
    if (!fp.isSillyTavern) throw new ConnectionError('notSillyTavern');
    await client.ensureCsrf();
    const characters = await client.post('/api/characters/all', {});
    checkStatus(characters.status, characters.ok);
    if (!Array.isArray(characters.data)) throw new ConnectionError('notSillyTavern');
    const url = new URL(baseUrl);
    return {
      client,
      instance: { baseUrl, ip: url.hostname, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
        source: 'manual', ...(fp.version ? { version: fp.version } : {}), ...(fp.agent ? { agent: fp.agent } : {}) },
    };
  };
  try {
    const result = await Promise.race([handshake(), boundary]);
    phase = 'ready';
    return result;
  } catch (error) {
    if (error instanceof ConnectionError) throw error;
    if (error instanceof StProtocolError) throw new ConnectionError('notSillyTavern');
    if (error instanceof StHttpError) {
      throw new ConnectionError(error.status === 401 ? 'unauthorized' : error.status === 403 ? 'forbidden' : 'server');
    }
    throw new ConnectionError('network');
  } finally {
    if (phase !== 'ready') { phase = 'failed'; controller.abort(); }
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
