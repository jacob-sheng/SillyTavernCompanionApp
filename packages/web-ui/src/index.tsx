import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SettingsNavigation } from './SettingsNavigation';
import { ExtensionsNavigation } from './ExtensionsNavigation';
import css from './style.css';
import { themeCss } from './theme';
import { TavernAdapter, CommandQueue, click, type TavernContext, type TavernModule } from './adapter';
import { parseCommand, type BootConfig, type Panel, type WebMessage } from './protocol';
import en from '../../../apps/mobile/src/i18n/locales/en.json';
import de from '../../../apps/mobile/src/i18n/locales/de.json';
import zh from '../../../apps/mobile/src/i18n/locales/zh-CN.json';

declare global {
  interface Window {
    __STC_CONFIG__?: BootConfig;
    __STC_RECEIVE__?: (command: unknown) => void;
    __STC_STARTED__?: boolean;
    ReactNativeWebView?: { postMessage: (data: string) => void };
    SillyTavern?: { getContext: () => TavernContext };
  }
}
const config = window.__STC_CONFIG__;
if (config && !window.__STC_STARTED__ && window === window.top && location.origin === config.origin) {
  window.__STC_STARTED__ = true;
  void boot(config);
}
async function boot(config: BootConfig) {
  const strings = (config.locale.startsWith('zh') ? zh : config.locale.startsWith('de') ? de : en).tavern;
  const send = (message: Omit<WebMessage, 'version' | 'session'>) => window.ReactNativeWebView?.postMessage(JSON.stringify({ ...message, version: 1, session: config.session }));
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const queue = new CommandQueue();
  try {
    const started = Date.now();
    while (!window.SillyTavern?.getContext || !document.querySelector('#send_form') || document.querySelector('#preloader')?.getClientRects().length) {
      if (Date.now() - started > 30000) throw new Error('timeout');
      await wait(100);
    }
    const response = await fetch('/version');
    if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : 'network');
    const version = await response.json() as { pkgVersion?: string };
    if (!config.original && version.pkgVersion !== '1.19.0') throw new Error('unsupported');
    const locale = config.locale.startsWith('zh') ? 'zh-cn' : config.locale.startsWith('de') ? 'de-de' : 'en';
    if (!config.original && localStorage.getItem('language') !== locale) {
      localStorage.setItem('language', locale);
      location.reload();
      return;
    }
    const moduleUrl = new URL('/script.js', location.origin).href;
    const module = await import(/* @vite-ignore */ moduleUrl) as TavernModule;
    if (typeof module.doNewChat !== 'function' || typeof module.isGenerating !== 'function') throw new Error('unsupported');
    let initializationStart = Date.now();
    while (!module.settingsReady) {
      if (document.querySelector('dialog[open]')) { send({ type: 'interactive' }); initializationStart = Date.now(); }
      if (Date.now() - initializationStart > 30000) throw new Error('timeout');
      await wait(100);
    }
    const context = () => window.SillyTavern!.getContext();
    const adapter = new TavernAdapter(context, module);
    const ctx = context();
    if (typeof ctx.selectCharacterById !== 'function' || !ctx.eventSource || !ctx.eventTypes) throw new Error('unsupported');
    const manifests = await fetch('/api/extensions/discover').then(r => r.ok ? r.json() : []).catch(() => []) as { name?: string }[];
    const disabled = ctx.extensionSettings.disabledExtensions ?? [];
    if (!config.original && manifests.some(m => /moonlit|guinevere|astraprojecta|astra-projecta|nastytavern|mobilyze|optimizedmobilelayout/i.test(m.name ?? '') && !disabled.includes(m.name ?? ''))) throw new Error('conflict');
    let dirty = false;
    document.addEventListener('input', event => {
      const el = event.target as HTMLElement;
      if (el.closest('#top-settings-holder, dialog, .mes_edit_textarea')) dirty = true;
    });
    const changed = () => send({ type: 'dataChanged' });
    for (const name of ['CHAT_CHANGED', 'CHAT_CREATED', 'CHAT_DELETED', 'CHAT_RENAMED', 'CHARACTER_EDITED', 'CHARACTER_DELETED', 'CHARACTER_DUPLICATED', 'MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'GENERATION_ENDED', 'SETTINGS_UPDATED']) {
      const event = ctx.eventTypes[name];
      if (event) ctx.eventSource.on(event, changed);
    }
    window.__STC_RECEIVE__ = input => {
      const command = parseCommand(input, config.session);
      if (!command) return;
      void queue.run(command.id, async () => {
        if (command.type === 'navigate') await adapter.navigate(command.target);
        else {
          if (command.type === 'back' && document.querySelector('#top-settings-holder .openDrawer')) {
            await adapter.closePanels();
            return;
          }
          if (dirty && !window.confirm(strings.unsavedConfirm)) throw new Error('unsaved');
          await adapter.leave(command.type === 'stopAndLeave');
          dirty = false;
          changed();
          send({ type: 'openNativeHome', id: command.id });
        }
      }).then(() => send({ type: 'navigationResult', id: command.id, ok: true }), error => {
        const code = error instanceof Error ? error.message : 'network';
        send({ type: code === 'busy' ? 'busy' : 'navigationResult', id: command.id, ok: false, code: ['busy', 'unsaved', 'missing', 'unsupported'].includes(code) ? code : 'network' });
      });
    };
    // Intercept explicit exports, including detached download anchors used by ST utilities.
    const originalClick = HTMLAnchorElement.prototype.click;
    async function exportAnchor(anchor: HTMLAnchorElement) {
      const url = new URL(anchor.href, location.href);
      if (url.protocol !== 'blob:' && url.origin !== location.origin) throw new Error('unsupported');
      const result = await fetch(url.href, { credentials: 'same-origin' });
      if (!result.ok) throw new Error('network');
      const blob = await result.blob();
      if (blob.size > 16 * 1024 * 1024) throw new Error('fileTooLarge');
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
      send({ type: 'exportFile', name: anchor.download || 'export', mime: blob.type || 'application/octet-stream', base64: data });
    }
    HTMLAnchorElement.prototype.click = function () {
      if (this.hasAttribute('download')) void exportAnchor(this).catch(() => send({ type: 'error', code: 'exportFailed' }));
      else originalClick.call(this);
    };
    document.addEventListener('click', event => {
      const anchor = (event.target as Element).closest?.('a[download]') as HTMLAnchorElement | null;
      if (anchor) { event.preventDefault(); void exportAnchor(anchor).catch(() => send({ type: 'error', code: 'exportFailed' })); }
    });
    if (!config.original) {
      document.documentElement.classList.add('stc-modern');
      document.documentElement.dataset.stcTheme = config.theme;
      const style = document.createElement('style'); style.id = 'stc-style'; style.textContent = themeCss + css; document.head.append(style);
      const host = document.createElement('div'); host.id = 'stc-root'; document.body.append(host);
      const updateViewport = () => document.documentElement.style.setProperty('--stc-height', `${window.visualViewport?.height ?? innerHeight}px`);
      window.visualViewport?.addEventListener('resize', updateViewport); updateViewport();
      function Shell() {
        const [menu, setMenu] = useState(false);
        const [page, setPage] = useState<Panel | null>(null);
        const [error, setError] = useState('');
        const [name, setName] = useState(context().characters[Number(context().characterId)]?.name ?? strings.title);
        React.useEffect(() => {
          const event = context().eventTypes.CHAT_CHANGED;
          const update = () => setName(context().characters[Number(context().characterId)]?.name ?? strings.title);
          if (event) context().eventSource.on(event, update);
          return () => { if (event) context().eventSource.removeListener(event, update); };
        }, []);
        React.useEffect(() => {
          const selected = (event: Event) => setPage((event as CustomEvent<Panel>).detail);
          window.addEventListener('stc-panel', selected);
          return () => window.removeEventListener('stc-panel', selected);
        }, []);
        const open = (panel: Panel) => { void adapter.openPanel(panel).then(() => { setPage(panel); setMenu(false); }, () => setError(strings.unsupported)); };
        const home = () => window.__STC_RECEIVE__?.({ version: 1, session: config.session, id: `home-${Date.now()}`, type: 'leave' });
        const items: Panel[] = ['models', 'presets', 'formatting', 'characters', 'chats', 'world', 'personas', 'extensions', 'settings', 'backgrounds'];
        return <><header className="stc-header" onClick={event => event.stopPropagation()}><button className="stc-icon" aria-label={page ? strings.closePanel : strings.home} onClick={() => { if (page) { void adapter.closePanels().then(() => setPage(null)); } else home(); }}><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg></button><div className="stc-heading"><strong>{page ? strings[page] : name}</strong><small>{strings.subtitle}</small></div><button className="stc-icon" aria-label={strings.menu} onClick={() => setMenu(!menu)}><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button></header>{menu && <div className="stc-scrim" onClick={() => setMenu(false)}><nav className="stc-menu" onClick={e => e.stopPropagation()}><button onClick={home}>{strings.home}</button><p>{strings.workspace}</p>{items.map(item => <button key={item} onClick={() => open(item)}>{strings[item]}</button>)}<p>{strings.actions}</p>{(['regenerate', 'continue'] as const).map(action => <button key={action} onClick={() => { try { click(`#option_${action}`); setMenu(false); } catch { setError(strings.unsupported); } }}>{strings[action]}</button>)}</nav></div>}{error && <div className="stc-error">{error}<button onClick={() => setError('')}>{strings.closePanel}</button></div>}</>;
      }
      // Install navigation listeners before ready permits the native host to send commands.
      flushSync(() => createRoot(host).render(<><Shell /><SettingsNavigation label={strings.sectionNavigation} /><ExtensionsNavigation manage={strings.manageExtensions} install={strings.installExtension} unavailable={strings.unsupported} search={strings.searchExtensions} /></>));
    }
    send({ type: 'ready' });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'network';
    send({ type: 'error', code: ['conflict', 'unsupported', 'timeout', 'unauthorized'].includes(code) ? code : 'network' });
  }
}
