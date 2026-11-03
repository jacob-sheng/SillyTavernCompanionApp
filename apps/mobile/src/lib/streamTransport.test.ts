import { expect, it, vi } from 'vitest';
import { StClient } from '@st/core';
import { openSseStream } from './streamTransport';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('expo/fetch', () => ({ fetch: mocks.fetch }));
vi.mock('@/i18n', () => ({ default: { t: (key: string) => key } }));

it('sends Basic Auth, CSRF and cookie over HTTPS SSE and forwards the stop signal', async () => {
  const client = new StClient({ baseUrl: 'https://st.example.com', basicAuth: { username: 'u', password: 'p' },
    fetchImpl: async () => ({ status: 200, ok: true, headers: { get: () => 'session=1; Path=/' },
      json: async () => ({ token: 'csrf' }), text: async () => '' }) });
  mocks.fetch.mockResolvedValue({ ok: true, status: 200, body: new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('data: hello\n\ndata: [DONE]\n\n'));
    controller.close();
  } }) });
  const stop = new AbortController();
  const events = [];
  for await (const event of openSseStream({ url: client.url('/api/backends/chat-completions/generate'),
    headers: await client.authHeaders(), body: { stream: true }, signal: stop.signal })) events.push(event);
  expect(events.map((e) => e.data)).toEqual(['hello', '[DONE]']);
  expect(mocks.fetch).toHaveBeenCalledWith('https://st.example.com/api/backends/chat-completions/generate', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Basic dTpw', Cookie: 'session=1', 'X-CSRF-Token': 'csrf' }),
    signal: stop.signal,
  }));
});
