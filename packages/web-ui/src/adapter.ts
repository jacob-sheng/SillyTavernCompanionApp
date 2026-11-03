import type { NavigationTarget, Panel } from './protocol';

export interface TavernContext {
  characters: { avatar: string; name: string; chat?: string }[];
  characterId?: number | string; groupId?: string; chat: unknown[];
  eventTypes: Record<string, string>;
  eventSource: { on: (event: string, fn: (...args: unknown[]) => void) => void; removeListener: (event: string, fn: (...args: unknown[]) => void) => void };
  selectCharacterById: (id: number, options?: { switchMenu: boolean }) => Promise<void>;
  openCharacterChat: (file: string) => Promise<void>;
  openGroupChat: (id: string, file?: string) => Promise<void>;
  getRequestHeaders: () => Record<string, string>;
  saveChat: () => Promise<void>; stopGeneration: () => void;
  extensionSettings: { disabledExtensions?: string[] };
  getCurrentChatId: () => string | undefined;
}
export interface TavernModule { doNewChat: () => Promise<void>; isGenerating: () => boolean; isChatSaving: boolean; settingsReady?: boolean; doNavbarIconClick?: (this: HTMLElement) => Promise<void>; saveChat?: () => Promise<void> }
export const panelSelectors: Record<Exclude<Panel, 'chats'>, string> = {
  models: '#sys-settings-button', presets: '#ai-config-button', formatting: '#advanced-formatting-button',
  world: '#WI-SP-button', personas: '#persona-management-button', extensions: '#extensions-settings-button',
  characters: '#rightNavHolder', settings: '#user-settings-button', backgrounds: '#backgrounds-button',
};
export function click(selector: string): void {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error('unsupported');
  node.click();
}
export class TavernAdapter {
  constructor(readonly context: () => TavernContext, readonly module: TavernModule) {}
  async idle(timeout = 15000): Promise<void> {
    const start = Date.now();
    while (this.module.isGenerating() || this.module.isChatSaving) {
      if (Date.now() - start > timeout) throw new Error('busy');
      await new Promise(r => setTimeout(r, 100));
    }
  }
  async navigate(target: NavigationTarget): Promise<void> {
    if (target.kind === 'original') return;
    if (this.module.isGenerating()) throw new Error('busy');
    await this.idle();
    if (target.kind === 'panel') { await this.openPanel(target.panel); return; }
    if (target.kind === 'group') {
      const url = new URL('/scripts/group-chats.js', location.origin).href;
      const groups = await import(/* @vite-ignore */ url) as { groups: { id: string; chats: string[]; chat_id: string }[]; openGroupById: (id: string) => Promise<boolean> };
      const group = groups.groups.find(g => String(g.id) === target.groupId);
      const file = target.file?.replace(/\.jsonl$/i, '') ?? group?.chat_id;
      if (!group || !file || !group.chats.includes(file)) throw new Error('missing');
      await groups.openGroupById(group.id);
      if (String(this.context().groupId) !== target.groupId) throw new Error('missing');
      await this.context().openGroupChat(group.id, file);
      if (this.context().getCurrentChatId() !== file) throw new Error('missing');
      await this.closePanels();
      return;
    }
    let ctx = this.context();
    const id = ctx.characters.findIndex(c => c.avatar === target.avatar);
    if (id < 0) throw new Error('missing');
    // Validate BEFORE switching: openCharacterChat creates a file if it does not exist.
    const file = target.file?.replace(/\.jsonl$/i, '');
    if (file) {
      const response = await fetch('/api/characters/chats', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ avatar_url: target.avatar }) });
      if (!response.ok) throw new Error('network');
      const rows = Object.values(await response.json() as Record<string, { file_name?: string }>);
      if (!rows.some(c => c.file_name?.replace(/\.jsonl$/i, '') === file)) throw new Error('missing');
    }
    await ctx.selectCharacterById(id, { switchMenu: target.action === 'edit' });
    ctx = this.context();
    if (ctx.groupId || ctx.characters[Number(ctx.characterId)]?.avatar !== target.avatar) throw new Error('busy');
    if (target.action === 'new') await this.module.doNewChat();
    else if (file && ctx.getCurrentChatId() !== file) await ctx.openCharacterChat(file);
    if (target.action === 'edit') await this.openPanel('characters');
    else if (target.action === 'manage') await this.openPanel('chats');
    else await this.closePanels();
  }
  async openPanel(panel: Panel): Promise<void> {
    if (panel === 'chats') { click('#option_select_chat'); return; }
    const drawer = document.querySelector(panelSelectors[panel]);
    if (!drawer) throw new Error('unsupported');
    await this.closePanels();
    const toggle = drawer.querySelector<HTMLElement>('.drawer-toggle');
    if (!toggle) throw new Error('unsupported');
    if (this.module.doNavbarIconClick) await this.module.doNavbarIconClick.call(toggle);
    else toggle.click();
    window.dispatchEvent(new CustomEvent('stc-panel', { detail: panel }));
  }
  async closePanels(): Promise<void> {
    for (const toggle of document.querySelectorAll<HTMLElement>('#top-settings-holder > .drawer > .drawer-toggle')) {
      if (toggle.parentElement?.querySelector('.drawer-content.openDrawer')) {
        if (this.module.doNavbarIconClick) await this.module.doNavbarIconClick.call(toggle);
        else toggle.click();
      }
    }
  }
  async leave(stop: boolean): Promise<void> {
    if (this.module.isGenerating()) {
      if (!stop) throw new Error('busy');
      this.context().stopGeneration();
    }
    await this.idle();
    // Editing controls stay mounted; leaving must not silently discard unfinished edits.
    if (document.querySelector('.mes .mes_edit_textarea') || document.querySelector('dialog[open]')) throw new Error('unsaved');
    const ctx = this.context();
    if (ctx.groupId) {
      await ctx.saveChat();
      // Upstream catches group save errors. Confirm persisted messages before hiding it.
      const response = await fetch('/api/chats/group/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ id: ctx.getCurrentChatId() }) });
      if (!response.ok) throw new Error('network');
      const saved = await response.json() as unknown[];
      if (!Array.isArray(saved) || JSON.stringify(saved.slice(1)) !== JSON.stringify(ctx.chat)) throw new Error('network');
    }
    else if (ctx.characterId !== undefined) await (this.module.saveChat ? this.module.saveChat() : ctx.saveChat());
    await this.idle();
  }
}

/** A completed request is never replayed, including failed or partially completed mutations. */
export class CommandQueue {
  private results = new Map<string, Promise<void>>();
  private tail: Promise<void> = Promise.resolve();
  run(id: string, action: () => Promise<void>): Promise<void> {
    const previous = this.results.get(id);
    if (previous) return previous;
    const result = this.tail.then(action);
    this.tail = result.catch(() => {});
    this.results.set(id, result);
    return result;
  }
}
