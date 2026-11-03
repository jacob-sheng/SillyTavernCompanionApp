import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandQueue, TavernAdapter, type TavernContext, type TavernModule } from './adapter';
describe('Tavern navigation', () => {
  let ctx: TavernContext;
  let module: TavernModule;
  let adapter: TavernAdapter;
  beforeEach(() => {
    ctx = { characters: [{ avatar: 'a.png', name: 'same' }, { avatar: '角色.png', name: 'same' }], chat: [], eventTypes: {}, eventSource: { on: vi.fn(), removeListener: vi.fn() }, characterId: 0, getCurrentChatId: () => 'existing', getRequestHeaders: () => ({ 'X-CSRF-Token': 'session' }), selectCharacterById: vi.fn(async id => { ctx.characterId = id; }), openCharacterChat: vi.fn(), openGroupChat: vi.fn(), saveChat: vi.fn(), stopGeneration: vi.fn(), extensionSettings: {} };
    module = { doNewChat: vi.fn(), isGenerating: () => false, isChatSaving: false };
    adapter = new TavernAdapter(() => ctx, module);
    document.body.innerHTML = '';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ file_name: '故事 #1.jsonl' }] })));
  });
  it('selects by avatar and delegates new-chat creation to Tavern exactly once', async () => {
    const queue = new CommandQueue();
    const action = () => adapter.navigate({ kind: 'character', avatar: '角色.png', action: 'new' });
    await Promise.all([queue.run('same', action), queue.run('same', action)]);
    expect(ctx.selectCharacterById).toHaveBeenCalledWith(1, { switchMenu: false });
    expect(module.doNewChat).toHaveBeenCalledTimes(1);
  });
  it('never creates a missing historical chat as a side effect of opening it', async () => {
    await expect(adapter.navigate({ kind: 'character', avatar: 'a.png', action: 'continue', file: 'deleted' })).rejects.toThrow('missing');
    expect(ctx.selectCharacterById).not.toHaveBeenCalled();
    expect(ctx.openCharacterChat).not.toHaveBeenCalled();
  });
  it('does not initialize an unused card twice when selection already creates its first chat', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);
    await adapter.navigate({ kind: 'character', avatar: '角色.png', action: 'new' });
    expect(ctx.selectCharacterById).toHaveBeenCalledOnce();
    expect(module.doNewChat).not.toHaveBeenCalled();
  });
  it('preserves special characters and passes the browser CSRF session', async () => {
    ctx.openCharacterChat = vi.fn(async file => { ctx.getCurrentChatId = () => file; });
    await adapter.navigate({ kind: 'character', avatar: '角色.png', action: 'continue', file: '故事 #1.jsonl' });
    expect(ctx.openCharacterChat).toHaveBeenCalledWith('故事 #1');
    expect(fetch).toHaveBeenCalledWith('/api/characters/chats', expect.objectContaining({ headers: { 'X-CSRF-Token': 'session' } }));
  });
  it('does not redirect to another character if Tavern refuses a switch', async () => {
    ctx.selectCharacterById = vi.fn();
    await expect(adapter.navigate({ kind: 'character', avatar: '角色.png', action: 'new' })).rejects.toThrow('busy');
    expect(module.doNewChat).not.toHaveBeenCalled();
  });
  it('requires stopping generation and finishing editors before returning home', async () => {
    module.isGenerating = () => true;
    await expect(adapter.leave(false)).rejects.toThrow('busy');
    module.isGenerating = () => false;
    document.body.innerHTML = '<div class="mes"><textarea class="mes_edit_textarea"></textarea></div>';
    await expect(adapter.leave(false)).rejects.toThrow('unsaved');
    expect(ctx.saveChat).not.toHaveBeenCalled();
  });
  it('never replays a failed potentially mutating command', async () => {
    const queue = new CommandQueue();
    const mutate = vi.fn(async () => { throw new Error('disconnected'); });
    await expect(queue.run('1', mutate)).rejects.toThrow();
    await expect(queue.run('1', mutate)).rejects.toThrow();
    expect(mutate).toHaveBeenCalledTimes(1);
  });
  it('refreshes the retained character list before resolving an avatar', async () => {
    module.getCharacters = vi.fn(async () => { ctx.characters = [{ avatar: 'new.png', name: 'same' }]; });
    await expect(adapter.navigate({ kind: 'character', avatar: 'a.png', action: 'new' })).rejects.toThrow('missing');
    expect(ctx.selectCharacterById).not.toHaveBeenCalled();
    expect(module.doNewChat).not.toHaveBeenCalled();
  });
  it('does not acknowledge a historical chat that upstream failed to load', async () => {
    await expect(adapter.navigate({ kind: 'character', avatar: 'a.png', action: 'continue', file: '故事 #1' })).rejects.toThrow('missing');
  });
  it('verifies persisted plugin state even when upstream silently swallows a save failure', async () => {
    ctx.chat = [{ mes: 'new', variables: { health: 13 } }];
    ctx.chatMetadata = { variables: { score: 4 } };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [{ chat_metadata: ctx.chatMetadata }, { mes: 'old' }] } as Response);
    await expect(adapter.leave(false)).rejects.toThrow('network');
    expect(ctx.saveChat).toHaveBeenCalledOnce();
  });
  it('verifies group metadata as well as messages and tolerates reordered JSON keys', async () => {
    ctx.groupId = 'group';
    ctx.chat = [{ mes: 'saved', variables: { health: 13 }, gen_finished: new Date('2026-11-03T00:00:00Z') }];
    ctx.chatMetadata = { variables: { score: 4 }, integrity: 'same' };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [{ chat_metadata: { integrity: 'same', variables: { score: 4 } } }, { variables: { health: 13 }, mes: 'saved', gen_finished: '2026-11-03T00:00:00.000Z' }] } as Response);
    await expect(adapter.leave(false)).resolves.toBeUndefined();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [{ chat_metadata: { variables: { score: 3 } } }, ...ctx.chat] } as Response);
    await expect(adapter.leave(false)).rejects.toThrow('network');
  });
});
