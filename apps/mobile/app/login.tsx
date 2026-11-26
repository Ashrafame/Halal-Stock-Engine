import { useState } from 'react';

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, Input, Pill, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { localeName, useI18n } from '@/lib/i18n';
import { SUPPORTED_LOCALES, type Locale } from '@hse/shared';
import { colors, radius, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const { signIn, signUp, isDemo } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t('errors.validation'));
      return;
    }
    if (mode === 'signup' && password.length < 10) {
      setError(t('auth.passwordHint'));
      return;
    }

    setBusy(true);
    const message =
      mode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp({
            email: email.trim(),
            password,
            fullName: fullName.trim() || undefined,
            locale,
          });
    setBusy(false);

    if (message) {
      setError(
        message === 'not_configured'
          ? t('auth.demoNotice')
          : t('auth.invalidCredentials'),
      );
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoMark}>☾</Text>
            </View>
            <Text style={styles.brandName}>Halal Stock Engine</Text>
            <Text style={styles.brandTag}>{t('landing.eyebrow')}</Text>
          </View>

          <Card>
            <Text style={styles.title}>
              {mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
            </Text>

            {isDemo ? <Text style={styles.demo}>{t('auth.demoNotice')}</Text> : null}

            <View style={styles.form}>
              {mode === 'signup' ? (
                <Input
                  label={t('auth.fullName')}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              ) : null}
              <Input
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Input
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              {mode === 'signup' ? (
                <Text style={styles.hint}>{t('auth.passwordHint')}</Text>
              ) : null}

              <View style={styles.languageRow}>
                {SUPPORTED_LOCALES.map((code: Locale) => (
                  <Pill
                    key={code}
                    label={localeName(code)}
                    active={locale === code}
                    onPress={() => setLocale(code)}
                  />
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label={mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
                onPress={handleSubmit}
                loading={busy}
                size="lg"
              />

              {isDemo ? (
                <Button
                  label={t('dashboard.demo')}
                  onPress={() => router.replace('/(tabs)')}
                  variant="outline"
                  size="lg"
                />
              ) : null}

              <Text style={styles.switchText}>
                {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
                <Text
                  style={styles.switchLink}
                  onPress={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError(null);
                  }}
                >
                  {mode === 'login' ? t('auth.createAccount') : t('auth.signIn')}
                </Text>
              </Text>
            </View>
          </Card>

          <Text style={styles.legal}>{t('landing.disclaimer')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.ink950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { color: colors.lime, fontSize: 28 },
  brandName: { ...typography.title, color: colors.ink950 },
  brandTag: { ...typography.small, color: colors.ink400, textAlign: 'center' },
  title: { ...typography.title, color: colors.ink950 },
  subtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  demo: {
    ...typography.small,
    color: colors.amber700,
    backgroundColor: colors.amber50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  form: { gap: spacing.md, marginTop: spacing.md },
  hint: { ...typography.small, color: colors.ink400 },
  languageRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  error: {
    ...typography.small,
    color: colors.red700,
    backgroundColor: colors.red50,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  switchText: { ...typography.small, color: colors.ink500, textAlign: 'center' },
  switchLink: { color: colors.brand700, fontWeight: '700' },
  legal: { ...typography.small, color: colors.ink300, textAlign: 'center', paddingHorizontal: spacing.md },
});
