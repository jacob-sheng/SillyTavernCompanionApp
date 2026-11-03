import { beforeEach, expect, it, vi } from 'vitest';
import { reconnectSavedServer } from './serverConnection';
const state = vi.hoisted(() => ({
  activate: vi.fn(), fetch: vi.fn(),
  getCreds: vi.fn(),
  servers: [{ id: 'remote', baseUrl: 'https://st.example.com', hasAuth: true }],
}));
vi.mock('@/lib/expoFetch', () => ({ fetchLike: state.fetch }));
vi.mock('@/stores/connectionStore', () => ({ useConnection: { getState: () => ({ activate: state.activate }) } }));
vi.mock('@/stores/serversStore', () => ({ useServers: { getState: () => state } }));

beforeEach(() => {
  vi.clearAllMocks();
  state.getCreds.mockResolvedValue({ username: 'u', password: 'p' });
  state.fetch.mockImplementation(async (url: string) => ({ ok: true, status: 200,
    headers: { get: () => null }, json: async () => url.endsWith('/version') ? { agent: 'SillyTavern:1.18.0:test' }
      : url.endsWith('/csrf-token') ? { token: 'T' } : [], text: async () => '' }));
});
it('reconnects with saved credentials and activates the validated client', async () => {
  await reconnectSavedServer('remote', new AbortController().signal);
  expect(state.getCreds).toHaveBeenCalledWith('remote');
  expect(state.fetch.mock.calls[0]?.[1]?.headers.Authorization).toBe('Basic dTpw');
  expect(state.activate).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://st.example.com' }),
    expect.objectContaining({ baseUrl: 'https://st.example.com' }));
});
it('leaves the existing connection intact if the saved password is rejected', async () => {
  state.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => { throw new Error('HTML'); } });
  await expect(reconnectSavedServer('remote', new AbortController().signal)).rejects.toMatchObject({ code: 'unauthorized' });
  expect(state.activate).not.toHaveBeenCalled();
});
it('requires missing credentials to be re-entered rather than connecting anonymously', async () => {
  state.getCreds.mockResolvedValue(undefined);
  await expect(reconnectSavedServer('remote', new AbortController().signal)).rejects.toMatchObject({ code: 'unauthorized' });
  expect(state.fetch).not.toHaveBeenCalled();
  expect(state.activate).not.toHaveBeenCalled();
});
it('does not activate after cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(reconnectSavedServer('remote', controller.signal)).rejects.toMatchObject({ code: 'cancelled' });
  expect(state.activate).not.toHaveBeenCalled();
});
