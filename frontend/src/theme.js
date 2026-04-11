import { createTheme } from '@mui/material/styles';

const ACCENT = '#FF6020';

const getAppTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary:   { main: ACCENT, contrastText: '#fff' },
      secondary: { main: '#10B981' },
      error:     { main: '#EF4444' },
      warning:   { main: '#F59E0B' },
      success:   { main: '#22c55e' },
      background: {
        default: mode === 'dark' ? '#0d1117' : '#F4F6F9',
        paper:   mode === 'dark' ? '#161b22' : '#FFFFFF',
      },
      text: {
        primary:   mode === 'dark' ? '#f1f5f9' : '#111827',
        secondary: mode === 'dark' ? '#94a3b8' : '#6B7280',
      },
      divider: mode === 'dark' ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
    },

    typography: {
      fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif",
      h1: { fontWeight: 800 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
    },

    shape: { borderRadius: 10 },

    components: {
      // ── Paper ──────────────────────────────────────────────────────────
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: mode === 'dark'
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06)',
          }),
        },
      },

      // ── Card ───────────────────────────────────────────────────────────
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: mode === 'dark'
              ? '0 2px 8px rgba(0,0,0,0.35)'
              : '0 2px 8px rgba(0,0,0,0.06)',
            borderRadius: 12,
          }),
        },
      },

      // ── Button ─────────────────────────────────────────────────────────
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13.5,
            textTransform: 'none',
            padding: '7px 18px',
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${ACCENT} 0%, #ff9a62 100%)`,
            boxShadow: `0 4px 14px rgba(255,96,32,0.35)`,
            '&:hover': {
              background: `linear-gradient(135deg, #e5521a 0%, ${ACCENT} 100%)`,
              boxShadow: `0 4px 18px rgba(255,96,32,0.45)`,
            },
          },
        },
      },

      // ── TextField ──────────────────────────────────────────────────────
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              fontSize: 13.5,
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#fff',
              '& fieldset': { borderColor: theme.palette.divider },
              '&:hover fieldset': { borderColor: ACCENT },
              '&.Mui-focused fieldset': { borderColor: ACCENT },
            },
            '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
          }),
        },
      },

      // ── Autocomplete ───────────────────────────────────────────────────
      MuiAutocomplete: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 10,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }),
        },
      },

      // ── Select ─────────────────────────────────────────────────────────
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: 13.5,
          },
        },
      },

      // ── Table ──────────────────────────────────────────────────────────
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableCell-root': {
              backgroundColor: mode === 'dark' ? '#1e2a3a' : '#F8FAFC',
              color: theme.palette.text.secondary,
              fontWeight: 600,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              borderBottom: `2px solid ${theme.palette.divider}`,
              padding: '10px 16px',
            },
          }),
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableRow-root': {
              '&:hover': {
                backgroundColor: mode === 'dark'
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(255,96,32,0.03)',
              },
            },
            '& .MuiTableCell-root': {
              fontSize: 13.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
              padding: '10px 16px',
            },
          }),
        },
      },

      // ── Chip ───────────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 12,
          },
        },
      },

      // ── Dialog ─────────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            padding: 4,
          },
        },
      },

      // ── Tabs ───────────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: 13.5,
            textTransform: 'none',
            '&.Mui-selected': { color: ACCENT },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: ACCENT, height: 3, borderRadius: 3 },
        },
      },

      // ── Tooltip ────────────────────────────────────────────────────────
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: 12,
            borderRadius: 6,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          },
        },
      },

      // ── InputLabel ─────────────────────────────────────────────────────
      MuiInputLabel: {
        styleOverrides: {
          root: { fontSize: 13.5 },
        },
      },
    },
  });

export default getAppTheme;
