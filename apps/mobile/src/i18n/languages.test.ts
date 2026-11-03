import { describe, expect, it } from 'vitest';
import { isAppLanguage, languageForDevice } from './languages';
import en from './locales/en.json';
import de from './locales/de.json';
import zh from './locales/zh-CN.json';

function flatten(value: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === 'string' ? [[path, item]] : Object.entries(flatten(item, path));
  }));
}
describe('languages', () => {
  it.each(['zh', 'zh-CN', 'zh-Hans', 'zh-TW', 'zh_HK'])('uses simplified Chinese for %s', (code) => {
    expect(languageForDevice(code)).toBe('zh-CN');
  });
  it('preserves English/German and defaults unsupported languages to English', () => {
    expect(languageForDevice('de-DE')).toBe('de');
    expect(languageForDevice('en-US')).toBe('en');
    expect(languageForDevice('fr')).toBe('en');
    expect(languageForDevice(null)).toBe('en');
    expect(isAppLanguage('zh-CN')).toBe(true);
    expect(isAppLanguage('bogus')).toBe(false);
  });
  it.each([['German', de], ['Chinese', zh]])('%s has all keys and unchanged interpolation parameters', (_, resource) => {
    const source = flatten(en);
    const target = flatten(resource as object);
    expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort());
    for (const [key, text] of Object.entries(source)) {
      expect(target[key]?.trim(), key).toBeTruthy();
      expect(target[key]?.match(/\{\{.*?\}\}/g)?.sort() ?? [], key).toEqual(text.match(/\{\{.*?\}\}/g)?.sort() ?? []);
    }
  });
});
