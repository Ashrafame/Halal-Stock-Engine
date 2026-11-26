import { useCallback, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  formatCurrency,
  formatRelativeTime,
  type PriceAlert,
  type TopStock,
} from '@hse/shared';

import { ComplianceBadge } from '@/components/StockCard';
import { Button, Card, EmptyState, Input, LoadingView, Pill, Screen } from '@/components/ui';
import {
  createPriceAlert,
  deleteAlert,
  fetchAlerts,
  fetchEntitlements,
  fetchTopStocks,
  setAlertStatus,
  type MobileAlert,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, radius, spacing, typography } from '@/theme';

function condition(
  alert: PriceAlert,
  locale: 'en' | 'ar' | 'es',
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (alert.alertType === 'indicator') {
    return `${t(`alerts.indicators.${alert.indicator ?? 'rsi_14'}`)} ${t(
      `alerts.operators.${alert.operator}`,
    )} ${alert.threshold ?? '—'}`;
  }
  if (alert.alertType === 'compliance') return t('alerts.types.compliance');
  return `${t(`alerts.operators.${alert.operator}`)} ${
    alert.targetPrice ? formatCurrency(alert.targetPrice, 'USD', locale) : '—'
  }`;
}

export default function AlertsScreen() {
  const { profile, isDemo } = useAuth();
  const { t, locale } = useI18n();

  const [alerts, setAlerts] = useState<MobileAlert[]>([]);
  const [stocks, setStocks] = useState<TopStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [operator, setOperator] = useState<'above' | 'below'>('above');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [limit, setLimit] = useState(3);

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    try {
      const [alertRows, stockRows, entitlements] = await Promise.all([
        fetchAlerts(profile.id),
        fetchTopStocks(20),
        fetchEntitlements(profile.id),
      ]);
      setAlerts(alertRows);
      setStocks(stockRows);
      setSelectedStock((current) => current ?? stockRows[0]?.stock.id ?? null);
      setLimit(entitlements.limits.maxAlerts ?? 3);
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleCreate() {
    if (!profile || isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    if (!selectedStock) return;
    const price = Number(target);
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert(t('errors.validation'), t('alerts.targetPrice'));
      return;
    }
    setCreating(true);
    try {
      await createPriceAlert({
        userId: profile.id,
        stockId: selectedStock,
        targetPrice: price,
        operator,
      });
      setTarget('');
      await load();
      Alert.alert(t('alerts.created'));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'create_failed';
      Alert.alert(
        t('errors.generic'),
        code === 'alert_limit'
          ? t('alerts.limitReached', { limit })
          : code === 'compliance_gate'
            ? t('errors.complianceGate')
            : t('errors.generic'),
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(alert: MobileAlert) {
    if (isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    try {
      await setAlertStatus(alert.id, alert.status === 'active' ? 'paused' : 'active');
      await load();
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  function handleDelete(alert: MobileAlert) {
    if (isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    Alert.alert(t('alerts.deleteAction'), alert.symbol, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('alerts.deleteAction'),
        style: 'destructive',
        onPress: () => {
          deleteAlert(alert.id).then(load).catch(() => Alert.alert(t('errors.generic')));
        },
      },
    ]);
  }

  if (!profile && !isDemo) {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState
            title={t('errors.unauthorized')}
            description={t('auth.loginSubtitle')}
            action={
              <Button label={t('nav.login')} onPress={() => {}} />
            }
          />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <LoadingView label={t('common.loading')} />
      </Screen>
    );
  }

  const active = alerts.filter((alert) => alert.status === 'active').length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('alerts.title')}</Text>
            <Text style={styles.subtitle}>{t('alerts.subtitle')}</Text>
          </View>
          <Pill
            label={`${active} / ${limit === -1 ? t('common.unlimited') : limit}`}
            tone="halal"
          />
        </View>

        <Card>
          <Text style={styles.cardTitle}>{t('alerts.createTitle')}</Text>

          <Text style={styles.fieldLabel}>{t('alerts.stock')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stockPicker}
          >
            {stocks.map((item) => (
              <Pressable
                key={item.stock.id}
                onPress={() => setSelectedStock(item.stock.id)}
                style={[
                  styles.stockChip,
                  selectedStock === item.stock.id && styles.stockChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.stockChipSymbol,
                    selectedStock === item.stock.id && { color: colors.cream },
                  ]}
                >
                  {item.stock.symbol}
                </Text>
                <ComplianceBadge
                  status={item.stock.complianceStatus}
                  label={t(`compliance.status.${item.stock.complianceStatus}`)}
                />
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.operatorRow}>
            {(['above', 'below'] as const).map((value) => (
              <Pill
                key={value}
                label={t(`alerts.operators.${value}`)}
                active={operator === value}
                onPress={() => setOperator(value)}
              />
            ))}
          </View>

          <Input
            label={t('alerts.targetPrice')}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            placeholder="250.00"
          />

          <Button
            label={t('alerts.create')}
            onPress={handleCreate}
            loading={creating}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {alerts.length === 0 ? (
          <EmptyState title={t('alerts.empty')} description={t('alerts.createTitle')} />
        ) : (
          <View style={{ gap: spacing.md }}>
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <View style={styles.alertHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertSymbol}>
                      {alert.symbol}{' '}
                      <Text style={styles.alertName}>{alert.name}</Text>
                    </Text>
                    <Text style={styles.alertCondition}>
                      {condition(alert, locale, t)}
                    </Text>
                  </View>
                  <Pill
                    label={t(`alerts.${alert.status}`)}
                    tone={alert.status === 'active' ? 'halal' : 'neutral'}
                  />
                </View>

                <View style={styles.alertMeta}>
                  <View>
                    <Text style={styles.metaLabel}>{t('alerts.currentPrice')}</Text>
                    <Text style={styles.metaValue}>
                      {alert.currentPrice
                        ? formatCurrency(alert.currentPrice, 'USD', locale)
                        : '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.metaLabel}>{t('alerts.channels')}</Text>
                    <Text style={styles.metaValue}>
                      {[alert.notifyPush ? t('settings.push') : null, alert.notifyEmail ? t('settings.emailAlerts') : null]
                        .filter(Boolean)
                        .join(' · ') || t('common.none')}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.metaLabel}>{t('alerts.cooldown')}</Text>
                    <Text style={styles.metaValue}>{alert.cooldownMinutes}m</Text>
                  </View>
                </View>

                <View style={styles.alertFooter}>
                  <Text style={styles.alertTime}>
                    {alert.lastTriggeredAt
                      ? `${t('alerts.triggered')} ${formatRelativeTime(alert.lastTriggeredAt, locale)}`
                      : t('alerts.created')}
                  </Text>
                  <View style={styles.alertActions}>
                    <Pressable onPress={() => handleToggle(alert)} style={styles.smallButton}>
                      <Text style={styles.smallButtonText}>
                        {alert.status === 'active'
                          ? t('alerts.pauseAction')
                          : t('alerts.resumeAction')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(alert)}
                      style={[styles.smallButton, styles.deleteButton]}
                    >
                      <Text style={[styles.smallButtonText, { color: colors.red600 }]}>
                        {t('alerts.deleteAction')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typography.display, color: colors.ink950 },
  subtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  cardTitle: { ...typography.heading, color: colors.ink950, marginBottom: spacing.sm },
  fieldLabel: {
    ...typography.label,
    color: colors.ink500,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  stockPicker: { gap: spacing.sm, paddingVertical: spacing.xs },
  stockChip: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
    minWidth: 72,
    backgroundColor: colors.white,
  },
  stockChipActive: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
  stockChipSymbol: { fontSize: 12, fontWeight: '800', color: colors.ink900 },
  operatorRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  alertHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  alertSymbol: { ...typography.heading, color: colors.ink950 },
  alertName: { fontWeight: '400', color: colors.ink400, fontSize: 12 },
  alertCondition: { ...typography.small, color: colors.ink500, marginTop: 2 },
  alertMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.sand50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  metaLabel: { fontSize: 9, color: colors.ink400, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: 12, fontWeight: '700', color: colors.ink900, marginTop: 2 },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  alertTime: { ...typography.small, color: colors.ink300, flex: 1 },
  alertActions: { flexDirection: 'row', gap: spacing.xs },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  smallButtonText: { fontSize: 10, fontWeight: '700', color: colors.ink600 },
  deleteButton: { borderColor: '#FECACA' },
});
