import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { validateConnection, normalizeServerUrl, ConnectionError } from '@st/core';
import { fetchLike } from '@/lib/expoFetch';
import { useConnection } from '@/stores/connectionStore';
import { useServers } from '@/stores/serversStore';
import { AppText, Button, Field } from '@/components/ui';
import { colors } from '@/theme/tokens';
import { haptics } from '@/theme/haptics';

export default function ManualScreen() {
  const { t } = useTranslation();
  const activate = useConnection((s) => s.activate);
  const { serverId } = useLocalSearchParams<{ serverId?: string }>();
  const [mode, setMode] = useState<'url' | 'lan'>('url');
  const [address, setAddress] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const upsertServer = useServers((s) => s.upsert);
  const [host, setHost] = useState('192.168.178.');
  const [port, setPort] = useState('8000');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const server = useServers.getState().servers.find((s) => s.id === serverId);
    if (server) {
      setAddress(server.baseUrl);
      void useServers.getState().getCreds(server.id).then((creds) => {
        if (mounted && creds) { setUser(creds.username); setPass(creds.password); }
      });
    }
    return () => { mounted = false; };
  }, [serverId]);

  const onConnect = async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'lan' && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 ||
          !/^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim()) || host.trim().split('.').some((n) => Number(n) > 255))) {
        throw new ConnectionError('invalidUrl');
      }
      const baseUrl = normalizeServerUrl(mode === 'url' ? address : `http://${host.trim()}:${port}`);
      if (user.includes(':') || /[\r\n]/.test(user + pass) || (!user.trim() && pass)) {
        setError(t('onboarding.invalidCredentials'));
        return;
      }
      const hasAuth = !!user.trim();
      const basicAuth = hasAuth ? { username: user.trim(), password: pass } : undefined;
      const result = await validateConnection({ baseUrl, fetchImpl: fetchLike,
        ...(basicAuth ? { basicAuth } : {}), signal: controller.signal });
      if (controller.signal.aborted) return;
      await upsertServer(
        { id: baseUrl, label: baseUrl, baseUrl, ip: result.instance.ip, port: result.instance.port, hasAuth },
        basicAuth ? { user: basicAuth.username, pass: basicAuth.password } : undefined,
      );
      if (controller.signal.aborted) return;
      activate(result.instance, result.client);
      haptics.success();
      router.replace('/(tabs)/chats');
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(t(`connectionErrors.${e instanceof ConnectionError ? e.code : 'network'}`));
        haptics.error();
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t('onboarding.manualTitle'), headerShown: true }} />
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="body" color="muted">
          {t('onboarding.manualDescription')}
        </AppText>

        <View style={{ gap: 8 }}>
          <Button label={t('onboarding.urlMode')} variant={mode === 'url' ? 'primary' : 'secondary'} disabled={busy} onPress={() => setMode('url')} />
          <Button label={t('onboarding.lanMode')} variant={mode === 'lan' ? 'primary' : 'secondary'} disabled={busy} onPress={() => setMode('lan')} />
        </View>
        {mode === 'url' ? (
          <Field testID="server-url" label={t('onboarding.serverUrl')} value={address} onChangeText={setAddress}
            editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://st.example.com" />
        ) : (
          <>
            <Field label={t('onboarding.ipAddress')} value={host} onChangeText={setHost}
              editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" placeholder="192.168.178.23" />
            <Field label={t('onboarding.port')} value={port} onChangeText={setPort}
              editable={!busy} keyboardType="number-pad" placeholder="8000" />
          </>
        )}
        <Field
          testID="server-username"
          label={t('onboarding.username')}
          editable={!busy}
          value={user}
          onChangeText={setUser}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          placeholder="-"
        />
        <Field
          testID="server-password"
          label={t('onboarding.password')}
          editable={!busy}
          value={pass}
          onChangeText={setPass}
          password
          autoCapitalize="none"
          textContentType="password"
          placeholder="-"
          error={error ?? undefined}
        />

        <View className="mt-2">
          <Button testID="connect-server" label={t('onboarding.connect')} leftIcon="link" loading={busy} onPress={onConnect} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
