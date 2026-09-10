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

**Resolved.** It turned out to be two half-fixes in two commits:

- `DimensionScoresTableWithTarget.tsx` — the **live** table — was fixed incidentally by the
  Wave 1 OBS-1 work (`a0b53c2`), which gave the row a real `Box component="button"` with
  `aria-expanded`, `aria-controls`, an `aria-label`, and Enter/Space handling. So the
  keyboard-unreachable content described above stopped being reachable-only-by-mouse before
  Wave 4 began.
- `DimensionScoresTable.tsx` — reachable only via the orphaned `/results/:domainId/:areaId`
  route (OBS-11) — still carried bare `aria-expanded` on two `TableRow`s. axe flags that as
  `aria-conditional-attr` (serious): `aria-expanded` is valid on `treegrid` rows but not on
  `table` rows. Fixed in **Wave 4** by porting the same button pattern from its sibling.

Note this is exactly the OBS-10 duplication tax predicted: one bug, two files, fixed in two
different waves.

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

### OBS-26 — `useDebouncedSave` can clobber keystrokes with the echo of its own save

**Confirmed** by reading the hook; the window is narrow, so not reproduced live. Found while
verifying the OBS-6 fix in Wave 2.

`useDebouncedSave` (`src/hooks/useDebounce.ts`) syncs local state down from the external
value unconditionally:

```ts
useEffect(() => {
  setLocalValue(externalValue);
}, [externalValue]);
```

The save effect depends on `[localValue, ...]` and clears its timer on every change, so no
save fires during continuous typing — only after a 500ms pause. That creates this sequence:

1. User pauses 500ms; the debounce dispatches a save with `"Hello"`
2. User resumes typing, local becomes `"Hello wor"`
3. The write lands and `useLiveQuery` pushes the new rating, so `externalValue` becomes `"Hello"`
4. The sync effect runs `setLocalValue("Hello")` — the `" wor"` is discarded and the caret jumps

The window is only as long as a Dexie write plus a live-query round trip (roughly tens of
milliseconds), and the user has to resume typing inside it, immediately after a deliberate
pause. That narrowness is presumably why it survived the pilot.

**Pre-existing, and the OBS-6 fix does not widen the window** — it only makes the race
reachable in one more situation. Before, typing into a fresh notes field never created a
rating, so `externalValue` stayed `''` and there was no echo to clobber with; the race
already occurred whenever a rating existed, which is the normal flow after picking a level.

Proposed fix, kept out of Wave 2 because it changes shared behavior that three fields and ten
existing tests depend on: accept a new external value only when the user has no unsaved local
edit.

```ts
// If the user has diverged from the last external value we saw, their text wins —
// the pending debounce will reconcile it. Otherwise accept the incoming value.
useEffect(() => {
  setLocalValue((current) => (current === lastExternalRef.current ? externalValue : current));
  lastExternalRef.current = externalValue;
}, [externalValue]);
```

That keeps legitimate external updates working (import, revert-edit, carry-forward) while
making in-progress typing authoritative. Worth pairing with a test that types across a save
boundary.

### OBS-27 — Hook tests gate on a live-query emission they do not need, making them flaky

**Confirmed** by measurement during Wave 2.

Many tests in `src/hooks/useOrbitRatings.test.ts` follow this shape:

```ts
const { result } = renderHook(() => useOrbitRatings(assessmentId));
await waitFor(() => {
  expect(result.current.ratings).toHaveLength(1); // load gate, not an assertion
});
await act(async () => {
  await result.current.updateNotes(/* ... */);
});
const stored = await db.orbitRatings.get('r1'); // asserts against the DB, not the hook
```

The `waitFor` is there to ensure the hook has "loaded" before mutating. It is not needed: the
mutation paths (`updateLevel`, `updateTargetLevel`, `updateTextField`, `saveRating`) resolve
the target row directly from IndexedDB through `findExistingRating` and never read
`result.current.ratings`. The gate only couples the test to Dexie `liveQuery` scheduling.

That coupling is the flake. Measured failure rates for
`vitest run useOrbitRatings.test.ts <second file>`:

| Invocation                                      | Failures |
| ----------------------------------------------- | -------- |
| Alone                                           | 0 / 8    |
| Plus `useDebounce.test.ts`                      | 1 / 8    |
| Plus `useSaveStatus.test.ts` (uses fake timers) | 5 / 10   |
| Full suite                                      | 0 / 5    |

