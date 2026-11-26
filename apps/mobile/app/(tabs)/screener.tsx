import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  localizedStockName,
  type ComplianceStatus,
  type TopStock,
} from '@hse/shared';

import { ComplianceBadge } from '@/components/StockCard';
import { EmptyState, Input, LoadingView, Pill, Screen } from '@/components/ui';
import { createPriceAlert, fetchScreener } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, radius, spacing, typography } from '@/theme';

type Filter = 'all' | ComplianceStatus;

export default function ScreenerScreen() {
  const { profile, isDemo } = useAuth();
  const { t, locale } = useI18n();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<TopStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (search: string) => {
      setLoading(true);
      try {
        setRows(await fetchScreener(search));
      } catch {
        Alert.alert(t('errors.generic'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  const filtered = useMemo(
    () =>
      rows.filter((item) => filter === 'all' || item.stock.complianceStatus === filter),
    [rows, filter],
  );

  const handleAlert = useCallback(
    async (stockId: string) => {
      if (!profile || isDemo) {
        Alert.alert(t('admin.demoReadOnly'));
        return;
      }
      setBusy(stockId);
      try {
        await createPriceAlert({ userId: profile.id, stockId });
        Alert.alert(t('alerts.created'), t('dashboard.oneClickHint'));
      } catch (error) {
        const code = error instanceof Error ? error.message : 'create_failed';
        Alert.alert(
          t('errors.generic'),
          code === 'alert_limit'
            ? t('alerts.limitReached', { limit: 3 })
            : code === 'compliance_gate'
              ? t('errors.complianceGate')
              : t('errors.generic'),
        );
      } finally {
        setBusy(null);
      }
    },
    [profile, isDemo, t],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.title}>{t('screener.title')}</Text>
          <Text style={styles.subtitle}>{t('screener.subtitle')}</Text>
        </View>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('screener.searchPlaceholder')}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Pill
            label={t('common.all')}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {(['halal', 'questionable', 'haram'] as ComplianceStatus[]).map((status) => (
            <Pill
              key={status}
              label={t(`compliance.status.${status}`)}
              active={filter === status}
              tone={status === 'halal' ? 'halal' : status === 'questionable' ? 'warning' : 'danger'}
              onPress={() => setFilter(status)}
            />
          ))}
        </ScrollView>

        <View style={styles.countRow}>
          <Text style={styles.count}>
            {filtered.length} {t('screener.results')}
          </Text>
          <Text style={styles.countHint}>{t('screener.halalOnly')}</Text>
        </View>

        {loading ? (
          <LoadingView label={t('common.loading')} />
        ) : filtered.length === 0 ? (
          <EmptyState title={t('screener.empty')} description={t('screener.subtitle')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((item) => {
              const { stock, quote } = item;
              const positive = (quote?.changePercent ?? 0) >= 0;
              return (
                <Pressable
                  key={stock.id}
                  style={styles.row}
                  onPress={() => handleAlert(stock.id)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{stock.symbol.slice(0, 2)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.symbol}>{stock.symbol}</Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {localizedStockName(stock, locale)}
                    </Text>
                    <View style={styles.metaRow}>
                      <ComplianceBadge
                        status={stock.complianceStatus}
                        label={t(`compliance.status.${stock.complianceStatus}`)}
                      />
                      <Text style={styles.debt}>
                        {typeof item.compliance.purificationRate === 'number'
                          ? `${t('compliance.purification')} ${formatPercent(
                              item.compliance.purificationRate,
                              locale,
                              1,
                            )}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={styles.price}>
                      {quote ? formatCurrency(quote.price, stock.currency, locale) : '—'}
                    </Text>
                    <Text
                      style={[
                        styles.change,
                        { color: positive ? colors.brand700 : colors.red600 },
                      ]}
                    >
                      {quote ? formatSignedPercent(quote.changePercent, locale) : ''}
                    </Text>
                    {stock.complianceStatus === 'halal' ? (
                      <Text style={styles.alertHint}>{t('dashboard.oneClick')}</Text>
                    ) : null}
                  </View>
                  {busy === stock.id ? (
                    <Text style={styles.busy}>…</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.note}>
          <Text style={styles.noteText}>{t('compliance.methodologyBody')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  title: { ...typography.display, color: colors.ink950 },
  subtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { ...typography.label, color: colors.ink500, textTransform: 'uppercase' },
  countHint: { ...typography.small, color: colors.ink300 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.lime, fontWeight: '800', fontSize: 10 },
  symbol: { ...typography.heading, color: colors.ink950 },
  name: { ...typography.small, color: colors.ink400, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  debt: { fontSize: 9, color: colors.ink300 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 14, fontWeight: '700', color: colors.ink950 },
  change: { fontSize: 11, fontWeight: '700' },
  alertHint: { fontSize: 9, color: colors.brand700, marginTop: 2, fontWeight: '700' },
  busy: { color: colors.brand700, fontWeight: '800' },
  note: {
    backgroundColor: colors.sand50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: { ...typography.small, color: colors.ink400, lineHeight: 18 },
});
