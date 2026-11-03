import React from 'react';
import { createPortal } from 'react-dom';
import { click } from './adapter';

/** Navigation around third-party settings only; their content stays untouched. */
export function ExtensionsNavigation({ manage, install, unavailable, search }: { manage: string; install: string; unavailable: string; search: string }) {
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const [manager, setManager] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    const panel = document.querySelector('#rm_extensions_block');
    if (!panel) return;
    const mount = document.createElement('nav');
    mount.className = 'stc-workspace-toolbar';
    panel.prepend(mount); setHost(mount);
    let searchMount: HTMLElement | null = null;
    const observeManager = () => {
      const content = document.querySelector<HTMLElement>('dialog[open] .extensions_info');
      if (searchMount?.parentElement === content) return;
      searchMount?.remove(); searchMount = null;
      if (content) {
        searchMount = document.createElement('div');
        searchMount.className = 'stc-extension-search';
        content.prepend(searchMount);
      }
      setManager(searchMount);
    };
    const observer = new MutationObserver(observeManager);
    // Tavern 1.19 appends/removes popup dialogs directly on body. Do not observe
    // message rendering or third-party iframe mutations while chatting.
    observer.observe(document.body, { childList: true });
    observeManager();
    return () => { observer.disconnect(); searchMount?.remove(); mount.remove(); };
  }, []);
  const open = (selector: string) => { try { click(selector); } catch { window.alert(unavailable); } };
  return <>{host && createPortal(<>
    <button type="button" onClick={() => open('#extensions_details')}>{manage}</button>
    <button type="button" onClick={() => open('#third_party_extension_button')}>{install}</button>
  </>, host)}{manager && createPortal(<ExtensionSearch container={manager.parentElement!} label={search} />, manager)}</>;
}

function ExtensionSearch({ container, label }: { container: HTMLElement; label: string }) {
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    const update = () => {
      for (const node of container.querySelectorAll<HTMLElement>('.extension_block')) {
        node.classList.toggle('stc-filtered', !node.textContent?.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase()));
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(container, { childList: true, subtree: true });
    return () => { observer.disconnect(); container.querySelectorAll('.stc-filtered').forEach(node => node.classList.remove('stc-filtered')); };
  }, [container, value]);
  return <input type="search" aria-label={label} placeholder={label} value={value} onChange={event => setValue(event.target.value)} />;
}
