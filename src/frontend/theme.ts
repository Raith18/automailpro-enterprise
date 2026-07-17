import { createTheme, alpha } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#2874f0' },
      secondary: { main: '#ffe500', contrastText: '#000' },
      background: {
        default: mode === 'light' ? '#f1f3f6' : '#0d1117',
        paper: mode === 'light' ? '#ffffff' : '#161b22',
      },
      success: { main: '#388e3c' },
      error: { main: '#d32f2f' },
      warning: { main: '#f59e0b' },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(135deg, #2874f0 0%, #1650c2 100%)',
            boxShadow: '0 2px 12px rgba(40,116,240,0.3)',
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            boxShadow: mode === 'light'
              ? '0 1px 4px rgba(0,0,0,0.08)'
              : '0 1px 4px rgba(0,0,0,0.4)',
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            '&:hover': {
              boxShadow: mode === 'light'
                ? '0 4px 16px rgba(40,116,240,0.15)'
                : '0 4px 16px rgba(40,116,240,0.3)',
              transform: 'translateY(-1px)',
            }
          })
        }
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 6 },
          containedPrimary: {
            background: 'linear-gradient(135deg, #2874f0 0%, #1650c2 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #1a68e0 0%, #0e40b2 100%)' }
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.72rem' }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: mode === 'light' ? '1px solid #e0e7ff' : '1px solid #30363d',
            background: mode === 'light' ? '#fff' : '#161b22',
          }
        }
      }
    }
  });
