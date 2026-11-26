export const colors = {
  ink950: '#08140F',
  ink900: '#12211C',
  ink800: '#1F2F2A',
  ink700: '#30463F',
  ink600: '#405A51',
  ink500: '#587268',
  ink400: '#7B9389',
  ink300: '#A6B8B0',
  ink200: '#CCD6D1',
  ink100: '#E6EBE8',
  cream: '#FBFAF6',
  sand50: '#FBF8F1',
  sand100: '#F5EFDF',
  sand300: '#DDC79B',
  brand50: '#ECFDF5',
  brand100: '#D1FAE5',
  brand600: '#0D9488',
  brand700: '#0F766E',
  brand800: '#115E59',
  lime: '#C8F284',
  limeDeep: '#9EDB4F',
  amber50: '#FFFBEB',
  amber700: '#B45309',
  red50: '#FEF2F2',
  red600: '#DC2626',
  red700: '#B91C1C',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  small: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const },
  label: { fontSize: 10, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.8 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#08140F',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
};
