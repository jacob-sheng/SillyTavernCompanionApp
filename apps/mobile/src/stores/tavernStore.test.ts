import { beforeEach, expect, it, vi } from 'vitest';
import { useTavern } from './tavernStore';
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn(() => `${Math.random()}`) }));
beforeEach(() => useTavern.getState().reset());
it('ignores repeated taps while an entry is open', () => {
  const target = { kind: 'character', avatar: '角色.png', action: 'new' } as const;
  useTavern.getState().open(target);
  const first = useTavern.getState().request;
  useTavern.getState().open(target);
  expect(useTavern.getState().request).toBe(first);
});
it('reloads with a non-mutating target and a fresh session', () => {
  useTavern.getState().open({ kind: 'character', avatar: 'a.png', action: 'new' });
  const old = useTavern.getState().session;
  useTavern.getState().reload(true);
  expect(useTavern.getState().request?.target).toEqual({ kind: 'original' });
  expect(useTavern.getState().session).not.toBe(old);
});
it('preserves the live request when hidden and creates a new request on explicit entry', () => {
  useTavern.getState().open({ kind: 'panel', panel: 'world' });
  const first = useTavern.getState().request;
  useTavern.getState().hide();
  expect(useTavern.getState().request).toBe(first);
  useTavern.getState().open({ kind: 'panel', panel: 'extensions' });
  expect(useTavern.getState().request?.id).not.toBe(first?.id);
});
