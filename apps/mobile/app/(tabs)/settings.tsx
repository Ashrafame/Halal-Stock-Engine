import { useEffect, useState } from 'react';

import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { SUPPORTED_LOCALES, type Locale } from '@hse/shared';

import { Button, Card, Input, Pill, Screen, SectionTitle } from '@/components/ui';
import { fetchEntitlements, registerPushToken, type MobileEntitlements } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localeName, useI18n } from '@/lib/i18n';
import { APP_URL, isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const { profile, isDemo, user, updateProfile, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [notifyEmail, setNotifyEmail] = useState(profile?.notifyEmail ?? true);
  const [notifyPush, setNotifyPush] = useState(profile?.notifyPush ?? true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [entitlements, setEntitlements] = useState<MobileEntitlements | null>(null);

  useEffect(() => {
    if (!profile) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate the controlled form when the async profile arrives */
    setFullName(profile.fullName ?? '');
    setNotifyEmail(profile.notifyEmail);
    setNotifyPush(profile.notifyPush);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    fetchEntitlements(profile.id)
      .then(setEntitlements)
      .catch(() => undefined);
  }, [profile]);

  async function handleSave() {
    if (!profile || isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    setSaving(true);
    const error = await updateProfile({
      fullName: fullName.trim() || null,
      notifyEmail,
      notifyPush,
    });
    setSaving(false);
    Alert.alert(error ? t('errors.generic') : t('settings.saved'));
  }

  async function handleLanguage(next: Locale) {
    await setLocale(next);
    if (profile && !isDemo) {
      await updateProfile({ locale: next });
    }
    if ((next === 'ar') !== (locale === 'ar')) {
      Alert.alert(t('settings.language'), t('settings.rtlRestart'));
    }
  }

  async function handlePush() {
    if (!profile || isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    setPushBusy(true);
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t('errors.forbidden'));
        return;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      await registerPushToken(profile.id, token.data, Platform.OS);
      Alert.alert(t('common.success'));
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSignOut() {
    if (isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    await signOut();
    router.replace('/login');
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>
        </View>

        {isDemo ? (
          <View style={styles.demo}>
            <Text style={styles.demoText}>{t('auth.demoNotice')}</Text>
          </View>
        ) : null}

        <Card>
          <SectionTitle title={t('settings.profile')} />
          <View style={styles.fieldGap}>
            <Input
              label={t('auth.fullName')}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
            <Input label={t('settings.email')} value={profile?.email ?? user?.email ?? ''} editable={false} />
            <Button
              label={t('settings.save')}
              onPress={handleSave}
              loading={saving}
              disabled={!profile}
            />
          </View>
        </Card>

        <Card>
          <SectionTitle title={t('settings.language')} />
          <View style={styles.languageRow}>
            {SUPPORTED_LOCALES.map((code) => (
              <Pill
                key={code}
                label={localeName(code)}
                active={locale === code}
                onPress={() => handleLanguage(code)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{t('landing.features.multilingual.body')}</Text>
        </Card>

        <Card>
          <SectionTitle title={t('settings.notifications')} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('settings.push')}</Text>
            <Switch
              value={notifyPush}
              onValueChange={setNotifyPush}
              trackColor={{ true: colors.brand600, false: colors.ink200 }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('settings.emailAlerts')}</Text>
            <Switch
              value={notifyEmail}
              onValueChange={setNotifyEmail}
              trackColor={{ true: colors.brand600, false: colors.ink200 }}
              thumbColor={colors.white}
            />
          </View>
          <Button
            label={t('settings.push')}
            onPress={handlePush}
            variant="outline"
            size="sm"
            loading={pushBusy}
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
          />
        </Card>

        <Card>
          <SectionTitle title={t('settings.billing')} />
          <View style={styles.billingRow}>
            <View>
              <Text style={styles.billingPlan}>
                {(entitlements?.planId ?? 'free').toUpperCase()}
              </Text>
              <Text style={styles.hint}>
                {entitlements?.status
                  ? `${entitlements.status} · ${t('settings.manageBilling')}`
                  : t('pricing.freeForever')}
              </Text>
            </View>
            <Button
              label={t('settings.manageBilling')}
              onPress={() => {
                Linking.openURL(`${APP_URL}/dashboard/settings`).catch(() =>
                  Alert.alert(t('errors.network')),
                );
              }}
              variant="outline"
              size="sm"
            />
          </View>
        </Card>

        <Card>
          <SectionTitle title={t('settings.security')} />
          <Button label={t('settings.signOut')} onPress={handleSignOut} variant="outline" />
        </Card>

        <Text style={styles.version}>
          {Constants.expoConfig?.name ?? 'Halal Stock Engine'} v
          {Constants.expoConfig?.version ?? '1.0.0'}
          {isSupabaseConfigured ? '' : ' · demo'}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { ...typography.display, color: colors.ink950 },
  subtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  demo: {
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  demoText: { ...typography.small, color: colors.amber700 },
  fieldGap: { gap: spacing.md },
  languageRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  hint: { ...typography.small, color: colors.ink400, marginTop: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.ink700 },
  billingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  billingPlan: { fontSize: 18, fontWeight: '800', color: colors.ink950 },
  version: { ...typography.small, color: colors.ink300, textAlign: 'center' },
});
