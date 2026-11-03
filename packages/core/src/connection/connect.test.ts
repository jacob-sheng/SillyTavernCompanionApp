import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeServerUrl, validateConnection } from './connect';
import type { FetchLike, FetchResponseLike } from '../net/http';

const response = (data: unknown, status = 200): FetchResponseLike => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (name) => name.toLowerCase() === 'set-cookie' ? 'sid=test; Path=/; Secure; HttpOnly' : null },
  json: async () => { if (data === 'html') throw new SyntaxError('HTML'); return data; },
  text: async () => String(data),
});
const version = { agent: 'SillyTavern:1.18.0:test', pkgVersion: '1.18.0' };
const workingFetch: FetchLike = async (url) => response(url.endsWith('/version') ? version : url.endsWith('/csrf-token') ? { token: 'csrf' } : []);
afterEach(() => vi.useRealTimers());

describe('server URL', () => {
  it.each([
    [' st.example.com ', 'https://st.example.com'],
    ['HTTPS://ST.EXAMPLE.COM:443/', 'https://st.example.com'],
    ['https://st.example.com:8443', 'https://st.example.com:8443'],
    ['http://192.168.1.2:8000/', 'http://192.168.1.2:8000'],
    ['https://[::1]:8443', 'https://[::1]:8443'],
  ])('normalizes %s', (input, output) => expect(normalizeServerUrl(input)).toBe(output));
  it.each(['', 'ftp://host', 'https://user:pass@host', 'https://host/tavern', 'https://host?q=1',
    'https://host#', 'https://host?', 'https://host:99999', 'https://host:0', 'https://bad host', 'https://host\\path'])
  ('rejects %s', (input) => expect(() => normalizeServerUrl(input)).toThrow('invalidUrl'));
});

describe('validated remote connection', () => {
  it('authenticates every handshake request, retains the session, and releases the validation signal', async () => {
    const fetchImpl = vi.fn(workingFetch);
    const controller = new AbortController();
    const { client, instance } = await validateConnection({ baseUrl: 'st.example.com', fetchImpl,
      basicAuth: { username: '用户', password: '密码:🔑' }, signal: controller.signal });
    expect(instance).toMatchObject({ baseUrl: 'https://st.example.com', port: 443, ip: 'st.example.com', version: '1.18.0' });
    const auth = `Basic ${Buffer.from('用户:密码:🔑').toString('base64')}`;
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://st.example.com/version', 'https://st.example.com/csrf-token', 'https://st.example.com/api/characters/all',
    ]);
    for (const [, init] of fetchImpl.mock.calls) expect(init?.headers?.Authorization).toBe(auth);
    expect(fetchImpl.mock.calls[2]?.[1]?.headers).toMatchObject({ Cookie: 'sid=test', 'X-CSRF-Token': 'csrf' });
    controller.abort();
    const generation = new AbortController();
    await client.post('/api/test', {}, { signal: generation.signal });
    expect(fetchImpl.mock.calls.at(-1)?.[1]?.signal).toBe(generation.signal);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(await client.authHeaders()).toMatchObject({ Authorization: auth, Cookie: 'sid=test', 'X-CSRF-Token': 'csrf' });
    await client.postForm('/api/avatars/upload', {});
    expect(fetchImpl.mock.calls.at(-1)?.[1]?.headers).toMatchObject({ Authorization: auth, Cookie: 'sid=test' });
    expect(fetchImpl.mock.calls.at(-1)?.[1]?.headers).not.toHaveProperty('Content-Type');
  });
  it.each(['/version', '/csrf-token', '/api/characters/all'])('reports proxy 401 at %s even with HTML', async (endpoint) => {
    const fetchImpl: FetchLike = (url, init) => url.endsWith(endpoint) ? Promise.resolve(response('html', 401)) : workingFetch(url, init);
    await expect(validateConnection({ baseUrl: 'st.example.com', fetchImpl })).rejects.toMatchObject({ code: 'unauthorized' });
  });
  it.each([[403, 'forbidden'], [502, 'server']] as const)('reports HTTP %s', async (status, code) => {
    await expect(validateConnection({ baseUrl: 'st.example.com', fetchImpl: async () => response('html', status) }))
      .rejects.toMatchObject({ code });
  });
  it.each(['/version', '/csrf-token', '/api/characters/all'])('rejects login/non-ST pages at %s', async (endpoint) => {
    const fetchImpl: FetchLike = (url, init) => url.endsWith(endpoint) ? Promise.resolve(response('html')) : workingFetch(url, init);
    await expect(validateConnection({ baseUrl: 'st.example.com', fetchImpl })).rejects.toMatchObject({ code: 'notSillyTavern' });
  });
  it('reports network/TLS failure without exposing the transport error', async () => {
    await expect(validateConnection({ baseUrl: 'st.example.com', fetchImpl: async () => { throw new TypeError('network'); } }))
      .rejects.toMatchObject({ code: 'network' });
  });
  it('bounds the entire handshake, even if a transport ignores abort', async () => {
    vi.useFakeTimers();
    let resolve!: (response: FetchResponseLike) => void;
    const fetchImpl = vi.fn<FetchLike>(() => new Promise((r) => { resolve = r; }));
    const pending = validateConnection({ baseUrl: 'st.example.com', fetchImpl });
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    resolve(response(version));
    await vi.runAllTimersAsync();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('cancels in-flight validation immediately', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<FetchLike>(() => new Promise(() => {}));
    const pending = validateConnection({ baseUrl: 'st.example.com', fetchImpl, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it('does not request anything with a pre-aborted signal', async () => {
    const controller = new AbortController(); controller.abort();
    const fetchImpl = vi.fn(workingFetch);
    await expect(validateConnection({ baseUrl: 'st.example.com', fetchImpl, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('scopes image credentials to the exact origin and excludes CSRF', async () => {
    const { client } = await validateConnection({ baseUrl: 'st.example.com', fetchImpl: workingFetch, basicAuth: { username: 'u', password: 'p' } });
    for (const uri of ['/thumbnail?a=b', 'https://st.example.com/a', '//st.example.com/a', 'User Avatars/a.png']) {
      const source = client.imageSource(uri);
      expect(source.uri.startsWith('https://st.example.com/')).toBe(true);
      expect(source.headers).toMatchObject({ Cookie: 'sid=test', Authorization: 'Basic dTpw' });
      expect(source.headers).not.toHaveProperty('X-CSRF-Token');
    }
    for (const uri of ['https://elsewhere.test/a', '//evil.test/a', 'https://st.example.com.evil.test/a', 'http://st.example.com/a',
      'https://st.example.com:8443/a', 'https://user@st.example.com/a', 'data:image/png;base64,abc', 'file:///tmp/a', 'content://photo/1']) {
      expect(client.imageSource(uri)).toEqual({ uri });
    }
  });
});
