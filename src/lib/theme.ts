import { alpha, createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface PaletteColor {
    container: string;
    onContainer: string;
    onPrimary?: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
    onPrimary?: string;
  }
  interface Palette {
    surface: {
      main: string;
      onSurface: string;
      variant: string;
      onVariant: string;
    };
  }
  interface PaletteOptions {
    surface?: {
      main?: string;
      onSurface?: string;
      variant?: string;
      onVariant?: string;
    };
  }
}

// Semantic tokens. Everything visual derives from these two maps, so a mode
// switch is one lookup. Neutral grays for surfaces and text, one accent for
// primary actions, and green/amber/red only for status.
export const tokens = {
  light: {
    canvas: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceMuted: '#F3F4F6',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    text: '#111827',
    textMuted: '#6B7280',
    textSubtle: '#9CA3AF',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    accentSoft: '#EFF6FF',
    onAccentSoft: '#1E40AF',
    onAccent: '#FFFFFF',
    success: '#15803D',
    warning: '#B45309',
    error: '#B91C1C',
  },
  dark: {
    canvas: '#0B0D10',
    surface: '#14171B',
    surfaceMuted: '#1B1F24',
    border: '#262B31',
    borderStrong: '#363C44',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    textSubtle: '#6B7280',
    accent: '#60A5FA',
    accentHover: '#93C5FD',
    accentSoft: '#172554',
    onAccentSoft: '#BFDBFE',
    onAccent: '#0B0D10',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
  },
} as const;

export type Mode = keyof typeof tokens;

export const FONT_STACK = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Exposed as CSS variables (see index.css) for the few non-MUI styles.
export function cssVariables(mode: Mode) {
  return Object.fromEntries(Object.entries(tokens[mode]).map(([k, v]) => [`--dhq-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`, v]));
}

