import { requireOptionalNativeModule } from 'expo-modules-core';

interface ScreenStateModule {
  setSecureWindow: (enabled: boolean) => void;
  addListener(event: 'screenOff', listener: () => void): { remove: () => void };
}

const ScreenState = requireOptionalNativeModule<ScreenStateModule>('ScreenState');

export function setSecureWindow(enabled: boolean): void { ScreenState?.setSecureWindow(enabled); }

/**
 * Subscribe to display-off events (Android ACTION_SCREEN_OFF). Returns an unsubscribe
 * function; a no-op when the native module is unavailable (e.g. iOS or Expo Go).
 */
export function addScreenOffListener(listener: () => void): () => void {
  if (!ScreenState) return () => {};
  const sub = ScreenState.addListener('screenOff', listener);
  return () => sub.remove();
}
