import { useColorScheme } from 'react-native';
import { usePrefs } from '@/stores/prefsStore';
import { palette } from './palette';
export const lightPalette: typeof palette = {
  ...palette, bg: '#FAFAFC', surface: '#FFFFFF', surface2: '#F0F0F5', surface3: '#E8E8F0',
  border: '#DEDEE7', borderStrong: '#C6C6D2', text: '#20202A', textMuted: '#636374', textSubtle: '#717184',
  accent: '#6450C7', accentPressed: '#5340B1', userBubble: '#EDEAFB', charBubble: '#F3F1F8',
};
export function useThemeColors() {
  const appearance = usePrefs(s => s.appearance);
  const system = useColorScheme();
  return (appearance === 'system' ? system : appearance) === 'light' ? lightPalette : palette;
}
