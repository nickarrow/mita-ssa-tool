import { JSX, ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Box, Button, Container, Link, Toolbar, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ScrollToTop } from './ScrollToTop';
import { DraftBanner } from './DraftBanner';
import { DRAFT_NOTICE_LABEL, IS_DRAFT } from '../../constants';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Determines if a nav item is currently active based on the path
 */
function isNavActive(currentPath: string, navPath: string): boolean {
  if (navPath === '/results') {
    return currentPath.startsWith('/results');
  }
  return currentPath === navPath;
}

export default function Layout({ children }: LayoutProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  // The skip link jumps to #main-content, which sits below the banner, so anyone
  // using it never encounters the notice. Marking the title covers that, since it
  // is announced on load regardless.
  //
  // The guard keys on the parenthesised marker rather than the bare word, so a
  // title that merely contains "Draft" in prose still gets marked. It also omits
  // any leading whitespace on purpose: the DOM trims `document.title`, so a guard
  // written as `' (Draft)'` never matches once the value has round-tripped, and
  // the marker gets appended again on every mount.
  //
  // Layout wraps <Routes> and so never unmounts, making this a genuine once-only
  // effect; the guard also absorbs StrictMode's double invocation.
  useEffect(() => {
    const marker = `(${DRAFT_NOTICE_LABEL})`;
    if (IS_DRAFT && !document.title.endsWith(marker)) {
      document.title = document.title ? `${document.title} ${marker}` : marker;
    }
  }, []);

  // Hide footer on assessment pages (full-screen working area)
  const isAssessmentPage = location.pathname.startsWith('/assessment/');

  // Navigation items for cleaner rendering
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/results', label: 'Results', icon: <AssessmentIcon /> },
    { path: '/import-export', label: 'Import/Export', icon: <ImportExportIcon /> },
    { path: '/guide', label: 'Guide', icon: <InfoOutlinedIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <ScrollToTop />
      {/* Skip to main content link - visually hidden until focused */}
      <Link
        href="#main-content"
        sx={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 9999,
          padding: 2,
          backgroundColor: 'primary.main',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 600,
          '&:focus': {
            left: '50%',
            transform: 'translateX(-50%)',
            top: 8,
          },
        }}
      >
        Skip to main content
      </Link>

      <AppBar
        position="static"
        color="primary"
        component="nav"
        aria-label="Main navigation"
        sx={{ flexShrink: 0 }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/');
              }
            }}
            aria-label="MITA 4.0 SS-A Tool - Go to home page"
          >
            MITA 4.0 SS-A Tool
          </Typography>
          {navItems.map((item) => {
            const isActive = isNavActive(location.pathname, item.path);
            return (
              <Button
                key={item.path}
                color="inherit"
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  mr: item.path !== '/guide' ? 1 : 0,
                  /**
                   * The selected state must DARKEN the AppBar, not lighten it.
                   * `rgba(255,255,255,0.1)` raised `primary.main` to `#1a7fc3`,
                   * dropping white text to 4.31:1 — so the *current* page was
                   * the only nav item failing AA, on five pages. Darkening to
                   * `#005f9e` gives 6.71:1 and still reads as selected.
                   */
                  backgroundColor: isActive ? 'rgba(0,0,0,0.16)' : 'transparent',
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Toolbar>
      </AppBar>

      {IS_DRAFT && <DraftBanner />}

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
        sx={{
          flexGrow: 1,
          overflow: isAssessmentPage ? 'hidden' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          // Remove focus outline since this is just a skip link target
          '&:focus': {
            outline: 'none',
          },
        }}
      >
        {children}
      </Box>

      {!isAssessmentPage && (
        <Box
          component="footer"
          role="contentinfo"
          aria-label="Site footer"
          sx={{
            py: 2,
            px: 2,
            flexShrink: 0,
            backgroundColor: 'grey.100',
            borderTop: '1px solid',
            borderColor: 'grey.300',
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="body2" color="text.secondary" align="center">
              MITA 4.0 State Self-Assessment Tool • All data stored locally in your browser •
              Version {__APP_VERSION__}
            </Typography>
          </Container>
        </Box>
      )}
    </Box>
  );
}
