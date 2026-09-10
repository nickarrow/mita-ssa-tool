/**
 * DraftBanner tests
 *
 * The banner exists so nobody can mistake the pilot build for a final one, so the
 * cases that matter are: it says what it is meant to say, it is reachable by
 * assistive technology without hijacking it, and it can actually be switched off
 * at go-live.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { DraftBanner, DRAFT_BANNER_LANDMARK_LABEL } from './DraftBanner';
import { DRAFT_NOTICE_BODY, DRAFT_NOTICE_LABEL } from '../../constants';

describe('DraftBanner', () => {
  it('states that the tool is a draft and still being piloted', () => {
    render(<DraftBanner />);

    expect(screen.getByText(DRAFT_NOTICE_LABEL)).toBeInTheDocument();
    // Substring match rather than a RegExp built from the copy, which contains
    // regex metacharacters ("MITA 4.0" has a dot).
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'P' && el.textContent!.includes(DRAFT_NOTICE_BODY)
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/still being piloted/)).toBeInTheDocument();
  });

  it('emphasises the label so it reads as a marker, not prose', () => {
    render(<DraftBanner />);

    const label = screen.getByText(DRAFT_NOTICE_LABEL);
    expect(label.tagName).toBe('STRONG');
  });

  it('is not an alert or live region', () => {
    render(<DraftBanner />);

    // Static text present from first paint. role="alert" would interrupt screen
    // reader users on every navigation, and a live region would re-announce text
    // that never changes.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('is a labelled landmark so screen readers can find it', () => {
    render(<DraftBanner />);

    // Discoverable in the landmark list rather than relying on the user
    // traversing it. Follows the USWDS Site Alert shape.
    const landmark = screen.getByRole('region', { name: DRAFT_BANNER_LANDMARK_LABEL });
    expect(landmark.tagName).toBe('SECTION');
  });

  it('cannot be dismissed', () => {
    render(<DraftBanner />);

    // A notice a reviewer can close is a notice that may be absent from the
    // screenshot they circulate.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<DraftBanner />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Caveat worth knowing: axe-core cannot evaluate colour contrast under jsdom
    // (it needs a canvas to sample rendered pixels, hence the "getContext not
    // implemented" notice). Contrast is this banner's main accessibility risk, so
    // it is verified in a real browser instead — see the Wave 3 notes in
    // docs/decisions/PILOT_CLEARANCE_PLAN.md.
  });
});

describe('draft mode switch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is on by default, so an unset variable cannot drop the marker', async () => {
    vi.unstubAllEnvs();
    const { IS_DRAFT } = await import('../../constants');

    expect(IS_DRAFT).toBe(true);
  });

  it('stays on for any value other than the exact string "false"', async () => {
    // Guards against a deploy variable set to FALSE, 0, or no accidentally
    // switching the disclaimer off.
    vi.stubEnv('VITE_DRAFT_MODE', 'FALSE');
    const { IS_DRAFT } = await import('../../constants');

    expect(IS_DRAFT).toBe(true);
  });

  it('switches off for VITE_DRAFT_MODE=false, the go-live path', async () => {
    vi.stubEnv('VITE_DRAFT_MODE', 'false');
    const { IS_DRAFT } = await import('../../constants');

    expect(IS_DRAFT).toBe(false);
  });
});
