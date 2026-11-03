export const BRIDGE_VERSION = 1;
export const panels = ['models', 'presets', 'formatting', 'world', 'personas', 'extensions', 'characters', 'settings', 'backgrounds', 'chats'] as const;
export type Panel = typeof panels[number];
export type NavigationTarget =
  | { kind: 'character'; avatar: string; action: 'continue' | 'new' | 'edit' | 'manage'; file?: string }
  | { kind: 'group'; groupId: string; file?: string }
  | { kind: 'panel'; panel: Panel }
  | { kind: 'original' };
export type BootConfig = { session: string; origin: string; locale: string; theme: 'light' | 'dark'; original: boolean };
export type NativeCommand = { version: 1; session: string; id: string; type: 'navigate'; target: NavigationTarget }
  | { version: 1; session: string; id: string; type: 'leave' | 'stopAndLeave' | 'back' };
export type WebMessage = { version: 1; session: string; type: 'ready' | 'interactive' | 'dataChanged' | 'openNativeHome' | 'busy' | 'error' | 'navigationResult' | 'exportFile'; id?: string; ok?: boolean; code?: string; name?: string; mime?: string; base64?: string };
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f]/.test(value);
export function validTarget(value: unknown): value is NavigationTarget {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.kind === 'original') return true;
  if (v.kind === 'panel') return panels.includes(v.panel as Panel);
  if (v.kind === 'group') return text(v.groupId) && (v.file === undefined || text(v.file));
  return v.kind === 'character' && text(v.avatar) && ['continue', 'new', 'edit', 'manage'].includes(String(v.action)) && (v.file === undefined || text(v.file));
}
export function parseCommand(input: unknown, session: string): NativeCommand | null {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  if (v.version !== 1 || v.session !== session || !text(v.id)) return null;
  if (v.type === 'leave' || v.type === 'stopAndLeave' || v.type === 'back') return v as NativeCommand;
  return v.type === 'navigate' && validTarget(v.target) ? v as NativeCommand : null;
}
export function parseWebMessage(raw: string, session: string, url: string, origin: string): WebMessage | null {
  try {
    if (new URL(url).origin !== origin || raw.length > 24 * 1024 * 1024) return null;
    const v = JSON.parse(raw) as WebMessage;
    if (v.version !== 1 || v.session !== session || !['ready', 'interactive', 'dataChanged', 'openNativeHome', 'busy', 'error', 'navigationResult', 'exportFile'].includes(v.type)) return null;
    if (v.type === 'navigationResult' && (!text(v.id) || typeof v.ok !== 'boolean')) return null;
    if (v.type === 'exportFile' && (!text(v.name) || !text(v.mime) || typeof v.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(v.base64))) return null;
    return v;
  } catch { return null; }
}
export function plainPreview(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
