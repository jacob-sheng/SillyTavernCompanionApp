import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { useConnection } from '@/stores/connectionStore';
import { useServers } from '@/stores/serversStore';
import { useLocale, type LanguagePref } from '@/stores/localeStore';
import { usePrefs } from '@/stores/prefsStore';
import { useUpdates } from '@/stores/updateStore';
import { useTavern } from '@/stores/tavernStore';
import { useServerConnect } from '@/hooks/useServerConnect';
import { downloadAndInstallUpdate } from '@/lib/updates';
import { Screen, Header, Section, Card, Button, AppText } from '@/components/ui';
import type { Panel } from '../../../../packages/web-ui/src/protocol';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const servers = useServers(s => s.servers);
  const removeServer = useServers(s => s.remove);
  const instance = useConnection(s => s.instance);
  const disconnect = useConnection(s => s.disconnect);
  const { reconnectTo, busyId } = useServerConnect();
  const { pref, setLanguage } = useLocale();
  const prefs = usePrefs();
  const updates = useUpdates();
  const [progress, setProgress] = useState<number | null>(null);
  const open = (panel: Panel) => useTavern.getState().open({ kind: 'panel', panel });
  const toggleLock = async (on: boolean) => {
    if (!on) { prefs.setAppLock(false); return; }
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.prompt'), cancelLabel: t('common.cancel') });
      if (result.success) prefs.setAppLock(true);
    } catch { Alert.alert(t('common.error'), t('lock.prompt')); }
  };
  const install = async () => {
    if (!updates.available || progress !== null) return;
    setProgress(0);
    try { await downloadAndInstallUpdate(updates.available, setProgress); }
    catch { Alert.alert(t('common.error'), t('settings.updateFailed')); }
    finally { setProgress(null); }
  };
  return <Screen edges={['top']}><Header title={t('tabs.settings')} subtitle={`v${Constants.expoConfig?.version ?? ''}`} />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
      <Section title={t('tavern.workspace')}>
        {(['models', 'presets', 'formatting', 'world', 'personas', 'characters', 'extensions', 'settings', 'backgrounds'] as Panel[]).map(panel => <Button key={panel} label={t(`tavern.${panel}`)} variant="secondary" disabled={!instance} onPress={() => open(panel)} />)}
        <Button label={t('tavern.original')} variant="ghost" disabled={!instance} onPress={() => useTavern.getState().open({ kind: 'original' })} />
      </Section>
      <Section title={t('settings.language')}>
        {(['system', 'zh-CN', 'en', 'de'] as LanguagePref[]).map(lang => <Button key={lang} label={lang === 'system' ? t('settings.languageSystem') : lang === 'zh-CN' ? '简体中文' : lang === 'de' ? 'Deutsch' : 'English'} variant={lang === pref ? 'primary' : 'secondary'} onPress={() => setLanguage(lang)} />)}
      </Section>
      <Section title={t('tavern.appearance')}>
        {(['system', 'light', 'dark'] as const).map(theme => <Button key={theme} label={t(`tavern.${theme}`)} variant={theme === prefs.appearance ? 'primary' : 'secondary'} onPress={() => prefs.setAppearance(theme)} />)}
        <Button label={t('settings.chatListLatest')} variant={prefs.chatList === 'latest' ? 'primary' : 'secondary'} onPress={() => prefs.setChatList('latest')} />
        <Button label={t('settings.chatListAll')} variant={prefs.chatList === 'all' ? 'primary' : 'secondary'} onPress={() => prefs.setChatList('all')} />
      </Section>
      <Section title={t('lock.title')}>
        <Card className="flex-row items-center justify-between p-4"><AppText>{t('lock.title')}</AppText><Switch accessibilityLabel={t('lock.title')} value={prefs.appLock} onValueChange={on => void toggleLock(on)} /></Card>
        <AppText color="muted">{t('settings.appLockSubtitle')}</AppText>
        {prefs.appLock && <>
          <Card className="flex-row items-center justify-between p-4 gap-3">
            <View style={{ flex: 1 }}><AppText>{t('settings.appLockTimer')}</AppText><AppText variant="caption" color="muted">{t('settings.appLockTimerSubtitle')}</AppText></View>
            <Switch accessibilityLabel={t('settings.appLockTimer')} value={prefs.appLockTimer} onValueChange={prefs.setAppLockTimer} />
          </Card>
          {prefs.appLockTimer && <View style={{ gap: 8 }}>
            <AppText>{t('settings.appLockMinutes')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from(new Set([1, 5, 15, 30, prefs.appLockMinutes])).sort((a, b) => a - b).map(minutes => <Button key={minutes} label={String(minutes)} fullWidth={false} variant={minutes === prefs.appLockMinutes ? 'primary' : 'secondary'} onPress={() => prefs.setAppLockMinutes(minutes)} />)}
            </View>
          </View>}
        </>}
      </Section>
      <Section title={t('settings.savedServers')}>
        {servers.map(server => <Card key={server.id} className="p-4 gap-2">
          <AppText variant="title">{server.label}</AppText><AppText color="muted">{server.baseUrl}</AppText>
          <Button label={t('onboarding.connect')} disabled={busyId !== null} onPress={() => void reconnectTo(server.id)} />
          <Button label={t('onboarding.editConnection')} variant="secondary" onPress={() => router.push({ pathname: '/onboarding/manual', params: { serverId: server.id } })} />
          <Button label={t('common.delete')} variant="ghost" onPress={() => Alert.alert(t('common.delete'), server.label, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => { if (instance?.baseUrl === server.baseUrl) disconnect(); void removeServer(server.id); } }])} />
        </Card>)}
        <Button label={t('onboarding.editConnection')} variant="secondary" onPress={() => router.push('/onboarding/manual')} />
      </Section>
      <Section title={t('settings.updateCheck')}>
        <Button label={t('settings.updateCheck')} disabled={updates.checking} variant="secondary" onPress={() => void updates.check()} />
        {updates.available && <Button label={`${updates.available.version}${progress === null ? '' : ` · ${Math.round(progress * 100)}%`}`} onPress={() => void install()} disabled={progress !== null} />}
      </Section>
      <View style={{ height: 12 }} />
    </ScrollView>
  </Screen>;
}
