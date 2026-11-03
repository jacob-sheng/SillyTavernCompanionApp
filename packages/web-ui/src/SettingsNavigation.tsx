import React from 'react';
import { createPortal } from 'react-dom';

/** Keep upstream fields mounted and bound; navigation only scrolls and focuses. */
export function SettingsNavigation({ label }: { label: string }) {
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const [sections, setSections] = React.useState<HTMLElement[]>([]);
  React.useEffect(() => {
    const panel = document.querySelector<HTMLElement>('#user-settings-block');
    if (!panel) return;
    const mount = document.createElement('nav');
    mount.className = 'stc-section-navigation';
    panel.prepend(mount);
    setHost(mount);
    setSections(Array.from(panel.querySelectorAll<HTMLElement>('#user-settings-block-content h4'))
      .filter(node => node.textContent?.trim() && !node.closest('.inline-drawer-content')));
    return () => { mount.remove(); };
  }, []);
  if (!host) return null;
  return createPortal(<label>{label}<select value="" onChange={event => {
    const section = sections[Number(event.target.value)];
    if (!section) return;
    // Clear old search highlighting through the upstream handler.
    const search = document.querySelector<HTMLTextAreaElement>('#settingsSearch');
    if (search?.value) { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); }
    section.scrollIntoView({ block: 'start' });
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
  }}><option value="" disabled>{label}</option>{sections.map((section, index) =>
    <option key={index} value={index}>{section.textContent?.trim()}</option>)}</select></label>, host);
}
