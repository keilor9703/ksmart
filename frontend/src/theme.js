import { createTheme } from '@mui/material/styles';

const getAppTheme = (mode) => createTheme({
  palette: {
    mode, // 'light' or 'dark'
    primary: {
      main: '#1976D2', // Dark Grey for a sophisticated, neutral primary
    },
    secondary: {
      main: '#FFC107', // Earthy Brown for a warm secondary, placeholder for branding
    },
    background: {
      default: mode === 'light' ? '#F5F5F5' : '#121212', // Slightly off-white for light, dark gray for dark
      paper: mode === 'light' ? '#FFFFFF' : '#1E1E1E', // White for light, darker gray for dark
    },
    text: {
      primary: mode === 'light' ? '#212121' : '#FFFFFF', // Darker gray for light, white for dark
      secondary: mode === 'light' ? '#757575' : '#B0B0B0',
    },
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    h1: { fontSize: '2.5rem' },
    h2: { fontSize: '2rem' },
    h3: { fontSize: '1.75rem' },
    h4: { fontSize: '1.5rem' },
    h5: { fontSize: '1.25rem' },
    h6: { fontSize: '1rem' },
    body1: {
      fontSize: '0.9rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.8rem',
      lineHeight: 1.4,
    },
    button: {
      textTransform: 'none', // Prevent all caps by default
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Slightly rounded corners
          padding: '10px 20px', // More comfortable padding
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: '#616161', // Darker grey on hover
          },
        },
        outlinedPrimary: {
          '&:hover': {
            backgroundColor: 'rgba(66, 66, 66, 0.04)', // Slight background on hover for outlined
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none', // Remove default app bar shadow for a cleaner look
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)', // Add subtle bottom border
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12, // More rounded cards
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', // Softer shadow
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          // Asegura que los controles con fullWidth realmente ocupen el 100%
          // y no se vean limitados por anchos intrínsecos del Select
          width: '100%',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        fullWidth: true, // Hacer que los TextField sean fullWidth por defecto ayuda a la consistencia
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          // Evita que el contenido del select trunque el texto prematuramente
          minWidth: 'auto',
        },
      },
    },
  },
});

// NOTA: Para una personalización completa y reflejar la marca "Peleteria Jeylor",
// se recomienda reemplazar estos colores con los colores corporativos oficiales.
// También se pueden ajustar otros aspectos como la tipografía y las formas de los componentes.


export default getAppTheme;