Under CPU contention from a concurrently running file, the first `liveQuery` emission
sometimes does not arrive within seconds. Removing the gate from the tests added in Wave 2
dropped the two-file rate from 5/10 to **0/10**.

CI is unaffected — the full suite has never flaked — so this is a developer-ergonomics
problem: running two files at once during development fails for no real reason.

Fix: drop the load gate wherever the test asserts against the database rather than the hook,
keeping `waitFor` only where the hook's own returned state is what is being tested (for
example `getAssessedCount`, `getAverageLevelForDimension`). Roughly a dozen call sites in
that one file. `asyncUtilTimeout` is now 3000 in `src/test/setup.ts`, which raises the
ceiling for the genuine cases while staying under vitest's 5000ms `testTimeout` so failures
still report as assertion differences.

### OBS-28 — The referenced favicon does not exist

**Confirmed** by inspection and by request against the deployed site.

`index.html:5` declares `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`, but no
favicon file exists anywhere in the repository — `public/` contains only `404.html`. Both the
base-path-relative and root URLs return 404 on the deployed site, so browsers fall back to a
default tab icon.

Two separate small problems in one line:

1. **The file is missing.** Adding `public/favicon.svg` would fix the 404.
2. **The path would still be wrong once it exists.** The `href` is a root-absolute `/favicon.svg`,
   which does not pick up `VITE_BASE_PATH`, so on GitHub Pages it would resolve to
   `nickarrow.github.io/favicon.svg` rather than `.../mita-ssa-tool/favicon.svg`. Use
   `%BASE_URL%favicon.svg`, which Vite substitutes at build time.

Purely cosmetic, and worth about ten minutes. Flagged because a missing tab icon is the kind of
detail that registers during a "is this polished enough to ship" review, which is exactly the
gate this tool is heading into. Reasonable to fold into Wave 8 alongside the PWA manifest work,
which needs an icon set anyway.

### OBS-29 — `MaturityLevelSelector` announces a radiogroup it does not implement

**Confirmed** by keyboard-driving the real control in Chromium (Wave 4 audit), not merely by
reading markup. This is the most-used control in the app: every one of the 26 aspects is
rated through it.

`src/components/assessment/MaturityLevelSelector.tsx` puts `role="radiogroup"` on a `Box`
and `role="radio"` on six `Paper` elements (five levels plus N/A). Three distinct problems,
in increasing order of severity:

| Problem                                                                                           | Measured behaviour                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No arrow-key navigation.** The ARIA radiogroup pattern requires it                              | `ArrowDown` and `ArrowRight` with a radio focused leave focus exactly where it was. Only `Enter`/`Space` do anything                                                                                                                 |
| **No roving tabindex.** All six radios carry `tabIndex={0}`                                       | The correct pattern is one tab stop per group. Measured: Tab order runs radio L1 → To-Be L1 → radio L2 → To-Be L2 …, so **11 stops per aspect** — six rows plus the five To-Be checkbox inputs (Not Applicable has no To-Be control) |
| **A checkbox nested inside `role="radio"`.** axe reports `nested-interactive` at _serious_ impact | ARIA gives `radio` **presentational children**, so the To-Be checkbox's role is erased for assistive tech even though it remains focusable                                                                                           |

On a ten-aspect Information dimension that is 110 tab stops to cross the page.

**The important nuance: the control is operable, not unusable.** A keyboard user can Tab to a
level and press Enter or Space to select it, and can Tab to the To-Be checkbox and press
Space. What is broken is the _contract_ — the control tells a screen reader it is a radiogroup,
then does not behave like one, and the To-Be affordance is announced as nothing in particular.
So this is a WCAG 4.1.2 (Name, Role, Value) problem rather than a 2.1.1 (Keyboard) one.

**Why it was not fixed in Wave 4.** Restructuring it is real surgery on the control every
pilot state uses to enter data, it has **no test file**, and Drop 1 is a _reviewable_ build
rather than a cleared one. Deliberately deferred for a decision instead of being rushed.

**Resolved**, on the instruction to fix it properly rather than defend it.

A 28-test file was written **first**, against the old implementation, to establish a
behavioural baseline: 12 passed and 13 failed, and the 13 failures were exactly the defects
above. That baseline is what made the rewrite safe on a control with no prior coverage.

