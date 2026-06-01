import { createTheme } from '@mui/material/styles';

const ACCENT = '#FF6020';
const TRANS  = 'all 0.22s cubic-bezier(0.4,0,0.2,1)';

// ─── Radius tokens ────────────────────────────────────────────────────────────
const R = { xs: 6, sm: 8, md: 12, lg: 16 };

const getAppTheme = (mode) => {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary:   { main: ACCENT, contrastText: '#fff' },
      secondary: { main: '#10B981' },
      error:     { main: '#EF4444' },
      warning:   { main: '#F59E0B' },
      success:   { main: '#10B981' },
      info:      { main: '#3B82F6' },
      background: {
        default: dark ? '#0d1117' : '#F4F6F9',
        paper:   dark ? '#161b22' : '#FFFFFF',
      },
      text: {
        primary:   dark ? '#f1f5f9' : '#111827',
        secondary: dark ? '#94a3b8' : '#6B7280',
        disabled:  dark ? '#475569' : '#9CA3AF',
      },
      divider: dark ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
    },

    typography: {
      fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 14,
      h1: { fontWeight: 800, lineHeight: 1.2 },
      h2: { fontWeight: 800, lineHeight: 1.25 },
      h3: { fontWeight: 700, lineHeight: 1.3 },
      h4: { fontWeight: 700, lineHeight: 1.35 },
      h5: { fontWeight: 600, lineHeight: 1.4 },
      h6: { fontWeight: 600, lineHeight: 1.4 },
      subtitle1: { fontWeight: 600, fontSize: '0.9375rem' },
      subtitle2: { fontWeight: 600, fontSize: '0.8125rem' },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem',  lineHeight: 1.55 },
      caption: { fontSize: '0.75rem', lineHeight: 1.5 },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
    },

    shape: { borderRadius: R.sm },

    components: {
      // ── CSS Baseline (global resets + scrollbar + mobile) ─────────────────
      MuiCssBaseline: {
        styleOverrides: `
          *, *::before, *::after { box-sizing: border-box; }
          html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
          body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}; border-radius: 99px; }
          ::-webkit-scrollbar-thumb:hover { background: ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}; }
          img, svg { display: block; max-width: 100%; }
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          @media (max-width: 600px) {
            html { font-size: 15px; }
          }
        `,
      },

      // ── Paper ──────────────────────────────────────────────────────────────
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: dark
              ? '0 1px 4px rgba(0,0,0,0.45)'
              : '0 1px 4px rgba(0,0,0,0.06)',
            borderRadius: R.md,
          }),
        },
      },

      // ── Card ───────────────────────────────────────────────────────────────
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.06)',
            borderRadius: R.md,
          }),
        },
      },

      // ── Button ─────────────────────────────────────────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: R.sm,
            fontWeight: 600,
            fontSize: 13.5,
            textTransform: 'none',
            padding: '7px 18px',
            transition: TRANS,
            minHeight: 36,
          },
          sizeSmall: { padding: '4px 12px', fontSize: 12.5, minHeight: 30 },
          sizeLarge: { padding: '10px 24px', fontSize: 15 },
          containedPrimary: {
            background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a62 100%)`,
            boxShadow: `0 4px 14px rgba(255,96,32,0.3)`,
            '&:hover': {
              background: `linear-gradient(135deg, #e5521a 0%, ${ACCENT} 100%)`,
              boxShadow: `0 4px 18px rgba(255,96,32,0.4)`,
            },
          },
          outlinedPrimary: {
            borderColor: `${ACCENT}60`,
            '&:hover': { borderColor: ACCENT, backgroundColor: `${ACCENT}08` },
          },
        },
      },

      // ── IconButton ─────────────────────────────────────────────────────────
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: R.xs,
            transition: TRANS,
            '&:hover': { backgroundColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' },
          },
          sizeSmall: { padding: 6, minWidth: 30, minHeight: 30 },
          sizeMedium: { padding: 8, minWidth: 36, minHeight: 36 },
        },
      },

      // ── TextField ──────────────────────────────────────────────────────────
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiOutlinedInput-root': {
              borderRadius: R.sm,
              fontSize: 13.5,
              backgroundColor: dark ? 'rgba(255,255,255,0.04)' : '#fff',
              transition: TRANS,
              '& fieldset': { borderColor: theme.palette.divider, transition: TRANS },
              '&:hover fieldset': { borderColor: ACCENT },
              '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1.5 },
              '&.Mui-disabled': { opacity: 0.6 },
            },
            '& .MuiInputLabel-root': { fontSize: 13.5 },
            '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
            '& .MuiFormHelperText-root': { fontSize: 11.5, marginTop: 3 },
          }),
        },
      },

      // ── Select (standalone) ────────────────────────────────────────────────
      MuiSelect: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: {
            borderRadius: R.sm,
            fontSize: 13.5,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: R.sm,
            fontSize: 13.5,
            '& fieldset': { borderColor: theme.palette.divider },
            '&:hover fieldset': { borderColor: ACCENT },
            '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: 1.5 },
          }),
        },
      },

      // ── Autocomplete ───────────────────────────────────────────────────────
      MuiAutocomplete: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: R.md,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            marginTop: 4,
          }),
          listbox: {
            padding: '4px 0',
            '& .MuiAutocomplete-option': {
              fontSize: 13.5,
              padding: '8px 12px',
              borderRadius: R.xs,
              margin: '1px 4px',
              '&[aria-selected="true"]': { backgroundColor: `${ACCENT}14` },
              '&.Mui-focused': { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            },
          },
          noOptions: { fontSize: 13, padding: '12px 16px', color: 'text.secondary' },
        },
      },

      // ── Table ──────────────────────────────────────────────────────────────
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableCell-root': {
              backgroundColor: dark ? '#1e2a3a' : '#F8FAFC',
              color: theme.palette.text.secondary,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              borderBottom: `2px solid ${theme.palette.divider}`,
              padding: '10px 14px',
              whiteSpace: 'nowrap',
            },
          }),
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableRow-root': {
              transition: 'background-color 0.15s',
              '&:hover': {
                backgroundColor: dark ? 'rgba(255,255,255,0.03)' : `${ACCENT}04`,
              },
              '&:last-child td': { borderBottom: 'none' },
            },
            '& .MuiTableCell-root': {
              fontSize: 13.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
              padding: '9px 14px',
            },
          }),
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: { borderRadius: R.md, overflow: 'hidden' },
        },
      },

      // ── Chip ───────────────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: R.xs,
            fontWeight: 600,
            fontSize: 12,
            height: 26,
          },
          sizeSmall: { height: 20, fontSize: 10.5 },
        },
      },

      // ── Dialog ─────────────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: R.lg,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: dark
              ? '0 24px 80px rgba(0,0,0,0.6)'
              : '0 24px 60px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            margin: 16,
            maxHeight: 'calc(100% - 32px)',
          }),
          paperFullScreen: { margin: 0, maxHeight: '100%', borderRadius: 0 },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: ({ theme }) => ({
            fontSize: 16,
            fontWeight: 700,
            padding: '16px 20px 14px',
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }),
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '20px', '&:first-of-type': { paddingTop: 20 } },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: '12px 20px',
            gap: 8,
            borderTop: `1px solid ${theme.palette.divider}`,
            '& .MuiButton-root': { minWidth: 80 },
          }),
        },
      },

      // ── Menu ───────────────────────────────────────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: R.md,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            minWidth: 160,
          }),
          list: { padding: '4px 0' },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: 13.5,
            borderRadius: R.xs,
            margin: '1px 4px',
            padding: '8px 12px',
            transition: TRANS,
            '&:hover': { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            '&.Mui-selected': { backgroundColor: `${ACCENT}14`, fontWeight: 600 },
          },
        },
      },

      // ── Tabs ───────────────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: 13.5,
            textTransform: 'none',
            minHeight: 44,
            padding: '8px 16px',
            '&.Mui-selected': { color: ACCENT },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: ACCENT, height: 3, borderRadius: '3px 3px 0 0' },
          root: { minHeight: 44 },
        },
      },

      // ── Alert ──────────────────────────────────────────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: R.sm,
            fontSize: 13.5,
            alignItems: 'center',
          },
          standardSuccess: { backgroundColor: dark ? '#052e16' : '#f0fdf4', color: dark ? '#86efac' : '#166534' },
          standardError:   { backgroundColor: dark ? '#2d0a0a' : '#fef2f2', color: dark ? '#fca5a5' : '#991b1b' },
          standardWarning: { backgroundColor: dark ? '#2d1900' : '#fffbeb', color: dark ? '#fcd34d' : '#92400e' },
          standardInfo:    { backgroundColor: dark ? '#0c1a2d' : '#eff6ff', color: dark ? '#93c5fd' : '#1e40af' },
        },
      },

      // ── LinearProgress ─────────────────────────────────────────────────────
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99, height: 5, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' },
          bar: { borderRadius: 99 },
        },
      },

      // ── Skeleton ───────────────────────────────────────────────────────────
      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: {
          root: { borderRadius: R.xs, backgroundColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' },
        },
      },

      // ── Switch ─────────────────────────────────────────────────────────────
      MuiSwitch: {
        styleOverrides: {
          switchBase: { '&.Mui-checked': { color: ACCENT }, '&.Mui-checked + .MuiSwitch-track': { backgroundColor: ACCENT } },
        },
      },

      // ── Tooltip ────────────────────────────────────────────────────────────
      MuiTooltip: {
        defaultProps: { enterDelay: 300, arrow: true },
        styleOverrides: {
          tooltip: {
            fontSize: 12,
            borderRadius: R.xs,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            padding: '5px 10px',
            backgroundColor: dark ? '#1e2a3a' : '#1f2937',
          },
          arrow: { color: dark ? '#1e2a3a' : '#1f2937' },
        },
      },

      // ── Divider ────────────────────────────────────────────────────────────
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },

      // ── InputLabel ─────────────────────────────────────────────────────────
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: 13.5 } },
      },

      // ── FormHelperText ─────────────────────────────────────────────────────
      MuiFormHelperText: {
        styleOverrides: { root: { fontSize: 11.5, marginTop: 3 } },
      },

      // ── Popover ────────────────────────────────────────────────────────────
      MuiPopover: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: R.md,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          }),
        },
      },

      // ── Badge ──────────────────────────────────────────────────────────────
      MuiBadge: {
        styleOverrides: {
          badge: { fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: '0 4px' },
        },
      },
    },
  });
};

export default getAppTheme;
