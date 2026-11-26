import type { ReactNode } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, typography } from '@/theme';
import { useI18n } from '@/lib/i18n';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        variant === 'primary' && { backgroundColor: colors.brand700 },
        variant === 'secondary' && { backgroundColor: colors.ink900 },
        variant === 'outline' && {
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.ink200,
        },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        variant === 'lime' && { backgroundColor: colors.lime },
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'lime' || variant === 'outline' ? colors.ink900 : colors.white}
        />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonLabel,
          size === 'sm' && { fontSize: 12 },
          size === 'lg' && { fontSize: 15 },
          (variant === 'lime' || variant === 'outline' || variant === 'ghost') && {
            color: colors.ink900,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  const { isRtl } = useI18n();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.ink300}
        style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }, style]}
        {...rest}
      />
    </View>
  );
}

export function Pill({
  label,
  active = false,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'halal' | 'warning' | 'danger';
}) {
  const background =
    tone === 'halal'
      ? colors.brand50
      : tone === 'warning'
        ? colors.amber50
        : tone === 'danger'
          ? colors.red50
          : active
            ? colors.ink900
            : colors.white;
  const textColor =
    tone === 'halal'
      ? colors.brand800
      : tone === 'warning'
        ? colors.amber700
        : tone === 'danger'
          ? colors.red700
          : active
            ? colors.cream
            : colors.ink600;

  const content = (
    <View style={[styles.pill, { backgroundColor: background, borderColor: active ? colors.ink900 : colors.ink200 }]}>
      <Text style={[styles.pillLabel, { color: textColor }]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyBody}>{description}</Text> : null}
      {action}
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand700} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.ink100 }} />;
}

export function Streak({ positive }: { positive: boolean }) {
  return (
    <View
      style={[
        styles.streak,
        { backgroundColor: positive ? colors.brand50 : colors.red50 },
      ]}
    >
      <Text style={{ color: positive ? colors.brand700 : colors.red600, fontSize: 11, fontWeight: '700' }}>
        {positive ? '▲' : '▼'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.title, color: colors.ink950 },
  sectionSubtitle: { ...typography.small, color: colors.ink400, marginTop: 2 },
  button: {
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonSm: { minHeight: 36, paddingHorizontal: spacing.lg },
  buttonLg: { minHeight: 54, paddingHorizontal: spacing.xxl },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: '700' },
  label: {
    ...typography.label,
    color: colors.ink500,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink900,
    backgroundColor: colors.white,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  pillLabel: { fontSize: 11, fontWeight: '700' },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.ink200,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.sand50,
  },
  emptyTitle: { ...typography.heading, color: colors.ink800, textAlign: 'center' },
  emptyBody: { ...typography.small, color: colors.ink500, textAlign: 'center' },
  loading: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  loadingLabel: { ...typography.small, color: colors.ink400 },
  streak: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
