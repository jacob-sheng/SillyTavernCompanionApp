export const SUPPORTED_LANGUAGES = ['de', 'en', 'zh-CN'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export function languageForDevice(code?: string | null): AppLanguage {
  const language = code?.toLowerCase().split(/[-_]/)[0];
  return language === 'zh' ? 'zh-CN' : language === 'de' ? 'de' : 'en';
}
export function isAppLanguage(value: unknown): value is AppLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}