| Before                                                        | After                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `role="radiogroup"` / `role="radio"` on `div`s                | Native `<input type="radio">`, two groups distinguished by `name`                   |
| Arrow keys inert                                              | Browser-native: arrows move focus **and** select, both directions, within the group |
| `tabIndex={0}` on all six rows, checkbox interleaved          | Roving tabindex from the browser. Measured in Chromium: **2 tab stops, was 11**     |
| To-Be checkbox nested inside `role="radio"`                   | To-Be is a **sibling** radio group, never a descendant                              |
| To-Be modelled as a checkbox that toggled off when re-clicked | Modelled as what it is — single-select-or-none — with an explicit clear button      |

Two details worth carrying into anything similar:

- **Radio grouping is by `name`, not by DOM ancestry.** The assessment page renders one
  selector per aspect and several can be expanded at once, so names derive from `useId()`. A
  shared name would have merged every aspect into a single group, and choosing a level for one
  aspect would silently clear another. A test asserts two instances never share names.
- **One `fieldset` wraps both groups**, because they interleave row by row so neither can own a
  fieldset of its own. Each radio therefore carries a self-describing accessible name — the
  To-Be ones include the level, since the visible text is just "To-Be" on every row.

The visual layout is essentially unchanged: one row per level, selection control on the left,
To-Be flag on the right.

**A caveat on the tab-stop measurement.** jsdom does not implement the roving tabindex for a
radio group with nothing checked — it lets Tab visit every unchecked radio, where Chrome
exposes only the first. So the 12-to-2 figure is measured in Chromium, and the jsdom test
asserts the count only in the state where both engines agree (both groups having a checked
member). Do not "fix" a tab-stop count by trusting jsdom here.

### OBS-30 — Twelve colour pairs fail WCAG 1.4.3, and the causes are structural not incidental

**Confirmed** by measurement in Chromium with axe-core 4.11.1 (Wave 4). Worth stating plainly
why this could not have been caught by the test suite: **axe cannot evaluate contrast under
jsdom** — it needs a canvas to sample rendered pixels — so every `toHaveNoViolations()`
assertion in this repo silently skips the contrast rule.

| Ratio      | Foreground / background | Needs | Where                                                 | Root cause                                                  |
| ---------- | ----------------------- | ----- | ----------------------------------------------------- | ----------------------------------------------------------- |
| 2.09:1     | `#02bfe7` on `#fafafa`  | 4.5:1 | Outlined secondary chips ("Organization-wide"), Guide | `secondary.main` is a light cyan, unusable as text on white |
| 2.15:1     | `#ff9800` on `#ffffff`  | 3:1   | 60px score number, AreaResults                        | `getScoreColor` returns raw orange                          |
| 2.15:1     | `#ffffff` on `#ff9800`  | 4.5:1 | Score chips                                           | Same colour, used as a chip fill with white text            |
| 2.33:1     | `#c48f00` on `#e9e8d8`  | 4.5:1 | Sidebar partial-progress chip                         | `warning.dark` on `alpha(warning.main, 0.15)`               |
| 2.67:1     | `#9e9e9e` on `#ffffff`  | 4.5:1 | Tag helper text                                       | `grey.500` used for 12px body copy                          |
| 3.15:1     | `#0095b6` on `#ebf4fa`  | 4.5:1 | To-Be chips                                           | `secondary.dark` on a tinted row                            |
| 3.32:1     | `#0095b6` on `#f5f9fc`  | 4.5:1 | To-Be chips                                           | Same                                                        |
| 3.37:1     | `#2e8540` on `#cae1dd`  | 4.5:1 | Sidebar complete chip                                 | `success.main` on `alpha(success.main, 0.15)`               |
| 3.67:1     | `#2e8540` on `#dbe9de`  | 4.5:1 | Sidebar complete chip                                 | Same, different blend                                       |
| 3.82:1     | `#2e8540` on `#e0ede2`  | 4.5:1 | Sidebar complete chip                                 | Same, different blend                                       |
| 4.16:1     | `#0071bc` on `#d9eaf5`  | 4.5:1 | "AGG" chip, 11.2px                                    | `primary.main` on `alpha(primary.main, 0.15)`               |
| **4.31:1** | `#ffffff` on `#1a7fc3`  | 4.5:1 | **Active header nav button, 5 pages**                 | `rgba(255,255,255,0.1)` overlay _lightens_ `primary.main`   |

