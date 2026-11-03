import { ConnectionError, validateConnection } from '@st/core';
import { fetchLike } from '@/lib/expoFetch';
import { useConnection } from '@/stores/connectionStore';
import { useServers } from '@/stores/serversStore';

/** Do not replace a working connection until the saved credentials and session are validated. */
export async function reconnectSavedServer(id: string, signal: AbortSignal): Promise<void> {
  const server = useServers.getState().servers.find((s) => s.id === id);
  if (!server) throw new ConnectionError('invalidUrl');
  const credentials = server.hasAuth ? await useServers.getState().getCreds(id) : undefined;
  if (signal.aborted) throw new ConnectionError('cancelled');
  if (server.hasAuth && !credentials) throw new ConnectionError('unauthorized');
  const result = await validateConnection({ baseUrl: server.baseUrl, fetchImpl: fetchLike,
    ...(credentials ? { basicAuth: credentials } : {}), signal });
  if (signal.aborted) throw new ConnectionError('cancelled');
  useConnection.getState().activate(result.instance, result.client);
}
