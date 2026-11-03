import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import type { NavigationTarget } from '../../../../packages/web-ui/src/protocol';

let sequence = 0;
interface TavernState {
  visible: boolean;
  request: { id: string; target: NavigationTarget } | null;
  original: boolean;
  revision: number;
  session: string;
  open: (target: NavigationTarget) => void;
  hide: () => void;
  reload: (original: boolean) => void;
  reset: () => void;
}
export const useTavern = create<TavernState>((set, get) => ({
  visible: false, request: null, original: false, revision: 0, session: randomUUID(),
  open: target => {
    if (get().visible) return;
    set({ visible: true, request: { id: `nav-${Date.now()}-${++sequence}`, target }, ...(target.kind === 'original' ? { original: true, session: randomUUID(), revision: get().revision + 1 } : {}) });
  },
  hide: () => set({ visible: false }),
  // Reload never replays an operation such as new-chat after a potentially partial success.
  reload: original => set({ original, session: randomUUID(), revision: get().revision + 1, request: { id: `reload-${Date.now()}-${++sequence}`, target: { kind: 'original' } } }),
  reset: () => set({ visible: false, request: null, session: randomUUID(), revision: get().revision + 1 }),
}));
