import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useServers, type SavedServer } from './serversStore';
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@/lib/storage', () => ({ secrets: {
  get: async (key: string) => disk.get(key) ?? null,
  set: async (key: string, value: string) => { disk.set(key, value); },
  remove: async (key: string) => { disk.delete(key); },
} }));

const server: SavedServer = { id: 'https://st.example.com', baseUrl: 'https://st.example.com',
  label: 'Remote', ip: 'st.example.com', port: 443, hasAuth: true };
beforeEach(() => { disk.clear(); useServers.setState({ servers: [] }); });
describe('saved servers', () => {
  it('restores a saved URL and its credentials after a cold start', async () => {
    await useServers.getState().upsert(server, { user: 'user', pass: 'secret' });
    expect(disk.get('servers.list')).not.toContain('secret');
    useServers.setState({ servers: [] });
    await useServers.getState().hydrate();
    expect(useServers.getState().servers).toEqual([server]);
    expect(await useServers.getState().getCreds(server.id)).toEqual({ username: 'user', password: 'secret' });
  });
  it('retains existing LAN records and legacy credential keys', async () => {
    const legacy = { ...server, id: 'http://192.168.1.2:8000', baseUrl: 'http://192.168.1.2:8000', ip: '192.168.1.2', port: 8000 };
    disk.set('servers.list', JSON.stringify([legacy]));
    disk.set('server.http___192.168.1.2_8000.user', 'old');
    disk.set('server.http___192.168.1.2_8000.pass', 'password');
    await useServers.getState().hydrate();
    await useServers.getState().upsert(server, { user: 'remote', pass: '' });
    expect(useServers.getState().servers).toEqual([legacy, server]);
    expect(await useServers.getState().getCreds(legacy.id)).toEqual({ username: 'old', password: 'password' });
    expect(await useServers.getState().getCreds(server.id)).toEqual({ username: 'remote', password: '' });
  });
  it('replaces changed credentials and removes them when auth is disabled or the server is removed', async () => {
    await useServers.getState().upsert(server, { user: 'u', pass: 'old' });
    await useServers.getState().upsert(server, { user: 'u', pass: 'new' });
    expect(await useServers.getState().getCreds(server.id)).toEqual({ username: 'u', password: 'new' });
    expect(useServers.getState().servers).toHaveLength(1);
    await useServers.getState().upsert({ ...server, hasAuth: false });
    expect(await useServers.getState().getCreds(server.id)).toBeUndefined();
    await useServers.getState().upsert(server, { user: 'u', pass: 'new' });
    await useServers.getState().remove(server.id);
    expect(await useServers.getState().getCreds(server.id)).toBeUndefined();
    expect(useServers.getState().servers).toEqual([]);
  });
});
