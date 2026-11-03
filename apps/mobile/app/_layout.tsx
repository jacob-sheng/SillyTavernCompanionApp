import '../global.css';
import '@/i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { fileStorage } from '@/lib/persist';
import { LockGate } from '@/components/LockGate';
import { TavernHost } from '@/components/TavernHost';
import { vars } from 'nativewind';
import { useThemeColors } from '@/theme/useThemeColors';
import { useServers } from '@/stores/serversStore';
import { useLocale } from '@/stores/localeStore';
import { usePrefs } from '@/stores/prefsStore';
import { useUpdates } from '@/stores/updateStore';

const persister = createAsyncStoragePersister({ storage: fileStorage, throttleTime: 1000 });

// Keep the splash up until the Inter font is ready, so the first paint is on-brand.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colors = useThemeColors();
  const themeVars = vars(Object.fromEntries(Object.entries(colors).map(([key, value]) => [`--stc-${key}`, value])));
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    void useServers.getState().hydrate();
    void useLocale.getState().hydrate();
    void usePrefs.getState().hydrate();
    void useUpdates.getState().check();
  }, []);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={[{ flex: 1 }, themeVars]}>
      <KeyboardProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister,
              buster: 'native-browser-v1',
              maxAge: 1000 * 60 * 60 * 24 * 7, // keep the offline cache for a week
              // Don't persist the settings blob to disk - it can contain cloud API keys.
              dehydrateOptions: {
                shouldDehydrateQuery: (q) => ['characters', 'character', 'charchats'].includes(String(q.queryKey[0])),
              },
            }}
          >
            <StatusBar style={colors.bg === '#FAFAFC' ? 'dark' : 'light'} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <TavernHost />
            <LockGate />
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