function createAppTheme(mode: Mode) {
  const t = tokens[mode];
  const base = createTheme({
    spacing: 8,
    // Legacy views use numeric sx radii (multiples of this), so it stays at 4.
    shape: { borderRadius: 4 },
    palette: {
      mode,
      primary: { main: t.accent, dark: t.accentHover, contrastText: t.onAccent, container: t.accentSoft, onContainer: t.onAccentSoft, onPrimary: t.onAccent },
      // Secondary stays neutral so there is only one accent.
      secondary: { main: t.textMuted, contrastText: t.surface, container: t.surfaceMuted, onContainer: t.text },
      success: { main: t.success, container: alpha(t.success, 0.1), onContainer: t.success },
      warning: { main: t.warning, container: alpha(t.warning, 0.1), onContainer: t.warning },
      error: { main: t.error, container: alpha(t.error, 0.1), onContainer: t.error },
      info: { main: t.accent, container: t.accentSoft, onContainer: t.onAccentSoft },
      background: { default: t.canvas, paper: t.surface },
      text: { primary: t.text, secondary: t.textMuted, disabled: t.textSubtle },
      divider: t.border,
      action: { hover: alpha(t.text, 0.04), selected: alpha(t.accent, 0.08), focus: alpha(t.accent, 0.12) },
      surface: { main: t.surface, onSurface: t.text, variant: t.surfaceMuted, onVariant: t.textMuted },
    },
    typography: {
      fontFamily: FONT_STACK,
      // Type scale: page title h4, section h6, body 14/16, labels 12.
      h1: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h2: { fontSize: '1.875rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h3: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h4: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 },
      h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35 },
      h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      subtitle1: { fontSize: '1rem', fontWeight: 500 },
      subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
      body1: { fontSize: '1rem', lineHeight: 1.5 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5 },
      caption: { fontSize: '0.75rem', lineHeight: 1.4 },
      overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 },
    },
  });

  // Flat UI: borders instead of shadows; only overlays get a soft shadow.
  const overlayShadow = mode === 'light' ? '0 8px 24px rgba(17, 24, 39, 0.08), 0 1px 2px rgba(17, 24, 39, 0.06)' : '0 8px 24px rgba(0, 0, 0, 0.5)';
  const shadows = base.shadows.map((s, i) => (i === 0 ? 'none' : i < 4 ? 'none' : overlayShadow)) as typeof base.shadows;

  return createTheme(base, {
    shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': cssVariables(mode),
          body: { backgroundColor: t.canvas, color: t.text, fontFeatureSettings: '"cv11", "ss01"' },
          '::selection': { backgroundColor: alpha(t.accent, 0.2) },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 6, padding: '6px 14px', minHeight: 36, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
          sizeSmall: { padding: '4px 10px', minHeight: 32, fontSize: '0.8125rem' },
          containedPrimary: { '&:hover': { backgroundColor: t.accentHover } },
          outlined: { borderColor: t.borderStrong, color: t.text, '&:hover': { backgroundColor: t.surfaceMuted, borderColor: t.borderStrong } },
          text: { color: t.text, '&:hover': { backgroundColor: t.surfaceMuted } },
          textPrimary: { color: t.accent },
          containedInherit: { backgroundColor: t.surfaceMuted },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 6, color: t.textMuted, '&:hover': { backgroundColor: t.surfaceMuted, color: t.text } } } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', backgroundColor: t.surface },
          outlined: { borderColor: t.border },
          rounded: { borderRadius: 8 },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 8, borderColor: t.border, boxShadow: 'none', backgroundImage: 'none' } },
      },
      MuiCardContent: { styleOverrides: { root: { padding: 16, '&:last-child': { paddingBottom: 16 } } } },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 10, border: `1px solid ${t.border}`, boxShadow: overlayShadow, backgroundImage: 'none' } },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.125rem', fontWeight: 600, padding: '20px 24px 8px' } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none', borderColor: t.border } } },
      MuiMenu: { styleOverrides: { paper: { border: `1px solid ${t.border}` } } },
      MuiPopover: { styleOverrides: { paper: { border: `1px solid ${t.border}` } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: t.text, color: t.surface, fontSize: '0.75rem' } } },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500 },
          sizeSmall: { height: 22, fontSize: '0.75rem' },
          outlined: { borderColor: t.border },
        },
      },
      MuiTableContainer: { styleOverrides: { root: { overflowX: 'auto' } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${t.border}`, fontVariantNumeric: 'tabular-nums' },
          head: { fontSize: '0.75rem', fontWeight: 600, color: t.textMuted, backgroundColor: t.surface, whiteSpace: 'nowrap' },
          sizeSmall: { padding: '8px 12px' },
        },
      },
      MuiTableRow: { styleOverrides: { root: { '&:last-child td': { borderBottom: 0 } } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 40 }, indicator: { height: 2, backgroundColor: t.accent } } },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 500, minHeight: 40, padding: '8px 12px', color: t.textMuted, '&.Mui-selected': { color: t.text } },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            backgroundColor: t.surface,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: t.borderStrong },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.textSubtle },
          },
        },
      },
      MuiFilledInput: { styleOverrides: { root: { borderRadius: 6, backgroundColor: t.surfaceMuted, '&:hover': { backgroundColor: t.surfaceMuted } } } },
      MuiInputLabel: { styleOverrides: { root: { fontSize: '0.875rem' } } },
      MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, marginRight: 2 } } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, alignItems: 'flex-start' },
          standardInfo: { backgroundColor: t.accentSoft, color: t.onAccentSoft },
          outlinedInfo: { borderColor: t.border, color: t.text },
        },
      },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4, backgroundColor: t.surfaceMuted } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            '&.Mui-selected': { backgroundColor: t.surfaceMuted, color: t.text, '&:hover': { backgroundColor: t.surfaceMuted } },
          },
        },
      },
      MuiToggleButton: { styleOverrides: { root: { textTransform: 'none', padding: '4px 12px', borderColor: t.border } } },
      MuiAvatar: { styleOverrides: { root: { fontSize: '0.875rem', fontWeight: 600 } } },
      MuiSkeleton: { styleOverrides: { root: { backgroundColor: t.surfaceMuted } } },
    },
  });
}

export const lightTheme = createAppTheme('light');
export const darkTheme = createAppTheme('dark');
