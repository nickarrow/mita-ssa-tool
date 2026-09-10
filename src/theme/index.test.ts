/**
 * Theme Tests
 *
 * These assert the theme *object*, not rendered output, because jsdom does not
 * implement `:focus-visible` — a render-based test could not observe the focus
 * ring at all. The ring itself was verified in a real browser during the Wave 4
 * accessibility audit; this test exists so it cannot be silently removed.
 */

import { describe, it, expect } from 'vitest';
import theme from './index';

interface FocusVisibleOverride {
  '&.Mui-focusVisible'?: {
    outline?: string;
    outlineOffset?: number;
  };
}

function focusVisibleFor(component: 'MuiButtonBase'): FocusVisibleOverride {
  const root = theme.components?.[component]?.styleOverrides?.root;
  return (root ?? {}) as FocusVisibleOverride;
}

describe('theme focus indicator (WCAG 2.1 AA 2.4.7)', () => {
  it('should give every ButtonBase control a focus-visible outline', () => {
    const override = focusVisibleFor('MuiButtonBase')['&.Mui-focusVisible'];
    expect(override).toBeDefined();
    expect(override?.outline).toBe('2px solid currentColor');
  });

  it('should use currentColor so the ring adapts to the AppBar and page backgrounds', () => {
    // MUI's ButtonBase sets `outline: 0` and signals focus with a background
    // tint, which per-component `sx` backgrounds override. An outline cannot be
    // clobbered that way, and `currentColor` inherits the control's own text
    // colour — white on the dark blue AppBar, near-black on light backgrounds.
    const override = focusVisibleFor('MuiButtonBase')['&.Mui-focusVisible'];
    expect(override?.outline).toContain('currentColor');
  });

  it('should inset the ring on full-bleed rows so it is not clipped', () => {
    for (const component of ['MuiListItemButton', 'MuiAccordionSummary'] as const) {
      const root = theme.components?.[component]?.styleOverrides?.root as
        | FocusVisibleOverride
        | undefined;
      expect(root?.['&.Mui-focusVisible']?.outlineOffset).toBe(-2);
    }
  });
});

describe('theme palette', () => {
  it('should keep error.dark as the draft banner colour measured at 7.03:1', () => {
    // Pinned because the draft banner's contrast was measured against this exact
    // value in a real browser (Wave 3). error.main computes to only 4.67:1.
    expect(theme.palette.error.dark).toBe('#b0142f');
  });
});
