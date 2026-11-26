import { StyleSheet, Text, View } from 'react-native';

import {
  formatCurrency,
  formatPercent,
  formatSignedPercent,
  localizedStockName,
  type ComplianceStatus,
  type Locale,
  type TopStock,
} from '@hse/shared';

import { colors, radius, spacing, typography } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Button, Card, Streak } from '@/components/ui';

const complianceColors: Record<ComplianceStatus, { bg: string; text: string }> = {
  halal: { bg: colors.brand50, text: colors.brand800 },
  questionable: { bg: colors.amber50, text: colors.amber700 },
  haram: { bg: colors.red50, text: colors.red700 },
  unknown: { bg: colors.ink100, text: colors.ink600 },
};

export function ComplianceBadge({ status, label }: { status: ComplianceStatus; label: string }) {
  const tone = complianceColors[status] ?? complianceColors.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.text }]} />
      <Text style={[styles.badgeLabel, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

export function SparkBars({ seed, positive }: { seed: string; positive: boolean }) {
  let hash = 5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 19 + seed.charCodeAt(index)) % 1013;
  }
  const bars = Array.from({ length: 16 }, (_, index) => {
    const wave = Math.abs(Math.sin((index + (hash % 9)) * 0.8));
    const trend = positive ? index * 0.03 : (16 - index) * 0.03;
    return Math.min(1, Math.max(0.18, wave * 0.6 + trend));
  });

  return (
    <View style={styles.sparkRow} accessibilityElementsHidden>
      {bars.map((value, index) => (
        <View
          key={`${seed}-${index}`}
          style={[
            styles.sparkBar,
            {
              height: 8 + value * 26,
              backgroundColor: positive ? colors.brand600 : colors.red600,
              opacity: 0.35 + value * 0.5,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function StockCard({
  item,
  locale,
  onAlert,
  onOpen,
  busy,
}: {
  item: TopStock;
  locale: Locale;
  onAlert: () => void;
  onOpen?: () => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const { stock, quote, compliance } = item;
  const name = localizedStockName(stock, locale);
  const positive = (quote?.changePercent ?? 0) >= 0;
  const score = Math.round(compliance.score ?? 0);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{stock.symbol.slice(0, 2)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{stock.symbol}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>
        <ComplianceBadge
          status={compliance.status}
          label={t(`compliance.status.${compliance.status}`)}
        />
      </View>

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.price}>
            {quote ? formatCurrency(quote.price, stock.currency, locale) : '—'}
          </Text>
          <View style={styles.changeRow}>
            {quote ? (
              <>
                <Streak positive={positive} />
                <Text
                  style={[
                    styles.change,
                    { color: positive ? colors.brand700 : colors.red600 },
                  ]}
                >
                  {formatSignedPercent(quote.changePercent, locale)}
                </Text>
              </>
            ) : null}
            <Text style={styles.exchange}>{stock.exchange}</Text>
          </View>
        </View>

        <View style={styles.scoreBox}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreLabel}>{t('dashboard.score')}</Text>
        </View>
      </View>

      <SparkBars seed={stock.symbol} positive={positive} />

      <View style={styles.footer}>
        <View>
          <Text style={styles.purificationLabel}>{t('compliance.purification')}</Text>
          <Text style={styles.purificationValue}>
            {formatPercent(compliance.purificationRate ?? 0, locale, 1)}
          </Text>
        </View>
        <View style={styles.footerActions}>
          {onOpen ? (
            <Button label={t('common.learnMore')} onPress={onOpen} variant="ghost" size="sm" />
          ) : null}
          <Button
            label={t('dashboard.oneClick')}
            onPress={onAlert}
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={compliance.status !== 'halal'}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.ink900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.lime, fontWeight: '800', fontSize: 12 },
  symbol: { ...typography.heading, color: colors.ink950 },
  name: { ...typography.small, color: colors.ink400, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg },
  price: { fontSize: 26, fontWeight: '700', color: colors.ink950, letterSpacing: -0.6 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  change: { fontSize: 12, fontWeight: '700' },
  exchange: { fontSize: 10, color: colors.ink400, marginStart: 4 },
  scoreBox: { alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 20, fontWeight: '800', color: colors.brand700 },
  scoreLabel: { fontSize: 9, color: colors.ink400, textTransform: 'uppercase', letterSpacing: 0.5 },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 36,
    marginTop: spacing.sm,
  },
  sparkBar: { flex: 1, borderRadius: 2 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink100,
  },
  purificationLabel: { fontSize: 9, color: colors.ink400, textTransform: 'uppercase', letterSpacing: 0.5 },
  purificationValue: { fontSize: 12, fontWeight: '700', color: colors.ink700 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
