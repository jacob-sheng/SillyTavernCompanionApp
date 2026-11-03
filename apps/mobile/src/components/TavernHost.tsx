import { useThemeColors } from '@/theme/useThemeColors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, StyleSheet, View, useWindowDimensions, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useTavern } from '@/stores/tavernStore';
import { useConnection } from '@/stores/connectionStore';
import { useServers } from '@/stores/serversStore';
import { usePrefs } from '@/stores/prefsStore';
import { queryClient } from '@/lib/queryClient';
import { tavernBundle } from '@/generated/tavernBundle';
import { parseWebMessage, type NativeCommand, type BootConfig } from '../../../../packages/web-ui/src/protocol';
import { AppText, Button } from '@/components/ui';
import { colors } from '@/theme/tokens';

export function TavernHost() {
  const instance = useConnection(s => s.instance);
  const client = useConnection(s => s.client);
  const request = useTavern(s => s.request);
  const reset = useTavern(s => s.reset);
  useEffect(() => { reset(); }, [client, reset]);
  if (!instance || !request) return null;
  return <ServerTavern key={instance.baseUrl} baseUrl={instance.baseUrl} />;
}

function ServerTavern({ baseUrl }: { baseUrl: string }) {
  const { t, i18n } = useTranslation();
  const themeColors = useThemeColors();
  const { visible, request, original, revision, session, hide, reload } = useTavern();
  const { width, height } = useWindowDimensions();
  const ref = useRef<WebView<object>>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatchedRequest = useRef<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | undefined>();
  const [credentialsReady, setCredentialsReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const origin = new URL(baseUrl).origin;
  const systemTheme = useColorScheme();
  const appearance = usePrefs(s => s.appearance);
  const theme = appearance === 'system' ? systemTheme ?? 'dark' : appearance;
  const bootConfig: BootConfig = { session, origin, locale: i18n.language, theme, original };
  const injected = `window.__STC_CONFIG__=${JSON.stringify(bootConfig)};${tavernBundle}\ntrue;`;
  const previousLocale = useRef(i18n.language);
  useEffect(() => {
    // Preferences are changed on the native home, after the leave/save handshake.
    // Rebuild this browser session without replaying its last mutation.
    if (!visible && previousLocale.current !== i18n.language) {
      previousLocale.current = i18n.language;
      reload(original);
    }
  }, [i18n.language, visible, original, reload]);
  useEffect(() => {
    ref.current?.injectJavaScript(`document.documentElement.dataset.stcTheme=${JSON.stringify(theme)};true;`);
  }, [theme]);
  const invalidate = () => { for (const key of ['characters', 'character', 'charchats']) void queryClient.invalidateQueries({ queryKey: [key] }); };
  const send = useCallback((command: Omit<NativeCommand, 'session' | 'version'>) => {
    ref.current?.injectJavaScript(`window.__STC_RECEIVE__?.(${JSON.stringify({ ...command, session, version: 1 })});true;`);
  }, [session]);
  const leave = useCallback(() => {
    if (!ready || error) { hide(); return; }
    send({ type: 'leave', id: `leave-${Date.now()}` });
  }, [ready, error, hide, send]);
  useEffect(() => {
    let disposed = false;
    const saved = useServers.getState().servers.find(s => s.baseUrl === baseUrl);
    void (saved?.hasAuth ? useServers.getState().getCreds(saved.id) : Promise.resolve(undefined)).then(async value => {
      if (disposed) return;
      if (saved?.hasAuth && !value) setError('unauthorized');
      if (value) {
        // The one-shot native challenge handler is only enabled for a protected root.
        // A partially protected public document must never solicit credentials via an iframe.
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          let response: Response;
          try { response = await fetch(baseUrl, { method: 'GET', redirect: 'manual', signal: controller.signal }); }
          finally { clearTimeout(timeout); }
          if (response.status !== 401 || !/^Basic\s/i.test(response.headers.get('www-authenticate') ?? '')) {
            if (!disposed) { setError('unauthorized'); setBusy(false); }
            return;
          }
        } catch { if (!disposed) { setError('network'); setBusy(false); } return; }
      }
      if (disposed) return;
      setCredentials(value); setCredentialsReady(true);
    });
    return () => { disposed = true; };
  }, [baseUrl]);
  useEffect(() => {
    setReady(false); setInteractive(false); setBusy(true); setError(null);
  }, [revision]);
  useEffect(() => {
    if (!visible) return;
    void activateKeepAwakeAsync('tavern');
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (ready && !error) send({ type: 'back', id: `back-${Date.now()}` }); else leave(); return true; });
    return () => { listener.remove(); void deactivateKeepAwake('tavern'); };
  }, [visible, leave, ready, error, send]);
  useEffect(() => {
    if (!ready || !request || !visible) return;
    // Page reloads (including extension updates) destroy the JS command ledger.
    // The native host survives them: never replay an already dispatched new-chat.
    if (dispatchedRequest.current === request.id) { setBusy(false); return; }
    dispatchedRequest.current = request.id;
    setBusy(true);
    // The request ID is stable across repeated ready signals and rerenders.
    ref.current?.injectJavaScript(`window.__STC_RECEIVE__?.(${JSON.stringify({ version: 1, session, id: request.id, type: 'navigate', target: request.target })});true;`);
    navigationTimer.current = setTimeout(() => { setBusy(false); setError('timeout'); }, 30000);
    return () => { if (navigationTimer.current) clearTimeout(navigationTimer.current); };
  }, [ready, request, session, visible]);
  useEffect(() => {
    if (ready || interactive || !credentialsReady) return;
    const timeout = setTimeout(() => { setBusy(false); setError('timeout'); }, 45000);
    return () => clearTimeout(timeout);
  }, [ready, interactive, credentialsReady, revision]);
  const exportFile = (name: string, mime: string, base64: string) => Alert.alert(t('tavern.saveFile'), t('tavern.exportConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.save'), onPress: () => { void (async () => {
      try {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) return;
        const filename = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'export';
        const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, mime);
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } catch { Alert.alert(t('common.error'), t('tavern.exportFailed')); }
    })(); } },
  ]);
  const onMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    const message = parseWebMessage(nativeEvent.data, session, nativeEvent.url, origin);
    if (!message) return;
    switch (message.type) {
      case 'ready': setReady(true); break;
      case 'interactive': setInteractive(true); setBusy(false); break;
      case 'dataChanged': invalidate(); break;
      case 'openNativeHome': invalidate(); hide(); break;
      case 'navigationResult':
        if (message.id === request?.id) { if (navigationTimer.current) clearTimeout(navigationTimer.current); setBusy(false); if (!message.ok) { invalidate(); setError(message.code ?? 'network'); } }
        else if (!message.ok) Alert.alert(t('common.error'), t(`tavern.${message.code ?? 'network'}`));
        break;
      case 'busy':
        setBusy(false);
        Alert.alert(t('tavern.title'), t('tavern.busy'), [
          { text: t('tavern.stay'), style: 'cancel' },
          { text: t('tavern.stopAndLeave'), onPress: () => send({ type: 'stopAndLeave', id: `stop-${Date.now()}` }) },
        ]); break;
      case 'error': setError(message.code ?? 'network'); setBusy(false); break;
      case 'exportFile': exportFile(message.name!, message.mime!, message.base64!); break;
    }
  };
  return <SafeAreaView edges={['top', 'bottom']} pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.host, { width, height, backgroundColor: themeColors.bg, top: visible ? 0 : -height * 2 }]}>
    {(original || !ready || error) && <View style={styles.toolbar}>
      <Button label={t('tavern.home')} variant="ghost" fullWidth={false} onPress={leave} />
      <Button label={t(original ? 'tavern.modern' : 'tavern.original')} variant="ghost" fullWidth={false} onPress={() => Alert.alert(t('tavern.clearSession'), t('tavern.clearSessionConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.confirm'), onPress: () => reload(!original) }])} />
    </View>}
    <View style={{ flex: 1 }}>
      {credentialsReady && <WebView<object> key={session} ref={ref} source={{ uri: baseUrl }} basicAuthCredential={credentials} incognito cacheEnabled={false} thirdPartyCookiesEnabled={false} javaScriptEnabled domStorageEnabled setSupportMultipleWindows allowsFullscreenVideo mixedContentMode="never" allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} webviewDebuggingEnabled={__DEV__} injectedJavaScript={injected} onMessage={onMessage}
        onShouldStartLoadWithRequest={event => {
          try {
            const url = new URL(event.url);
            if (url.origin === origin || event.url === 'about:blank') return true;
            if (['https:', 'http:'].includes(url.protocol)) void Linking.openURL(url.href);
          } catch { /* reject malformed navigation */ }
          return false;
        }}
        onOpenWindow={({ nativeEvent }) => { if (/^https?:\/\//i.test(nativeEvent.targetUrl)) void Linking.openURL(nativeEvent.targetUrl); }}
        onLoadStart={() => { setReady(false); setBusy(true); }}
        onLoadEnd={() => { if (original) { setInteractive(true); setBusy(false); } }}
        onError={() => { setError('network'); setBusy(false); }}
        onHttpError={({ nativeEvent }) => { if (nativeEvent.url === baseUrl || nativeEvent.url === `${baseUrl}/`) { setError(nativeEvent.statusCode === 401 ? 'unauthorized' : 'network'); setBusy(false); } }}
        onRenderProcessGone={() => { setReady(false); setBusy(false); setError('network'); }}
      />}
      {(busy || error) && !(original && interactive) && <View style={[styles.cover, { backgroundColor: themeColors.bg }]}>
        {!error && <ActivityIndicator color={colors.accent} size="large" />}
        <AppText style={{ textAlign: 'center', marginVertical: 20 }}>{error ? t(`tavern.${error}`) : t('tavern.loading')}</AppText>
        {error && <><Button label={t('tavern.retry')} onPress={() => reload(original)} /><Button label={t('tavern.original')} variant="secondary" onPress={() => reload(true)} /><Button label={t('tavern.returnHome')} variant="ghost" onPress={hide} /></>}
      </View>}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', left: 0, zIndex: 100, backgroundColor: colors.bg }, toolbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }, cover: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, padding: 28, justifyContent: 'center', gap: 12 } });
