import { useCallback, useState } from 'react';

import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@hse/shared';

import { StockCard } from '@/components/StockCard';
import { Button, Card, EmptyState, LoadingView, Pill, Screen, SectionTitle } from '@/components/ui';
import { createPriceAlert, fetchAlerts, fetchEntitlements, fetchPortfolio, fetchTopStocks, fetchUnreadCount, type MobileEntitlements, type MobilePortfolio } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, radius, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const { profile, isDemo, loading: authLoading } = useAuth();
  const { t, locale, isRtl } = useI18n();

  const [top, setTop] = useState<Awaited<ReturnType<typeof fetchTopStocks>>>([]);
  const [portfolio, setPortfolio] = useState<MobilePortfolio | null>(null);
  const [entitlements, setEntitlements] = useState<MobileEntitlements | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyStock, setBusyStock] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const stocks = await fetchTopStocks(6);
        setTop(stocks);
        if (profile) {
          const [alerts, portfolioData, entitlementData, unreadCount] = await Promise.all([
            fetchAlerts(profile.id),
            fetchPortfolio(profile.id),
            fetchEntitlements(profile.id),
            fetchUnreadCount(profile.id),
          ]);
          setAlertCount(alerts.filter((alert) => alert.status === 'active').length);
          setPortfolio(portfolioData);
          setEntitlements(entitlementData);
          setUnread(unreadCount);
        }
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

  const handleOneClick = useCallback(
    async (stockId: string, symbol: string) => {
      if (!profile || isDemo) {
        Alert.alert(t('admin.demoReadOnly'));
        return;
      }
      setBusyStock(stockId);
      try {
        const created = await createPriceAlert({ userId: profile.id, stockId });
        setAlertCount((count) => count + 1);
        Alert.alert(
          t('alerts.created'),
          t('alerts.messages.price', {
            symbol,
            price: created.currentPrice ?? 0,
            direction: t('alerts.operators.above'),
            target: created.targetPrice ?? 0,
          }),
        );
      } catch (error) {
        const code = error instanceof Error ? error.message : 'create_failed';
        const message =
          code === 'alert_limit'
            ? t('alerts.limitReached', { limit: entitlements?.limits.maxAlerts ?? 3 })
            : code === 'compliance_gate'
              ? t('errors.complianceGate')
              : t('errors.generic');
        Alert.alert(t('errors.generic'), message);
      } finally {
        setBusyStock(null);
      }
    },
    [profile, isDemo, entitlements, t],
  );

  if (authLoading || loading) {
    return (
      <Screen>
        <LoadingView label={t('common.loading')} />
      </Screen>
    );
  }

  const firstName = profile?.fullName?.split(' ')[0] ?? profile?.email?.split('@')[0] ?? '';
  const planLabel = (entitlements?.planId ?? 'free').toUpperCase();

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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={{ flex: 1, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
            <Text style={[styles.greeting, { textAlign: isRtl ? 'right' : 'left' }]}>
              {t('dashboard.greeting')}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={[styles.subtitle, { textAlign: isRtl ? 'right' : 'left' }]}>
              {t('dashboard.subtitle')}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.fullName ?? profile?.email ?? '?').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>

        {isDemo ? (
          <View style={styles.demoBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.amber700} />
            <Text style={styles.demoText}>{t('dashboard.demoBanner')}</Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{t('dashboard.topHalalTitle')}</Text>
            <Pill label={isDemo ? t('common.demo') : planLabel} tone="halal" />
          </View>
          <Text style={styles.heroValue}>
            {formatCurrency(portfolio?.marketValue ?? 0, 'USD', locale)}
          </Text>
          <Text style={styles.heroSub}>{t('dashboard.portfolioValue')}</Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{alertCount}</Text>
              <Text style={styles.heroStatLabel}>{t('dashboard.alertsTitle')}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{unread}</Text>
              <Text style={styles.heroStatLabel}>{t('dashboard.unread')}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {top.length > 0
                  ? Math.round(
                      top.reduce((sum, item) => sum + (item.compliance.score ?? 0), 0) / top.length,
                    )
                  : 0}
              </Text>
              <Text style={styles.heroStatLabel}>{t('dashboard.score')}</Text>
            </View>
          </View>

          {!profile ? (
            <Button
              label={t('nav.login')}
              onPress={() => router.push('/login')}
              variant="lime"
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle
            title={t('dashboard.topHalalTitle')}
            subtitle={t('dashboard.topHalalSubtitle')}
            action={
              <Pill
                label={t('dashboard.viewScreener')}
                onPress={() => router.push('/screener')}
              />
            }
          />
          {top.length === 0 ? (
            <EmptyState title={t('dashboard.empty')} description={t('screener.empty')} />
          ) : (
            <View style={{ gap: spacing.md }}>
              {top.map((item) => (
                <StockCard
                  key={item.stock.id}
                  item={item}
                  locale={locale}
                  busy={busyStock === item.stock.id}
                  onAlert={() => handleOneClick(item.stock.id, item.stock.symbol)}
                  onOpen={() => router.push('/screener')}
                />
              ))}
            </View>
          )}
        </View>

        {entitlements?.tier === 'free' ? (
          <Card style={styles.upgrade}>
            <Text style={styles.upgradeTitle}>{t('dashboard.upgradeCta')}</Text>
            <Text style={styles.upgradeBody}>{t('dashboard.upgradeBody')}</Text>
            <Button
              label={t('settings.upgrade')}
              onPress={() => router.push('/settings')}
              variant="lime"
              size="sm"
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            />
          </Card>
        ) : null}

        <Text style={styles.footer}>{t('landing.disclaimer')}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { ...typography.title, color: colors.ink950 },
  subtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  demoText: { ...typography.small, color: colors.amber700, flex: 1 },
  hero: {
    backgroundColor: colors.ink950,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: {
    ...typography.label,
    color: colors.lime,
    textTransform: 'uppercase',
    flex: 1,
  },
  heroValue: { fontSize: 34, fontWeight: '800', color: colors.cream, marginTop: spacing.md, letterSpacing: -1 },
  heroSub: { ...typography.small, color: 'rgba(251,248,241,0.5)' },
  heroStats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  heroStat: { flex: 1 },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: colors.cream },
  heroStatLabel: {
    fontSize: 9,
    color: 'rgba(251,248,241,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  section: { gap: spacing.sm },
  upgrade: { backgroundColor: colors.sand50, borderColor: colors.sand300 },
  upgradeTitle: { ...typography.heading, color: colors.ink950 },
  upgradeBody: { ...typography.small, color: colors.ink500, marginTop: 2 },
  footer: { ...typography.small, color: colors.ink300, textAlign: 'center', paddingHorizontal: spacing.lg },
});
