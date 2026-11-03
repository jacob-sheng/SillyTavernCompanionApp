import { beforeEach, expect, it, vi } from 'vitest';
import { useLocale } from './localeStore';
const mocks = vi.hoisted(() => ({ value: null as string | null, changeLanguage: vi.fn() }));
vi.mock('@/lib/storage', () => ({ secrets: {
  get: async () => mocks.value,
  set: async (_: string, value: string) => { mocks.value = value; },
} }));
vi.mock('@/i18n', () => ({ default: { changeLanguage: mocks.changeLanguage }, deviceLanguage: () => 'zh-CN' }));
vi.mock('@/i18n/languages', async () => import('../i18n/languages'));
beforeEach(() => { mocks.value = null; mocks.changeLanguage.mockClear(); useLocale.setState({ pref: 'system' }); });
it('persists simplified Chinese and restores it at launch', async () => {
  useLocale.getState().setLanguage('zh-CN');
  expect(mocks.value).toBe('zh-CN');
  useLocale.setState({ pref: 'system' });
  await useLocale.getState().hydrate();
  expect(useLocale.getState().pref).toBe('zh-CN');
  expect(mocks.changeLanguage).toHaveBeenLastCalledWith('zh-CN');
});
it('keeps manual English/German choices and supports returning to the system language', async () => {
  for (const pref of ['en', 'de'] as const) {
    mocks.value = pref; await useLocale.getState().hydrate();
    expect(mocks.changeLanguage).toHaveBeenLastCalledWith(pref);
  }
  useLocale.getState().setLanguage('system');
  expect(mocks.changeLanguage).toHaveBeenLastCalledWith('zh-CN');
});
