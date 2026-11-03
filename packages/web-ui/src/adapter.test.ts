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
  it('preserves special characters and passes the browser CSRF session', async () => {
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
});