Three recurring patterns, which is what makes this structural:

1. **`alpha(X, 0.15)` background with `X` as the foreground.** Tinting a colour toward white
   and then writing in that same colour cannot reach 4.5:1 — the two move together. Affects
   every sidebar progress chip and the AGG chip. The fix is a darker text token
   (`success.dark`, `primary.dark`) rather than a different background.
2. **`secondary.main` `#02bfe7` and `warning.main` `#fdb81e` are decorative-only colours**
   being used as text. Neither can pass on white at any size the app uses.
3. **The active nav button is lightened, not darkened.** `Layout.tsx` marks the current page
   with `rgba(255,255,255,0.1)`, which raises the background luminance just enough to drop
   white text from 4.68:1 (inactive, passing) to 4.31:1 (active, failing). Darkening instead —
   `rgba(0,0,0,0.16)` — both fixes the contrast and still reads as selected. This is the
   cheapest single fix in the table and covers five pages.

Deferred out of Wave 4 because every item changes visible colour, and Shelley and Chris were
mid-review of the deployed build at the time. Needs one deliberate batch, not a trickle.

**Resolved.** Fixing the root causes rather than the reported instances found the count above
was **too low**, because axe can only measure what happens to render:

- **All five `SCORE_COLORS` failed in every role**, at 2.16:1 to 3.68:1 — not the two axe
  flagged. They are used as chip fills behind white text, as text on white, and as chart
  fills; the same luminance constraint governs all three, so one value per band serves all.
  The palette's own docstring had asserted AA compliance.
- **`info` was never defined in the theme**, so MUI's default `#0288d1` was in play: 3.86:1 as
  chip text and 3.41:1 as an Alert icon, the latter under even the 3:1 non-text floor.
- **Alert icons are painted from `palette[severity].main`**, a fill-grade token. Every severity
  failed: warning 1.65:1, info 3.41:1, error 3.98:1, success 4.08:1.
- **Outlined chips take text _and border_ from `.main`** too, so `success` and `warning` chips
  failed on the page background.
- Two more only reachable in transient states: `success.main` at 4.24:1 on a hovered Dashboard
  row, and `#1b5e20` at 3.91:1 against the darker stripe of the striped progress bar.

Fixed at the source rather than per call site: theme `MuiChip` and `MuiAlert` overrides
redirect to the `.dark` tokens, so the pattern is corrected wherever it appears. The fourth
independent `getScoreColor` (in `AggregateDimensionView`) now delegates to the shared one.

Verified 0 `color-contrast` violations in Chromium across 11 routes and 9 interaction states.
Contrast is now pinned by tests that compute real ratios — necessary because **axe cannot
check contrast in this suite at all**: it needs a canvas to sample rendered pixels, which jsdom
does not provide, so every `toHaveNoViolations()` silently skips the rule.

**Documented trade-off.** Forcing all five bands to ~5:1 against white puts them at similar
luminance: they differ from each other by at most 1.21:1, and amber from red by 1.08:1, which
is plausibly confusable under protanopia. Acceptable only because colour is never the sole
carrier of meaning — chips print the score beside the colour, and the two bar charts encode
value as length against a labelled axis. The charts print **no** numbers, so the axis is
load-bearing. A test pins the constraint.

### OBS-33 — Every aspect's level selector renders even when its panel is collapsed

**Confirmed** by a measurable test-timing regression, then by reading the markup.

`AspectCard` renders a MUI `Accordion` with no `unmountOnExit` on the transition, so the
contents of every collapsed aspect panel stay mounted. That was already true before OBS-29 —
the old selector mounted five real checkbox inputs per aspect — but the rewrite raises the count
per aspect from 5 to 11, so a five-aspect dimension goes from 25 to 55 mounted inputs and the
ten-aspect Information dimension mounts 110, essentially all of them invisible. Roughly 2.2×,
not a change from nothing.

The symptom that surfaced it: `Assessment.test.tsx`'s OBS-6 test types into a notes field, and
`user.type` re-renders the page per keystroke. With a 22-character string it began exceeding its
4s gate on roughly **one full-suite run in three** — a flake that had never reached the full
suite before (contrast OBS-27, which is about two-file runs). Shortening the typed string
restored stability across four consecutive runs, but that treats the symptom.

