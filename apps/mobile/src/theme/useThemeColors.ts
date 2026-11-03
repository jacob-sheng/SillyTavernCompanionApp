import { useColorScheme } from 'react-native';
import { usePrefs } from '@/stores/prefsStore';
import { palette, lightPalette } from './palette';
export function useThemeColors() {
  const appearance = usePrefs(s => s.appearance);
  const system = useColorScheme();
  return (appearance === 'system' ? system : appearance) === 'light' ? lightPalette : palette;
}
