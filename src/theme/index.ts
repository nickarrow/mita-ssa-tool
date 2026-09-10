import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0071bc',
      light: '#4d9fd4',
      dark: '#004c8c',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#02bfe7',
      light: '#4dd2ed',
      dark: '#0095b6',
    },
    success: {
      main: '#2e8540',
      light: '#4caf50',
      dark: '#1e5a2c',
    },
    warning: {
      main: '#fdb81e',
      light: '#ffc94d',
      dark: '#c48f00',
    },
    error: {
      main: '#e31c3d',
      light: '#e94d64',
      dark: '#b0142f',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#212121',
      secondary: '#5c5c5c',
    },
  },
  typography: {
    fontFamily: '"Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    /**
     * WCAG 2.1 AA 2.4.7 (Focus Visible).
     *
     * MUI's ButtonBase sets `outline: 0` and signals keyboard focus with a
     * background tint from `palette.action.focus`. Any component that sets its
     * own `backgroundColor` via `sx` — which this app does in several places,
     * e.g. the AppBar nav buttons — silently wins over that tint, leaving the
     * control with no focus indicator at all. Measured before this override:
     * outline `none`, box-shadow `none`, background `rgba(0,0,0,0.004)`.
     *
     * An outline cannot be clobbered by a background rule, and `currentColor`
     * adapts to context: white on the dark blue AppBar, near-black on light
     * page backgrounds. Because it keys off `:focus-visible` (via MUI's
     * `.Mui-focusVisible`), it is invisible to mouse and touch users.
     */
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '2px solid currentColor',
            outlineOffset: 2,
          },
        },
      },
    },
    /**
     * Full-bleed rows draw the ring inset so it is not clipped by the sidebar
     * edge or overlapped by the adjacent row.
     */
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outlineOffset: -2,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outlineOffset: -2,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          },
          /**
           * Contained buttons are the one case where `currentColor` needs an
           * inset ring. Their text colour is `palette[color].contrastText`
           * (white), so a ring drawn *outside* the border box lands on the white
           * page and measures 1.00:1 — invisible. Drawing it inside puts white
           * on the button's own fill instead: 5.14:1 on primary, 4.67:1 on
           * error, both clearing the 3:1 required for non-text contrast.
           */
          '&.Mui-focusVisible': {
            outlineOffset: -4,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        },
      },
    },
  },
});

export default theme;