Fix shape: `slotProps={{ transition: { unmountOnExit: true } }}` on the `Accordion`.

**Not done here, deliberately.** MUI's `Collapse` unmounts its own wrapper when exited, and
that wrapper is the element carrying `id="aspect-<id>-content"` — the target of the summary's
`aria-controls`. Removing it leaves `aria-controls` pointing at a non-existent id, which needs
its own accessibility verification. Landing that the day before a stakeholder drop was the wrong
trade. Worth doing next, with an axe pass over the expanded and collapsed states.

### OBS-31 — `ResultsMasterDetail`'s tree needs `Collapse` nested inside the `li`, not beside it

**Resolved in Wave 4.** Recorded because the wrong fix and the right fix look almost
identical, and the wrong one passes typecheck, lint and the whole test suite.

The nav panel is a three-level expandable tree (layer → domain → area) built from MUI
`List` / `ListItemButton` with `Collapse` between levels. `Collapse` renders a `div`. Three
shapes, two of which are invalid:

| Shape                                                               | Result                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Bare `ListItemButton` as a child of `List` (the original)           | `ul` has `div[role=button]` children → `aria-required-children`, **critical**                |
| Rows wrapped in `ListItem`, `Collapse` as a **sibling** of the `li` | the domain and area `li`s land inside the `Collapse` div → `listitem`, **serious**, 14 nodes |
| Rows wrapped in `ListItem`, `Collapse` **nested inside** the `li`   | **valid** — this is what shipped                                                             |

The second shape is what the first Wave 4 attempt produced, and it was briefly documented
here as proof that valid list markup was impossible. That was wrong. An `li` accepts flow
content, so the `Collapse` can live _inside_ it, and each level then gets its own `ul`:

```jsx
<List>                                     {/* ul */}
  <ListItem disablePadding sx={{ display: 'block' }}>   {/* li */}
    <ListItemButton … />
    <Collapse in={expanded} unmountOnExit>
      <List disablePadding dense>          {/* ul, inside the li */}
        …                                  {/* same pattern one level down */}
      </List>
    </Collapse>
  </ListItem>
</List>
```

`display: block` on the `ListItem` is required — its default is `flex`, which would put the
button and its `Collapse` side by side. MUI's `List` sets `list-style: none`, so no marker
appears.

**The lesson is about the verification loop, not the markup.** The invalid shape was caught
only by re-running axe in a browser after the fix; typecheck, lint and 558 tests were all
green on it. `ResultsMasterDetail.test.tsx` now asserts that every `ul` contains only `li`
children and that no `li` is orphaned, in the collapsed, domain-expanded and layer-collapsed
states.

Still open, and a better long-term answer: the ARIA **tree** pattern (`role="tree"` /
`treeitem` / `group` with arrow-key traversal) fits an expandable hierarchy better than
nested lists, and MUI's `SimpleTreeView` implements it. Worth pairing with the `height: 600`
clipping noted under OBS-16.

### OBS-32 — `variant="subtitle1|subtitle2"` silently emits `<h6>`, and it broke heading order on seven pages

**Confirmed** on seven of twelve routes by axe (Wave 4); fixed in that wave, recorded here
because the trap is still live for new code.

MUI's default `variantMapping` maps `subtitle1` **and** `subtitle2` to `h6`, and `h1`–`h6`
variants to their matching tags. So `<Typography variant="subtitle2">` renders a real
document heading unless an explicit `component` overrides it. 18 sites existed; only 3 set
`component`. The visible result was heading outlines like `h1 → h6` (Dashboard, Guide) and
`h2 → h3 → h6` (assessment pages).

Two sharper edges found along the way:

