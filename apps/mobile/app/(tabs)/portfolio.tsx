import { useCallback, useState } from 'react';

import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  formatCurrency,
  formatSignedPercent,
  type TopStock,
} from '@hse/shared';

import { ComplianceBadge } from '@/components/StockCard';
import { Button, Card, EmptyState, Input, LoadingView, Screen, SectionTitle } from '@/components/ui';
import { addHolding, createPortfolio, fetchPortfolio, fetchTopStocks, type MobilePortfolio } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, radius, spacing, typography } from '@/theme';

export default function PortfolioScreen() {
  const { profile, isDemo } = useAuth();
  const { t, locale } = useI18n();

  const [portfolio, setPortfolio] = useState<MobilePortfolio | null>(null);
  const [stocks, setStocks] = useState<TopStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!profile) {
        setLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      try {
        const [portfolioData, stockRows] = await Promise.all([
          fetchPortfolio(profile.id),
          fetchTopStocks(30),
        ]);
        setPortfolio(portfolioData);
        setStocks(stockRows);
        setSelectedStock((current) => current ?? stockRows[0]?.stock.id ?? null);
      } catch {
        Alert.alert(t('errors.generic'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleCreatePortfolio() {
    if (!profile || isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    if (!portfolioName.trim()) return;
    setBusy(true);
    try {
      await createPortfolio(profile.id, portfolioName.trim());
      setPortfolioName('');
      await load();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddHolding() {
    if (!profile || isDemo) {
      Alert.alert(t('admin.demoReadOnly'));
      return;
    }
    if (!portfolio || !selectedStock) return;
    const shareCount = Number(shares);
    const averageCost = Number(cost);
    if (!Number.isFinite(shareCount) || shareCount <= 0 || !Number.isFinite(averageCost)) {
      Alert.alert(t('errors.validation'), t('portfolio.shares'));
      return;
    }
    setBusy(true);
    try {
      await addHolding({
        portfolioId: portfolio.id,
        stockId: selectedStock,
        shares: shareCount,
        averageCost,
      });
      setShares('');
      setCost('');
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'create_failed';
      Alert.alert(
        t('errors.generic'),
        code === 'duplicate'
          ? t('errors.validation')
          : code === 'holding_limit'
            ? t('portfolio.limitReached')
            : t('errors.generic'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!profile && !isDemo) {
    return (
      <Screen>
        <View style={styles.center}>
          <EmptyState title={t('errors.unauthorized')} description={t('auth.loginSubtitle')} />
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

  const totalWeight = portfolio?.marketValue ?? 0;
  const positive = (portfolio?.unrealizedPnl ?? 0) >= 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.brand700}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.title}>{t('portfolio.title')}</Text>
          <Text style={styles.subtitle}>{t('portfolio.subtitle')}</Text>
        </View>

        {!portfolio ? (
          <Card>
            <Text style={styles.cardTitle}>{t('portfolio.newPortfolio')}</Text>
            <Input
              label={t('portfolio.portfolioName')}
              value={portfolioName}
              onChangeText={setPortfolioName}
              placeholder="Long-term halal"
            />
            <Button
              label={t('portfolio.newPortfolio')}
              onPress={handleCreatePortfolio}
              loading={busy}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>{portfolio.name}</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(portfolio.marketValue, portfolio.baseCurrency, locale)}
              </Text>
              <View style={styles.heroBottom}>
                <Text
                  style={[
                    styles.heroPnl,
                    { color: positive ? colors.lime : '#FCA5A5' },
                  ]}
                >
                  {formatSignedPercent(
                    portfolio.costBasis > 0
                      ? portfolio.unrealizedPnl / portfolio.costBasis
                      : 0,
                    locale,
                    1,
                  )}{' '}
                  · {formatCurrency(portfolio.unrealizedPnl, portfolio.baseCurrency, locale)}
                </Text>
                <Text style={styles.heroMeta}>
                  {portfolio.positions.length} {t('portfolio.holdings')}
                </Text>
              </View>
            </View>

            {portfolio.nonCompliantValue > 0 ? (
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  {t('portfolio.nonCompliantWarning', {
                    count: portfolio.positions.filter(
                      (position) => position.complianceStatus !== 'halal',
                    ).length,
                  })}
                </Text>
              </View>
            ) : null}

            <Card>
              <SectionTitle title={t('portfolio.holdings')} />
              {portfolio.positions.length === 0 ? (
                <EmptyState title={t('portfolio.empty')} description={t('portfolio.addTitle')} />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {portfolio.positions.map((position) => {
                    const compliant = position.complianceStatus === 'halal';
                    return (
                      <View key={position.id}>
                        <View style={styles.positionRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.positionSymbol}>{position.symbol}</Text>
                            <Text style={styles.positionName} numberOfLines={1}>
                              {position.name}
                            </Text>
                            <ComplianceBadge
                              status={position.complianceStatus}
                              label={t(`compliance.status.${position.complianceStatus}`)}
                            />
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.positionValue}>
                              {formatCurrency(
                                position.marketValue,
                                portfolio.baseCurrency,
                                locale,
                              )}
                            </Text>
                            <Text
                              style={[
                                styles.positionPnl,
                                {
                                  color:
                                    position.unrealizedPnl >= 0
                                      ? colors.brand700
                                      : colors.red600,
                                },
                              ]}
                            >
                              {formatCurrency(
                                position.unrealizedPnl,
                                portfolio.baseCurrency,
                                locale,
                              )}
                            </Text>
                            <Text style={styles.positionShares}>
                              {position.shares} @{' '}
                              {formatCurrency(
                                position.averageCost,
                                portfolio.baseCurrency,
                                locale,
                              )}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.weightTrack}>
                          <View
                            style={[
                              styles.weightFill,
                              {
                                width: `${
                                  totalWeight > 0
                                    ? Math.min(100, (position.marketValue / totalWeight) * 100)
                                    : 0
                                }%`,
                                backgroundColor: compliant ? colors.brand600 : colors.red600,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            <Card>
              <SectionTitle title={t('portfolio.addTitle')} />
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
                        styles.stockChipText,
                        selectedStock === item.stock.id && { color: colors.cream },
                      ]}
                    >
                      {item.stock.symbol}
                    </Text>
                    {item.compliance?.score ? (
                      <Text
                        style={[
                          styles.stockChipScore,
                          selectedStock === item.stock.id && { color: colors.lime },
                        ]}
                      >
                        {Math.round(item.compliance.score)}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.inlineInputs}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t('portfolio.shares')}
                    value={shares}
                    onChangeText={setShares}
                    keyboardType="decimal-pad"
                    placeholder="10"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t('portfolio.averageCost')}
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="decimal-pad"
                    placeholder="205.00"
                  />
                </View>
              </View>

              <Button
                label={t('portfolio.addHolding')}
                onPress={handleAddHolding}
                loading={busy}
                style={{ marginTop: spacing.md }}
              />
            </Card>

            <View style={styles.purification}>
              <Text style={styles.purificationLabel}>{t('compliance.purification')}</Text>
              <Text style={styles.purificationBody}>{t('compliance.purificationHint')}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.display, color: colors.ink950 },
  subtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  cardTitle: { ...typography.heading, color: colors.ink950, marginBottom: spacing.sm },
  hero: { backgroundColor: colors.ink950, borderRadius: radius.xl, padding: spacing.xl },
  heroLabel: { ...typography.label, color: colors.lime, textTransform: 'uppercase' },
  heroValue: { fontSize: 32, fontWeight: '800', color: colors.cream, marginTop: spacing.sm, letterSpacing: -0.8 },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: spacing.md,
  },
  heroPnl: { fontSize: 12, fontWeight: '700' },
  heroMeta: { fontSize: 10, color: 'rgba(251,248,241,0.45)' },
  warning: {
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { ...typography.small, color: colors.amber700 },
  positionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  positionSymbol: { ...typography.heading, color: colors.ink950 },
  positionName: { ...typography.small, color: colors.ink400, marginBottom: 4 },
  positionValue: { fontSize: 14, fontWeight: '700', color: colors.ink950 },
  positionPnl: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  positionShares: { fontSize: 9, color: colors.ink400, marginTop: 2 },
  weightTrack: { height: 4, backgroundColor: colors.ink100, borderRadius: 2, marginTop: spacing.sm },
  weightFill: { height: 4, borderRadius: 2 },
  stockPicker: { gap: spacing.sm, paddingVertical: spacing.xs },
  stockChip: {
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    minWidth: 66,
    alignItems: 'center',
  },
  stockChipActive: { backgroundColor: colors.ink900, borderColor: colors.ink900 },
  stockChipText: { fontSize: 12, fontWeight: '800', color: colors.ink900 },
  stockChipScore: { fontSize: 9, color: colors.ink400, marginTop: 2 },
  inlineInputs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  purification: {
    backgroundColor: colors.sand50,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  purificationLabel: { ...typography.label, color: colors.ink500, textTransform: 'uppercase' },
  purificationBody: { ...typography.small, color: colors.ink400, marginTop: 4, lineHeight: 18 },
});
