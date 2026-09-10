/**
 * Site-wide draft disclaimer.
 *
 * Renders on every page while `IS_DRAFT` is set, so anyone looking at the tool —
 * including in a screenshot circulated for review — can see it is not final.
 *
 * Announcement semantics, which took a couple of passes to get right:
 *
 *  - Not `role="alert"`. That is assertive and would interrupt a screen reader on
 *    every navigation, for text that has not changed.
 *  - Not a live region either, though not for the reason first written here: a
 *    live region announces *mutations*, so a static one would simply never fire.
 *    It would be inert rather than noisy — still the wrong tool, but it is worth
 *    the record being accurate.
 *  - A labelled landmark, which is what actually helps: the notice becomes
 *    discoverable in a screen reader's landmark list instead of relying on the
 *    user happening to traverse it. `<section>` with an accessible name follows the
 *    USWDS Site Alert pattern, which is the closest precedent for a government
 *    tool, and it also satisfies axe's `region` rule that flags top-level content
 *    sitting outside any landmark.
 *
 * `Layout` additionally suffixes the document title, because the skip link jumps
 * past this element to `#main-content`.
 */

import { JSX } from 'react';
import { Box, Typography } from '@mui/material';
import { DRAFT_NOTICE_BODY, DRAFT_NOTICE_LABEL } from '../../constants';

/** Accessible name for the landmark, also used by tests. */
export const DRAFT_BANNER_LANDMARK_LABEL = 'Draft notice';

export function DraftBanner(): JSX.Element {
  return (
    <Box
      component="section"
      aria-label={DRAFT_BANNER_LANDMARK_LABEL}
      sx={{
        // error.dark rather than error.main: measured 7.03:1 against white versus
        // 4.67:1, so it clears WCAG AA with margin at this small text size while
        // still reading unmistakably as red.
        backgroundColor: 'error.dark',
        color: 'common.white',
        px: 2,
        py: 0.5,
        textAlign: 'center',
        // The app shell is height:100vh with overflow hidden and the assessment
        // page is a fixed-height working area, so this must never absorb space
        // from the content below it.
        flexShrink: 0,
      }}
    >
      <Typography variant="caption" component="p" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
        <strong>{DRAFT_NOTICE_LABEL}</strong>
        {' — '}
        {DRAFT_NOTICE_BODY}
      </Typography>
    </Box>
  );
}