- **MUI 6.5 wraps `AccordionSummary` in `<h3 class="MuiAccordion-heading">`.** Every aspect
  card therefore had a `<h6>` (`AspectCard`'s `subtitle1` aspect name) nested _inside_ an
  `<h3>` — a heading inside a heading. Not obvious from the JSX, since nothing in this repo
  writes that `h3`.
- **Score values were headings**, in four files: `AggregateDimensionView`, `AreaResults`,
  `DomainResults` and `ResultsMasterDetail` all rendered big numbers with `variant="h2"`,
  `"h3"` or `"h4"`, so "3.2" was announced as document structure. `ResultsMasterDetail` also
  rendered the literal arrow glyph `→` between As-Is and To-Be as an `<h5>`, and two empty
  states ("No Data Available", "No Assessment Results") as headings under an `<h2>`.
- **Half the sites were only reachable by interaction.** The `ResultsMasterDetail` detail
  panel renders nothing until a domain or area is clicked, and selection is component-local
  state rather than URL state (OBS-12). A route-by-route sweep sees only the placeholder and
  reports clean, which is exactly what the first Wave 4 pass did.

**Guidance for new code:** treat `variant` as styling only, and always pass `component`
explicitly on `Typography` — `component="p"` or `"span"` for text that merely looks like a
heading, or the correct `component="hN"` for a genuine section heading. Worth adding to the
steering file's React patterns section.

### OBS-34 — Hardcoded element ids in components that render many times

**Confirmed** twice, in two different components, both found only by expanding panels.

Two components baked fixed `id` values into markup that renders once per aspect:

| Component           | Hardcoded ids                                                  | Result on a five-aspect dimension                |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `AspectCard`        | `aspect-<id>-content` **plus** `role="region"`                 | Duplicated MUI's own accordion region and its id |
| `QuestionChecklist` | `evidence-header` / `evidence-content`, and the questions pair | 5 identical ids; 5 landmarks all named the same  |

Both produced duplicate DOM ids and `landmark-unique` violations, and in the
`QuestionChecklist` case every region's `aria-labelledby` resolved to the _first_ matching
header, so four of the five panels were mislabelled for assistive technology.

Both are fixed — `AspectCard` by deleting the manual attributes, since MUI's `Accordion`
already renders a correctly-wired `div.MuiAccordion-region`, and `QuestionChecklist` by
deriving ids from `useId()`. With all five aspects and their evidence panels expanded there are
now zero duplicate ids, verified by enumerating every `id` in the document.

**The general point, which is the reason this is logged rather than just fixed:** a hardcoded
`id` in a React component is a latent bug the moment that component can render more than once,
and it is invisible until two instances are on screen together. Both instances here were behind
an expand interaction, which is why a route-level audit missed them. Prefer `useId()`, and
check whether the UI library already provides the wiring before adding `id`/`role` by hand.

A related trap in the same class: `useId()` returns values like `:r3:`. Colons are legal in an
`id` or `name` attribute but break unescaped CSS attribute selectors, so strip them.

### OBS-35 — Arrow-key level selection writes once per step, over a non-atomic upsert

**Confirmed** as a mechanism by reading the code; **not reproduced** — six rapid arrow presses
did not trigger it. Surfaced by the OBS-29 review.

Native radio groups select as focus moves, which is correct and expected behaviour. The
consequence here is that arrowing from Level 1 to Level 5 fires `onAsIsChange` four times, so
four saves are dispatched in as many milliseconds. Before OBS-29 the only way to change a level
was a deliberate click per row, so this rate was not reachable.

Three things line up badly underneath:

- `updateLevel` in `useOrbitRatings.ts` is a read-then-write upsert: it resolves the existing row
  via `findExistingRating` and then either updates or adds. Two interleaved calls for an aspect
  with **no** existing row can both observe "missing" and both `add`.
- `runSave` in `Assessment.tsx` does not serialise; nothing queues or debounces level writes the
  way `useDebouncedSave` does for text.
- The compound index in `db.ts` is declared `[capabilityAssessmentId+dimensionId+aspectId]`
  without a leading `&`, so it is **not** unique and the database will not reject a duplicate.

The window is a single Dexie round trip and only exists on the first rating for an aspect, which
is presumably why it has never been seen. But the failure mode is duplicate `orbitRatings` rows
for one aspect, which would then double-count in `getAssessedCount` and skew a dimension average
— a data-integrity bug in the artifact states submit to CMS, not just a cosmetic one.

Cheapest durable fix is the schema: make the compound index unique (`&[...]`) so the database
enforces what the code assumes. That is a Dexie version bump, and every previous version bump in
this project has been a clean-break that clears all tables, so it is not free — it needs to ride
along with a migration that is happening anyway. Debouncing level changes, or serialising writes
per aspect, would narrow the window without a schema change.

Worth deciding before real state data exists rather than after.
