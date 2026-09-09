# Codebase Observations

**Audited:** September 9, 2026
**Against:** `feature/capability-model-v4` @ `33e7963` (v4.0.0), 6 commits ahead of `origin/main`
**Baseline at audit time:** 514 tests / 28 files passing, `typecheck` clean, `lint` clean, `knip` reports no unused exports

A running backlog of things noticed while reading the codebase. Nothing here is a
committed decision — it is raw material for prioritization. Each item has an ID so it
can be referenced in conversation ("let's do OBS-3").

Every item is marked **Confirmed** (verified by reading the cited code, running it, or
reproducing in a browser) or **Inferred** (reasoned from surrounding code but not
directly exercised). Cited line numbers are from the commit above and will drift.

---

## Orientation

Kept here so this document is useful on its own.

**The data files are the product.** Almost no domain content is hardcoded:

| File                         | Contents                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/capabilities.json` | 14 domains / 72 areas; strategic 3, core 7, support 4. Strictly Domain → Area (no category tier)                                                           |
| `src/data/orbit-model.json`  | 41 aspects: 26 standard (BA 5, Information 10, Technology 11 across 2 sub-dimensions) + 15 organizational (Outcomes 6, Roles 5, Enterprise Architecture 4) |

**Three special cases fork through every layer.** These are where change costs
concentrate, because detection is centralized but rendering is not:

1. **Organizational assessment** — the single `enterprise-governance` area hosts all 15
   organizational aspects as three sections. Sections are stored in
   `orbitRatings.dimensionId`, hence `RatingDimensionId = OrbitDimensionId | OrganizationalAssessmentId`.
   Detected via `isOrganizationalAssessmentArea` / `getOrganizationalSections`
   (`src/constants/index.ts`); rendered by separate branches in `AssessmentSidebar`,
   `ResultsMasterDetail`, `AreaResults`, `csvExport`, `pdfExport`, and `importService`.
2. **Aggregate dimensions** — `data-management` aggregates Information, `technical`
   aggregates Technology, computed from finalized _non_-enterprise assessments to avoid
   circularity. Mapped in `DOMAIN_AGGREGATE_DIMENSIONS`.
3. **`informationManagement: true`** — a pure data flag on 11 areas driving a warning
   banner. The cleanest of the three; a good model for future flags.

**Persistence:** Dexie/IndexedDB, schema v4. Versions 2, 3, and 4 are all clean-break
migrations that clear all five tables. Model restructures have precedent for doing this
rather than migrating.

**Ownership:** `src/pages/Assessment.tsx` is a single smart container owning all state
and every DB write; the nine components in `src/components/assessment/` are controlled
and callback-only. Reads use `useLiveQuery`, so writes re-render automatically.
Debounced text saves (500ms) live in the leaf `AspectCard`, not the page.

---

## Correctness

### OBS-1 — Organizational Enterprise Architecture aspects render as raw IDs

**Confirmed** (reproduced in the deployed app).

Both dimension tables branch on only two of the three organizational sections:

- `src/components/results/DimensionScoresTableWithTarget.tsx:118`
- `src/components/results/DimensionScoresTable.tsx:89`

```ts
if (rating.dimensionId === 'outcomes' || rating.dimensionId === 'roles') {
```

`'enterprise-architecture'` falls through to `getAspect('enterprise-architecture' as OrbitDimensionId, ...)`,
which resolves `orbitModel.dimensions['enterprise-architecture']` → `undefined` and
returns `undefined`. The name then falls back to `rating.aspectId`.

Reproduced: expanding the Organizational Enterprise Architecture section in Results
shows `enterprise-architecture`, `strategic-planning`, `business-capability`,
`policy-management` where Outcomes and Roles correctly show "Use of Metrics",
"Capability", etc.

This affects the live UI (`ResultsMasterDetail`), not just the legacy route. It is a
missed spot from the v4 consolidation — when the third section was added, these two
call sites were not updated. Fix should use `getOrganizationalAssessmentTypes()` or the
`ORGANIZATIONAL_SECTIONS` constant instead of a hand-written literal union, so a fourth
section cannot reintroduce it.

### OBS-2 — PDF export mislabels unassessed aspects as "N/A"

**Confirmed** by reading both branches.

`src/services/export/pdfExport.ts` disagrees with itself on the N/A sentinel:

- `generateDimensionDetails` treats `currentLevel === 0` as N/A ("Not applicable to this capability area")
- `generateOrganizationalDetails` treats `currentLevel === -1` as N/A ("Not applicable")

Project convention is `-1` = N/A, `0` = not assessed. So in the standard B-I-T path an
_unassessed_ aspect is reported to stakeholders as "not applicable", and a genuinely
N/A aspect (`-1`) falls through to "Not Rated". The organizational path is correct.

Since PDFs are the stakeholder- and CMS-facing artifact, this one misreports.

### OBS-3 — Aggregate dimensions are absent from the PDF

**Inferred** from the code path; not reproduced.

`generateCapabilityAreaSection` groups _actual ratings_ by dimension. Aggregate
dimensions have no ratings by design, so for enterprise-domain areas the aggregated
dimension is silently omitted from the report. A Data Management area's PDF shows
Business Architecture and Technology but no Information row at all.

CSV handles this (`(Aggregate from N assessments)` note in `exportService.ts`) and the
results UI handles it (`Aggregate (N areas)` chip). PDF is the gap.

### OBS-4 — ZIP import skips the export-version check

**Confirmed** by reading both entry points.

`importFromJson` gates on `SUPPORTED_VERSIONS` (`src/services/export/importService.ts`).
`importFromZip` validates structure but never checks `exportVersion`, so an unsupported
version is rejected as `.json` and accepted as `.zip`.

Also note `SUPPORTED_VERSIONS = ['1.0', '2.0']` while exports only ever emit `'1.0'` —
`'2.0'` is accepted but never produced.

### OBS-5 — Stored enterprise-domain scores go stale

**Confirmed** as a design consequence; the specific drift I first saw in a browser was
contaminated by my own seed data, so treat the magnitude as unverified.

At finalize time, `useCapabilityAssessments.finalizeAssessment` correctly folds the
aggregate into the overall score (`dimensionScores.set(aggregatedDimension, aggregateScore)`).
But `overallScore` is then _stored_, while the results table recomputes the aggregate
live from current data. Finalizing more non-enterprise assessments afterward changes the
aggregate and leaves the stored score behind — so the header score and the dimension
table can disagree for the same area.

May be acceptable (a finalized assessment is a point-in-time record). Worth a deliberate
decision either way, since it is the kind of inconsistency a reviewer will notice.
Options: recompute on read, or surface the snapshot date next to the score.

---

## Data-loss risks

### OBS-6 — Notes, barriers, and plans are dropped if no level is selected

**Confirmed** by reading the three functions.

`updateNotes`, `updateBarriers`, and `updatePlans` in `src/hooks/useOrbitRatings.ts` all
follow `if (existing) { update }` with **no else branch** — unlike `updateLevel` and
`updateTargetLevel`, which create the rating when missing.

So a user who expands an aspect and types into Notes _before_ choosing a maturity level
loses that text. Worse, the save indicator still flashes "Saved" (see OBS-7), so there
is no feedback. This is plausible real-world behavior — reading the criteria, jotting a
note, then deciding the level.

These three also skip the `capabilityAssessments.updatedAt` bump that every other write
performs, so text-only edits do not move the assessment in the dashboard's
recently-updated ordering.

### OBS-7 — The save indicator is not wired to actual saves

**Confirmed** by reading `triggerSave` in `src/pages/Assessment.tsx`.

```ts
setSaveStatus('saving');
setTimeout(() => { setSaveStatus('saved'); ... }, 300);
```

It reports success on a timer, never observing the promise. Failed writes still display
"Saved". `AssessmentContextBar` already implements an `'error'` state that nothing can
trigger. In a tool whose entire value proposition is local persistence, a save indicator
that cannot report failure is worth fixing — awaiting the handler's promise and
surfacing rejection would use the existing UI.

### OBS-8 — Import runs untransacted

**Confirmed** by grep: `db.transaction` appears only in `src/services/tags.ts` and
`src/services/db.ts`, not in `importService.ts`.

The whole import is sequential un-transacted writes across five tables, including a
destructive path (delete existing ratings, then insert imported ones) in the
"imported is newer" branch. A mid-run failure leaves partial state with no rollback.
This diverges from the project's own multi-table transaction guidance in the
development standards.

### OBS-9 — Attachment import failures are silent

**Confirmed**: the per-file loop in `importFromZip` ends in `} catch { }` with a comment
calling attachment loss non-critical. Attachments are user-supplied evidence documents;
losing them without a single line in the import summary seems inconsistent with that
summary's otherwise detailed per-item reporting.

Related: the rating-matching logic there compares `dimensionId` and `aspectId` but
ignores `subDimensionId`. **Inferred** — aspect IDs currently appear globally unique, so
this is latent rather than active.

---

## Structural debt

### OBS-10 — `DimensionScoresTable` and `DimensionScoresTableWithTarget` are near-duplicates

**Confirmed** by grep.

~80% duplicated: `AspectDetailRow`, `DimensionRow`, `TechnologyDimensionRows`,
`getLevelDisplay`, `getLevelDescription`, `getShortLevelDisplay` exist in both. OBS-1 is
exactly the kind of bug this shape produces — one fix, two places, and it was applied to
neither.

Consumers, each exactly one:

| Component                        | Rendered by                   | Reachable?                      |
| -------------------------------- | ----------------------------- | ------------------------------- |
| `DimensionScoresTableWithTarget` | `ResultsMasterDetail.tsx:599` | Yes — this is the live UI       |
| `DimensionScoresTable`           | `AreaResults.tsx:485`         | Only by direct URL (see OBS-11) |

### OBS-11 — Orphaned results routes and one genuinely dead component

**Confirmed** by grep.

`ResultsMasterDetail` replaced the drill-down but the old routes remain in `App.tsx`:

- `/results/:domainId` → `DomainResults.tsx`
- `/results/:domainId/:areaId` → `AreaResults.tsx`

Nothing in the live UI navigates into them; they only link to each other. Reachable by
bookmark or direct URL, where they render duplicated (and now divergent) content.

`DomainScoresList.tsx` is the one component that entered that pair from outside, and it
is dead: rendered nowhere, absent from the results barrel (`index.ts` exports only
`DimensionScoresTable` and `ResultsMasterDetail`), referenced solely by its own test.
Knip does not flag it because the test import counts as usage.

`AreaResults` does still hold one thing the master-detail lacks: the score-trend line
chart and history table. Removing the routes means porting or dropping that.

### OBS-12 — Assessment navigation is local state only

**Confirmed** by reading `src/pages/Assessment.tsx`.

`currentNavIndex` is `useState`, and `searchParams` is destructured without its setter,
so nothing writes to the URL. Consequences: no deep-linking to a dimension or aspect,
refresh always returns to the first nav item, and browser back/forward does not move
between dimensions. Only `?view=true` is read.

Not a bug, but a hard constraint on anything that wants shareable or resumable
positions. Flagging because "send me a link to this dimension" is a natural request.

### OBS-13 — Two independent completion denominators

**Confirmed** by reading both.

| Where                                             | Denominator                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Assessment page (sidebar header, finalize dialog) | `navItems.reduce((sum, nav) => sum + nav.aspectCount, 0)`                     |
| Dashboard and results                             | `getAssessableAspectCountForArea(areaId, domainId)` (`src/services/orbit.ts`) |

They currently agree (26 / 15 / 26-minus-aggregated) but are computed by unrelated code
from different inputs. Any change to the nav model must update both or they diverge
silently. A single shared source would remove the coupling.

Related, same area: the numerator `getAssessedCount()` counts assessed ratings across
the **whole assessment, unfiltered by dimension**, so a stray rating on an aggregated
dimension (possible via imported or legacy data) can push displayed progress above 100%.
**Inferred** — not reproduced.

### OBS-14 — Overloaded parameter in the sidebar selection callback

**Confirmed** by reading the call sites.

In organizational mode, `onDimensionSelect(dimensionId, subDimensionId?)` is called with
an **aspectId** cast to `OrbitDimensionId`, and `handleDimensionSelect` branches on
`isOrganizationalAssessment` to reinterpret it. The same pattern forces casts at
`currentDimensionId={currentNav.dimensionId ?? (currentNav.aspectId as OrbitDimensionId)}`
and `dimensionId={currentNav.dimensionId ?? (currentNav.organizationalType as OrbitDimensionId)}`.

This is the main source of type-casting debt in the assessment flow. A discriminated
union for the selection payload would let TypeScript check what is currently
cast-and-hope. Relevant if navigation gets touched.

### OBS-15 — Full-record read-modify-write on checkbox changes

**Inferred**; not reproduced under timing.

`handleQuestionChange` and `handleEvidenceChange` call the full `saveRating`, which
rewrites `currentLevel`, `targetLevel`, `questionResponses`, `evidenceResponses`,
`notes`, `barriers`, and `plans` from the in-memory `ratingsMap` snapshot. A debounced
notes save (500ms) landing between snapshot and write would be reverted. Narrow window,
real mechanism. Patching only the changed field would close it.

### OBS-16 — Minor duplication and dead UI state

**Confirmed.**

- `type SaveStatus` is declared identically in `Assessment.tsx` and `AssessmentContextBar.tsx`.
- `isReviewSelected` is set by `handleReviewSelect` but never reset when the finalize
  dialog is dismissed. Since `AssessmentSidebar.isSelected` returns `false` for every row
  while it is true, cancelling the dialog leaves no dimension highlighted even though the
  content pane still shows one.
- `ResultsMasterDetail` hardcodes `height: 600` with internal scroll. On a tall viewport
  the nav list clips mid-domain (observed in the browser) with lots of empty page below.
- ~~`Dashboard.handleExportAssessment` is a `TODO: Implement export in Phase 7` stub~~ —
  **corrected during Wave 1.** It was worse and simpler than described: `ActionMenu` never
  rendered an Export item at all, so the handler was unreachable and `onExport` was dead
  prop plumbing threaded through `Dashboard` → `DomainTable` → `CapabilityRow` →
  `ActionMenu`. Not a user-visible dead end, just dead code. Removed rather than wired up.
  Worth noting that knip cannot see this class of dead code: each prop _is_ used, by being
  passed one level further down.

---

## Documentation drift

### OBS-17 — The steering file contradicts the shipped model

**Confirmed** against `src/data/*.json`.

`.kiro/steering/development-standards.md` states 16 domains, 66 areas, and describes
`isCategorizedDomain` / `CategorizedCapabilityDomain` as live type guards. All of that is
v3. Actual: 14 domains, 72 areas, category tier and those types removed in v4.

`PROJECT_FOUNDATION_v2.md` is correct. Since the steering file is injected into every
AI-assisted session, it actively feeds wrong domain facts into future work — highest
value-per-effort item in this document.

### OBS-18 — Placeholder descriptions are user-visible

**Confirmed** in the browser: the Enterprise Governance results panel renders
"[Placeholder — pending updated Capability Reference Model] Assess organizational
maturity across…".

Deliberate (Decision 6 in `CAPABILITY_MODEL_UPDATE_PLAN.md`) and awaiting NextGen's
document, so this is a tracking note rather than a defect. 13 areas carry placeholders.
Worth confirming the working group expects to see the marker during staging review.

---

## Test gaps

### OBS-19 — The most complex files are the untested ones

**Confirmed** by directory listing.

`src/components/assessment/` contains tests for only `AssessmentSidebar` and
`InformationManagementNotice`. Untested:

| File                                      | Lines | Why it matters                                                  |
| ----------------------------------------- | ----- | --------------------------------------------------------------- |
| `pages/Assessment.tsx`                    | 837   | Owns the nav model, all three special cases, and every DB write |
| `components/assessment/AspectCard.tsx`    | 302   | Owns debounced auto-save (see OBS-6)                            |
| `components/assessment/DimensionPage.tsx` | 214   | Aspect fan-out and expansion state                              |

Coverage is strong where logic is pure (hooks, services, export/import all have
substantial suites). The gap is concentrated in the stateful container layer — which is
also where OBS-6, OBS-7, OBS-12, OBS-13, and OBS-14 all live. Changes there currently
have no safety net.

---

## Suggested triage

Not a commitment, just how I would sequence it:

**Cheap and clearly worth it**

- OBS-17 — correct the steering file (minutes; prevents compounding errors)
- OBS-1 — three sections instead of two, derived from the constant (small, fixes a visible bug)
- OBS-2 — align the PDF N/A sentinel (small, fixes stakeholder-facing output)

**Worth doing before the next feature touches these areas**

- OBS-6 + OBS-7 — silent data loss plus an indicator that hides it; related fix
- OBS-8 — wrap import in a transaction
- OBS-11 — decide the fate of the orphaned routes, which unblocks OBS-10

**Needs a decision, not just a patch**

- OBS-5 — stale stored scores: recompute, or display as a snapshot?
- OBS-3 — should PDFs represent aggregate dimensions at all?
- OBS-12 / OBS-14 — only if navigation is being reworked anyway

**Opportunistic**

- OBS-19 — add container tests alongside the next change in that area rather than as a standalone effort

### OBS-20 — The vendor chunk exceeds its own warning threshold on every build

**Confirmed** by running `npm run build` (September 9, 2026).

`vite.config.ts` sets `chunkSizeWarningLimit: 520` with a comment stating the vendor
chunk is "~510KB which is acceptable for a PWA". Actual output:

| Chunk        | Size         | Gzipped    |
| ------------ | ------------ | ---------- |
| `vendor-mui` | 337 kB       | 100 kB     |
| `vendor`     | **1,418 kB** | **450 kB** |
| `index`      | 337 kB       | 81 kB      |

So the threshold is exceeded on every single build and the explanatory comment is stale.
Two costs: a warning that always fires trains people to ignore build output, and 450 kB
gzipped of vendor JavaScript is meaningful for an offline-first PWA used on state agency
networks.

The `vendor` chunk currently collects everything outside MUI — jsPDF, Chart.js, JSZip,
Dexie, React and Router. Several are only needed on specific routes (jsPDF and JSZip only
on export, Chart.js only on results), so route-level dynamic imports would cut the initial
payload substantially. `manualChunks` in `vite.config.ts` is already the place this is
controlled.

Not on the pilot-clearance critical path. Noted so the stale comment does not keep
implying the limit is respected.

### OBS-21 — Technology dimension score is computed two different ways and they disagree

**Confirmed** by reproducing the divergence numerically.

Two code paths compute the Technology dimension score, and they round at different points:

| Path                                                                                         | Behavior                                                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `services/scoring.ts` `calculateDimensionScore` — used by finalize, aggregates, and export   | sub-dimension means left **unrounded**, averaged, then rounded once                                |
| `hooks/useScores.ts` `getDimensionScoresForAssessment` — used by the results dimension table | each sub-dimension mean **rounded** via `calculateAverageScore`, then averaged, then rounded again |

Double rounding makes them differ. Worked example — Technical Infrastructure Management
rated `2,2,2,2,1,1` (mean 1.6667) and Application Management rated `1,1,1,1,1` (mean 1.0):

- `calculateDimensionScore` → mean(1.6667, 1.0) = 1.3333 → **1.3**
- `getDimensionScoresForAssessment` → mean(1.7, 1.0) = 1.35 → **1.4**

The stored `overallScore` shown in the area header derives from the first path; the
Technology row in the dimension table derives from the second. So the same assessment
displays a header score built from 1.3 while the table beside it shows 1.4.

The organizational path has the same shape: `finalizeAssessment` averages **unrounded**
section means, while the results table shows **rounded** section means, so summing what is
displayed does not always reproduce the stored score.

`calculateDimensionScore` is the canonical implementation — its own docstring says so, and
finalize, aggregate, and export all use it. `useScores` should delegate rather than
recompute. Fix by having `getDimensionScoresForAssessment` keep unrounded sub-dimension
means for the dimension roll-up while still displaying rounded values per sub-dimension.

Consequential now for two reasons: reviewers are looking at the Results screen this week,
and the XLSX workbook has to reproduce one of these two numbers — so which one is
authoritative must be settled before the formulas are written.

### OBS-22 — The app is documented and advertised as an offline-first PWA, but no service worker exists

**Confirmed** by inspection: `vite.config.ts` registers only `react()`. No `VitePWA`, no
manifest, no service-worker registration in `main.tsx` or `index.html`, and no `sw.js` in
build output. `vite-plugin-pwa@^0.21.1` is a dependency but unused — and `knip.json`
explicitly silences it (`"ignoreDependencies": ["vite-plugin-pwa"]`), which is why the
clean knip run never surfaced it.

The claim is made in six places, two of them user-facing:

| Location                                        | Claim                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/pages/Landing.tsx:26-28`                   | "Works Offline — Full functionality after initial load, even without an internet connection." |
| `src/pages/About.tsx:49-51`                     | "Works offline — Full functionality after the first load, even without a connection."         |
| `README.md:3, :10, :209`                        | PWA; offline-first; "Requires IndexedDB and Service Worker support"                           |
| `PROJECT_FOUNDATION_v2.md:5, :18, :40`          | Core Principle 2 "Offline First"; tech stack lists `vite-plugin-pwa`                          |
| `.kiro/steering/development-standards.md:11-14` | "Offline-First" as a key characteristic                                                       |

Data persistence genuinely is local (IndexedDB), so a loaded tab keeps working. But a
reload without network fails — there is no cached app shell. "Offline-first" describes the
storage model, not the delivery model, and the user-facing copy promises the latter.

This matters beyond documentation accuracy: states are being recruited for the pilot now
and will be told the tool works offline. It also means a generated workbook served from
`public/` is not precached, so the offline fallback is not itself available offline.

Two paths: wire up the plugin that is already installed (small — config plus manifest plus
registration), or remove the claims. Wiring it up is preferable given the copy already
promises it, but a service worker introduces cache-invalidation behavior that can confuse
pilot users, so prefer prompt-on-update over silent auto-update.

### OBS-23 — Every per-level `questions` array is empty, and `questionResponses` is dead weight

**Confirmed**: across all 205 level entries (41 aspects × 5 levels) in `orbit-model.json`,
`questions` is `[]` in **205/205**. `evidence` is empty in 56/205.

This is a correct consequence of the v3 model change — the CHANGELOG records that per-level
question checklists were replaced by a single aspect-level question plus "Suggested
Documentation" as evidence, and the aspect-level question now lives in the aspect
`description` (visible in the UI as "To what extent is…"). But the schema still carries the
empty arrays, and the code still carries the machinery:

- `OrbitLevelDefinition.questions` is always empty, so `QuestionChecklist` renders only its
  evidence half, and its questions props, `getQuestionChecked`, and question accordion are
  unreachable
- `QuestionResponse` / `OrbitRating.questionResponses` are written and persisted but can
  never hold a meaningful entry, since there is no question to answer
- `handleQuestionChange` in `Assessment.tsx` is likewise unreachable
- Import/export, history snapshots, and the full-record `saveRating` all carry the field

Low urgency and harmless at runtime, but it is a trap for anyone reading the model: the
schema implies a feature that no longer exists. Relevant to the XLSX work — a criteria
sheet column for "question" would be 100% blank, which would violate the no-empty-columns
rule the workbook has to satisfy.

### OBS-24 — Expandable dimension rows are mouse-only

**Confirmed** while writing the OBS-1 regression test — the test could not find a button to
activate, because there isn't one.

`DimensionRow` in both `DimensionScoresTable.tsx` and `DimensionScoresTableWithTarget.tsx`
attaches `onClick` to the `TableRow` itself and sets `aria-expanded`, with no `tabIndex`, no
`role="button"`, and no `onKeyDown`. So the row announces itself as expandable to a screen
reader while being impossible to expand without a mouse.

That hides real content: the expanded region is where per-aspect levels, notes, barriers,
plans, and attachment links live. A keyboard or screen reader user can reach the dimension
summary and nothing beneath it.

`aria-expanded` on a non-interactive element is also invalid — the attribute is only
meaningful on something focusable and activatable.

Fix shape: move the affordance to a real `IconButton` inside the first cell (the pattern
`DomainTable` already uses for its expand control, which _is_ keyboard reachable), or give
the row `role="button"`, `tabIndex={0}`, and Enter/Space handling. The `IconButton` route is
preferable — it matches existing precedent in the codebase and avoids a row-wide click
target that interferes with text selection.

Scheduled for **Wave 4** (accessibility remediation) in the pilot clearance plan.

### OBS-25 — PDF and CSV export weight the Technology score by aspect count, not by sub-dimension

**Confirmed** by reading both call sites and reproducing the divergence. Surfaced by the
Wave 1 review of the OBS-21 fix.

There were **three** implementations of the Technology dimension score, not two. OBS-21
fixed the results table; export was not in its scope and still diverges:

| Site                                                                                     | Method                                                            | Example result |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- |
| `services/scoring.ts` `calculateDimensionScore` (canonical)                              | mean of the two sub-dimension means                               | **3.0**        |
| `hooks/useScores.ts` (fixed in OBS-21)                                                   | delegates to canonical                                            | **3.0**        |
| `services/export/exportService.ts` `generateStandardAreaProfile`                         | `calculateAverageScore` over a flat array of all 11 aspect levels | **3.2**        |
| `services/export/pdfExport.ts` `generateDimensionDetails` and `generateExecutiveSummary` | flat mean over the dimension's ratings                            | **3.2**        |

Example is Technical Infrastructure Management all at 5 and Application Management all at 1.
Canonical gives `mean(5, 1) = 3.0`; the flat mean gives `(6×5 + 5×1) / 11 = 3.18 → 3.2`.

This is a **weighting** difference, not a rounding one, so it does not shrink with more data
— it is systematically biased toward whichever sub-dimension has more aspects
(Infrastructure, 6 versus 5).

Why it matters more than the others: the CSV maturity profile is the artifact states submit
to CMS, and the PDF is the stakeholder report. Both currently report a Technology number
the tool's own UI disagrees with.

Two further wrinkles in the same code:

- **To-Be has the same flaw and no canonical scorer to delegate to.** `calculateDimensionScore`
  only reads `currentLevel`. Fixing the To-Be column needs either a level-selector parameter
  or a small generalization of the scorer.
- **`generateExecutiveSummary`'s "ORBIT Dimension Summary" is a different question again** —
  it flat-averages every rating for a dimension across all capability areas, so it is
  weighted by both aspect count and by how many areas were assessed. The defensible
  enterprise-wide figure is the mean of per-area dimension scores. That is a semantic change,
  not just a delegation.

Scheduled for **Wave 5** (export correctness) in the pilot clearance plan, which lands before
the workbook formulas in Wave 7 — so the workbook has one canonical rule to implement rather
than three candidates.
