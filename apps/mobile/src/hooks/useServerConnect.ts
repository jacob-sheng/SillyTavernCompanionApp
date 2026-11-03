import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ConnectionError } from '@st/core';
import { reconnectSavedServer } from '@/lib/serverConnection';
import { queryClient } from '@/lib/queryClient';

/** Shared by the start page and Settings; a failed handshake leaves the current server intact. */
export function useServerConnect() {
  const { t } = useTranslation();
  const pending = useRef<AbortController | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    setBusyId(null);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, []));
  const reconnectTo = async (id: string) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusyId(id);
    try {
      await reconnectSavedServer(id, controller.signal);
      if (controller.signal.aborted) return;
      void queryClient.invalidateQueries();
      router.replace('/(tabs)/chats');
    } catch (error) {
      if (controller.signal.aborted) return;
      const code = error instanceof ConnectionError ? error.code : 'network';
      Alert.alert(t('onboarding.connectionFailed'), t(`connectionErrors.${code}`), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('onboarding.editConnection'), onPress: () => router.push({ pathname: '/onboarding/manual', params: { serverId: id } }) },
      ]);
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusyId(null);
    }
  };
  return { reconnectTo, busyId };
}
