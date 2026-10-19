import { createTheme, ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface PaletteColor {
    container: string;
    onContainer: string;
  }
  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
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

// Premium Agency Color Palette (Perplexity Inspired)
const lightPalette = {
  primary: {
    main: '#000000', // Pure black
    onPrimary: '#FFFFFF',
    container: '#F3F4F6',
    onContainer: '#111827',
  },
  secondary: {
    main: '#0D9488', // Teal
    onSecondary: '#FFFFFF',
    container: '#CCFBF1',
    onContainer: '#115E59',
  },
  tertiary: {
    main: '#2563EB', // Blue
    onTertiary: '#FFFFFF',
    container: '#DBEAFE',
    onContainer: '#1E3A8A',
  },
  error: {
    main: '#DC2626',
    onSecondary: '#FFFFFF',
    container: '#FEE2E2',
    onContainer: '#991B1B',
  },
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
  },
  surface: {
    main: '#FFFFFF',
    onSurface: '#111827',
    variant: '#F9FAFB',
    onVariant: '#4B5563',
  },
  outline: '#E5E7EB',
};

const darkPalette = {
  primary: {
    main: '#FFFFFF',
    onPrimary: '#000000',
    container: '#1F2937',
    onContainer: '#F9FAFB',
  },
  secondary: {
    main: '#2DD4BF', // Teal light
    onSecondary: '#042F2E',
    container: '#115E59',
    onContainer: '#CCFBF1',
  },
  tertiary: {
    main: '#60A5FA', // Blue light
    onTertiary: '#1E3A8A',
    container: '#1E3A8A',
    onContainer: '#DBEAFE',
  },
  error: {
    main: '#F87171',
    onSecondary: '#450A0A',
    container: '#991B1B',
    onContainer: '#FECACA',
  },
  background: {
    default: '#0A0A0A', // Very dark
    paper: '#0A0A0A',
  },
  surface: {
    main: '#171717',
    onSurface: '#F9FAFB',
    variant: '#1F2937',
    onVariant: '#9CA3AF',
  },
  outline: '#262626',
};

const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? lightPalette.primary.main : darkPalette.primary.main,
      container: mode === 'light' ? lightPalette.primary.container : darkPalette.primary.container,
      onContainer: mode === 'light' ? lightPalette.primary.onContainer : darkPalette.primary.onContainer,
    },
    secondary: {
      main: mode === 'light' ? lightPalette.secondary.main : darkPalette.secondary.main,
      container: mode === 'light' ? lightPalette.secondary.container : darkPalette.secondary.container,
      onContainer: mode === 'light' ? lightPalette.secondary.onContainer : darkPalette.secondary.onContainer,
    },
    error: {
      main: mode === 'light' ? lightPalette.error.main : darkPalette.error.main,
      container: mode === 'light' ? lightPalette.error.container : darkPalette.error.container,
      onContainer: mode === 'light' ? lightPalette.error.onContainer : darkPalette.error.onContainer,
    },
    background: {
      default: mode === 'light' ? lightPalette.background.default : darkPalette.background.default,
      paper: mode === 'light' ? lightPalette.background.paper : darkPalette.background.paper,
    },
    text: {
      primary: mode === 'light' ? '#111827' : '#F9FAFB',
      secondary: mode === 'light' ? '#6B7280' : '#9CA3AF',
    },
    divider: mode === 'light' ? lightPalette.outline : darkPalette.outline,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Outfit", sans-serif', fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em' },
    h2: { fontFamily: '"Outfit", sans-serif', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em' },
    h3: { fontFamily: '"Outfit", sans-serif', fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontFamily: '"Outfit", sans-serif', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontFamily: '"Outfit", sans-serif', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontFamily: '"Outfit", sans-serif', fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 500 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
    button: { fontFamily: '"Outfit", sans-serif', textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 100, // Pill shape
          padding: '8px 20px',
          boxShadow: 'none',
          textTransform: 'none',
          fontWeight: 600,
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          backgroundColor: mode === 'light' ? '#000000' : '#FFFFFF',
          color: mode === 'light' ? '#FFFFFF' : '#000000',
          '&:hover': {
            backgroundColor: mode === 'light' ? '#374151' : '#E5E7EB',
          },
        },
        outlined: {
          borderColor: mode === 'light' ? '#E5E7EB' : '#262626',
          color: mode === 'light' ? '#111827' : '#F9FAFB',
          '&:hover': {
            backgroundColor: mode === 'light' ? '#F3F4F6' : '#1F2937',
            borderColor: mode === 'light' ? '#D1D5DB' : '#374151',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          padding: '16px',
          backgroundImage: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#171717',
          border: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
          boxShadow: mode === 'light' 
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' 
            : '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#171717',
          boxShadow: 'none',
          border: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
          transition: 'border-color 0.2s ease-in-out',
          '&:hover': {
            borderColor: mode === 'light' ? '#D1D5DB' : '#374151',
          }
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#171717',
        },
        elevation1: {
          boxShadow: 'none',
          border: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
        },
        outlined: {
          border: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
        }
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 100,
          border: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(10, 10, 10, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
          boxShadow: 'none',
          color: mode === 'light' ? '#111827' : '#F9FAFB',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: mode === 'light' ? '1px solid #E5E7EB' : '1px solid #262626',
          backgroundColor: mode === 'light' ? '#FAFAFA' : '#0A0A0A',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
          '& .MuiFilledInput-root': {
            borderRadius: 12,
            backgroundColor: mode === 'light' ? '#F1F5F9' : '#1E293B',
            '&:before, &:after': {
              display: 'none',
            },
            '&:hover': {
              backgroundColor: mode === 'light' ? '#E2E8F0' : '#334155',
            },
            '&.Mui-focused': {
              backgroundColor: mode === 'light' ? '#FFFFFF' : '#0F172A',
              boxShadow: mode === 'light' ? '0 0 0 2px #0F172A' : '0 0 0 2px #FFFFFF',
            }
          },
        },
      },
    },
  },
});

export const lightTheme = createTheme(getThemeOptions('light'));
export const darkTheme = createTheme(getThemeOptions('dark'));
