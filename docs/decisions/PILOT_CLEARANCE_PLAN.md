# Pilot Clearance Plan — Draft Banner, Accessibility, and XLSX Workbook

**Created:** September 9, 2026
**Status:** In progress — all decisions resolved
**Driver:** MITA 4.0 pilot cannot start until the tool and the spreadsheet both pass CMS internal clearance
**Target dates:** two drops, agreed September 9

- **Drop 1 — Friday, September 12:** Waves 1-5 (the tool: content fixes, data integrity,
  banner everywhere including exports, accessibility). Lets Shelley begin reviewing the tool
  without waiting on the workbook.
- **Drop 2 — Wednesday, September 17:** Waves 6-8 (the workbook, CI delivery, PWA, docs).

Backstop for both: the ISM conference at end of September. Neither date means "cleared" —
CMS internal 508 review is a separate gate on their clock. Excel is available locally, so
Wave 7 arithmetic verification is an in-house loop rather than a multi-day round trip.
**Working branch:** `feature/pilot-clearance`, cut from `feature/capability-model-v4` @ `33e7963` (v4.0.0)
**Reference implementation:** `feat-xlsx-workbook-generation` @ `b0fc55d` — reference only, never rebase (Decision 6)

Scope record and working plan for the four workstreams committed in the September 9
meeting. Check off tasks as they complete. Every wave ends with the repo green.

---

## 1. Session Recovery Protocol

**Read this section first if you are resuming with no prior context.**

1. Read this file top to bottom. Section 4 is the source of truth for decisions;
   Section 6 is the source of truth for progress.
2. Find the first wave with unchecked boxes. That is the current position.
3. Confirm the actual repo state before trusting the checkboxes — they can lag:
   ```
   git branch --show-current && git status --short && git log --oneline -5
   npm run typecheck && npm run lint && npm test
   ```
4. Background you will need but that is not in this file:
   - `docs/CODEBASE_OBSERVATIONS.md` — the audit backlog; `OBS-*` IDs referenced here
   - `docs/decisions/CAPABILITY_MODEL_UPDATE_PLAN.md` — the v4 model and its decision log
   - `.kiro/steering/development-standards.md` — coding standards. **Note: its domain/area
     counts are wrong until OBS-17 is done (Wave 1). Trust `src/data/*.json` over it.**
5. Update the checkboxes in Section 6 as you go, and append anything learned to
   Section 8 (Working Notes) so the next session inherits it.

---

## 2. Executive Summary

Four workstreams, one gate. CMS internal clearance ("clearance" here means internal
review, not the 12-week PRA process) covers both the web tool and a new offline
spreadsheet. Pilot state recruitment is already underway and the schedule is being
reverse-engineered off this plan's delivery date.

| #   | Workstream                                                    | Why                                                               | Size         |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ |
| A   | Red draft disclaimer banner on every page and in every export | AJ requires unambiguous draft markers                             | Small        |
| B   | Accessibility audit and remediation (508 + WCAG 2.1 AA)       | Same reviewer gate as the spreadsheet                             | Small–medium |
| C   | XLSX workbook generated from the data model in CI             | Offline alternative to the tool; must be 508 compliant            | Medium–large |
| D   | Selected fixes from `CODEBASE_OBSERVATIONS.md`                | Content accuracy and data integrity before real states enter data | Small        |

Workstream D exists because Shelley and Chris are reviewing the dev branch **this
week**. Anything that makes the tool look wrong or lose their input during that review
generates noise and rework, so it goes first.

### Standing constraint: parity

The workbook must match the tool's content, functionality, and accessibility (Decision 7).
"Functionality" specifically includes the scoring rules — a state must not get one score
from the tool and a different score from the spreadsheet with the same inputs. This is
the highest-risk part of workstream C and Section 5.4 addresses it directly.

---

## 3. Sources

| Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Authority                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Meeting transcript, September 9, 2026 (Nick, Shelley, Sean)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Commitments and design direction. Cited as `[mm:ss]`                                                      |
| Nick's follow-up answers, September 9                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Resolved Decisions 4–9                                                                                    |
| `docs/CODEBASE_OBSERVATIONS.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Audit of September 9, 2026                                                                                |
| `feat-xlsx-workbook-generation` @ `b0fc55d`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Prior experiment; reference implementation for workstream C                                               |
| [Section508.gov — accessible spreadsheets](https://www.section508.gov/blog/accessibility-bytes/accessible-spreadsheets/), [FEMA Excel 2016 checklist](https://training.fema.gov/devres/docs/508/checklists/AEDCOP%20MS%20Excel%202016%20Accessibility%20Checklist.pdf), [CMS Excel 508 guide](https://www.cms.gov/research-statistics-data-and-systems/cms-information-technology/section508/downloads/508-how-to-guide-excel2010.pdf), [Microsoft accessibility best practices](https://support.microsoft.com/en-us/office/accessibility-best-practices-with-excel-spreadsheets-6cc05fc5-1314-48b5-8eb3-683e49b3e593) | Spreadsheet 508 requirements in Section 5.3. Content rephrased for compliance with licensing restrictions |

The transcript double-logs speakers — `[You]` lines often echo `[Others]`. Attribution
below follows first occurrence. Notably "I would do it in red" is Shelley's, not Nick's.

---

## 4. Decision Log

### Resolved

| #   | Decision                                                                                                                                            | Source                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Draft banner is red, at the top, on every page. Precedent: the draft guidance site used red                                                         | Shelley `[07:14]`                         |
| 2   | Copy conveys "draft version of the tool, still being piloted." Exact prior wording not required                                                     | Shelley `[07:08]`                         |
| 3   | Banner is visible but not alarming — no flashing, no bright-red alarm styling                                                                       | Nick `[06:20]`                            |
| 4   | **The draft notice also appears in exports** (PDF, CSV, XLSX) for consistency                                                                       | Nick, follow-up                           |
| 5   | **The notice must be easily removable** so CMS can drop it at go-live                                                                               | Nick, follow-up                           |
| 6   | **Blank workbook only.** Live-data XLSX export and XLSX import are deferred — they over-complicate this delivery                                    | Nick, follow-up; aligns with `[12:34]`    |
| 7   | **Focus is parity** with existing content, functionality, and accessibility                                                                         | Nick, follow-up                           |
| 8   | **No rebase of `feat-xlsx-workbook-generation`.** It was an experiment; harvest what is useful                                                      | Nick, follow-up                           |
| 9   | **Accessibility audit is in scope**, bundled with the banner work                                                                                   | Nick, follow-up; committed at `[22:15]`   |
| 10  | Workbook download is linked from the homepage as well as Import/Export                                                                              | Nick, follow-up                           |
| 11  | Deployment stays a manual `workflow_dispatch` of the Pages action from the feature branch                                                           | Nick, follow-up                           |
| 12  | Workbook is generated at build time as a Node script, not client-side. Keeps ExcelJS out of the browser bundle as a devDependency                   | Plan recommendation, accepted `[25:33]`   |
| 13  | Banner removal is controlled by `VITE_DRAFT_MODE`, defaulting to draft-on. Follows the existing `VITE_BASE_PATH` / `VITE_GITHUB_REPO_URL` precedent | Plan default under Decision 5             |
| 14  | Workbook filename is stable and unversioned so the guidance-site URL never breaks; the version is printed inside the workbook                       | Plan default; addresses Shelley `[10:08]` |

### Resolved — formerly pending

| #      | Decision                                                                                                                                                                                                                                                                                                                                                                        | Source          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **P1** | **Aggregate dimensions: full parity (option a).** Omit Information input rows for Data Management areas and Technology input rows for Technology Management areas; compute the aggregate on the profile sheet by formula, mirroring `getAggregateDimensionScore`. Fallback if the formulas prove brittle: show "—" with an explanatory note, and record the change in Section 8 | Nick, follow-up |
| **P2** | **Accessibility: fix what is safe, report the rest, no formal ACR.** Build to WCAG 2.1 AA and verify with our own automated plus manual testing. The goal is an artifact that reasonably passes accessibility testing; CMS runs the official 508 review. **Applies to both the app and the workbook**                                                                           | Nick, follow-up |
| **P3** | **One branch: `feature/pilot-clearance`**, cut from `feature/capability-model-v4`. Single developer, single deployable; the manual dispatch switches to this branch                                                                                                                                                                                                             | Nick, follow-up |

Consequence of P2 for the workbook: there is no axe equivalent for XLSX, so the 508
requirements in Section 5.3 become **assertions in the test suite** — no merged cells,
one header row per table, no blank rows or columns inside tables, document properties
populated, no floating objects, and editable columns labeled in text rather than by fill
colour alone. Excel's own Accessibility Checker is the manual complement (Wave 7).

### Pending — raised by the Wave 0 review

| #      | Question                                                                                                                                                                                                                                                                                                                                                                     | Recommendation                                                                                                                                                                                                                 | Blocks |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **P4** | **The app is advertised as an offline-first PWA but has no service worker** (OBS-22). `vite-plugin-pwa` is installed and unused, and `knip.json` silences it. Landing and Guide both promise "Works Offline — full functionality after initial load." A reload without network fails. States are being recruited on this premise now. Wire up the PWA, or remove the claims? | **Wire it up.** The dependency is already present, so it is roughly config plus manifest plus registration. Use prompt-on-update rather than silent auto-update so pilot users are not served a stale cached build unknowingly | Wave 8 |

### Noted, not decided

- **OBS-5 (stale enterprise-domain scores).** A finalized Data Management score does not
  change when other domains are later finalized, but the results table recomputes the
  aggregate live, so the two can disagree. During a pilot, states finalize over weeks —
  this will be visible. Needs a product decision (recompute on read, or label as a
  point-in-time snapshot) before the pilot, but is not code work in this plan.
- **OBS-18 (placeholder descriptions).** 14 areas still carry
  `[Placeholder — pending updated Capability Reference Model]`. Deliberate, pending
  NextGen's document. Should be called out to Shelley and Chris so they do not report it
  as a defect.
- **`src/data/templates/maturity-profile-template.csv`** may be retirable — Shelley said
  the manual blank CSV profile could be "negated" if the workbook produces a profile
  (`[14:38]`–`[15:30]`). Confirm before deleting.

---

## 5. Specifications

### 5.1 Draft banner

**Placement.** Directly below the `AppBar` in `Layout.tsx`, above `<main>`, so it is
inside every route with no per-page work.

**Critical constraint.** `Layout.tsx` is `height: 100vh; overflow: hidden`, and the
assessment page is a fixed-height working area with internal scrolling (its footer is
already suppressed). The banner permanently reduces that space. Requirements: single
line, target 32–36px, no icon, no dismiss control, `flexShrink: 0`.

**Color.** `theme.palette.error.dark` (`#b0142f`) with white text — roughly 7:1 contrast.
`error.main` (`#e31c3d`) computes to about 4.7:1, which passes AA with almost no margin.
Verify measured values during Wave 4 rather than trusting arithmetic.

**Accessibility.** Do **not** use `role="alert"` — it is assertive and would interrupt
screen reader users on every navigation. Use a labeled region read in document order.
This matters more than usual because Wave 4 claims an accessibility audit.

**Copy.**

> **Draft** — This is a draft version of the MITA 4.0 State Self-Assessment Tool. It is
> still being piloted and is subject to change.

**Removal mechanism (Decision 13).** One module exports both the flag and the text so
every surface — app, PDF, CSV, XLSX — reads from the same place:

```ts
export const IS_DRAFT = import.meta.env.VITE_DRAFT_MODE !== 'false';
export const DRAFT_NOTICE_TITLE = 'Draft';
export const DRAFT_NOTICE_BODY =
  'This is a draft version of the MITA 4.0 State Self-Assessment Tool. ' +
  'It is still being piloted and is subject to change.';
```

Default-on means forgetting to set the variable fails toward showing the disclaimer.
Go-live is then one workflow variable, no code change. The Node workbook script reads
`process.env.VITE_DRAFT_MODE` for the same result. `src/vite-env.d.ts` needs the
`ImportMetaEnv` declaration.

**Export surfaces.**

| Artifact   | Placement                                                                           |
| ---------- | ----------------------------------------------------------------------------------- |
| PDF        | Cover page band, plus the per-page footer line                                      |
| CSV        | A notice line above the existing `MITA 4.0 Maturity Profile: <state>` header        |
| XLSX       | Prominent row on the README sheet; also the workbook `description` property         |
| JSON / ZIP | A `draftNotice` field in the export envelope, and a line in the ZIP `manifest.json` |

CSV placement is constrained: `parseMaturityProfileCsv` reads the state name from `lines[0]`
specifically (`csvExport.ts:141-143`), so a notice **above** that line makes every parsed
state name `Unknown`. Put the notice on the line _after_ the
`MITA 4.0 Maturity Profile: <state>` header, padded to full width with the existing `,,,,,`
convention, and teach the parser to skip it. Worth knowing: `parseMaturityProfileCsv` is not
exported from `services/export/index.ts` and has no consumer outside its own test, so the
round-trip constraint is currently hypothetical — but leaving the parser broken would trap
whoever wires CSV import later.

**Skip-link gap.** `Layout.tsx:43` skips to `#main-content`, so a banner above `<main>` sits
outside that target and skip-link users never encounter it. Putting the banner inside
`<main>` is not viable — `<main>` scrolls on non-assessment pages, so the notice would scroll
away. Resolution: keep the banner above `<main>` and additionally append `(Draft)` to the
document title, which assistive tech announces on load regardless of the skip link.

### 5.2 Workbook structure

Build-time Node script → `public/` → Vite copies to `dist/`. Sheet design adapted from
the reference implementation, with the 508 corrections in 5.3 and the v4 model applied.

| Sheet                         | Rows  | Purpose                                                                                         |
| ----------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `00_README`                   | ~24   | Draft notice, model + app version, generation date, how to use, sheet index, Info Mgmt guidance |
| `01_Maturity_Levels`          | 6     | Levels 1-5 plus N/A, names and descriptions                                                     |
| `02_Capability_Reference`     | 72    | One row per area; domain name, layer, and domain description repeat as columns                  |
| `03_ORBIT_Criteria_Reference` | 205   | 41 aspects x 5 levels: criteria text and suggested documentation                                |
| `04_Assessment_Input`         | 1,625 | One row per assessable aspect per standard capability area                                      |
| `05_Organizational_Input`     | 15    | The `enterprise-governance` aspects, with section as a column                                   |
| `06_Maturity_Profile`         | 228   | 213 standard rows (71 areas x 3 dimensions) + 15 organizational aspect rows                     |
| `07_Area_Scores`              | 72    | One row per capability area: score, completion, domain                                          |
| `08_Domain_Scores`            | 15    | 14 domain rows + 1 overall row                                                                  |

Row counts computed from `src/data/*.json`; regenerate if the model changes.

`04_Assessment_Input` is 1,625 rather than 71 x 26 = 1,846 because aggregate-dimension
rows are omitted under P1(a): Data Management's 10 areas skip 10 Information aspects,
Technology Management's 11 areas skip 11 Technology aspects.

**Every input and profile row carries both As-Is and To-Be columns.** `targetLevel` is a
first-class feature in the tool — stored per rating, edited via the per-row To-Be control,
surfaced in results, and already a column in the CSV maturity profile — so Decision 7 puts
it in scope.

**Score rollups live on their own sheets, not as extra rows in the profile.** `06` is one
row per area-and-dimension so it mirrors the CSV profile shape. Area, domain, and overall
rollups go on `07` and `08`, each a clean single-header-row table. Technology sub-dimension
means are two extra **columns** on `06`, populated only on Technology rows — no extra rows,
no merged cells.

**`03` has no "question" column.** All 205 per-level `questions` arrays in the model are
empty (OBS-23), so such a column would be entirely blank and would fail the
no-empty-columns rule in 5.3.

**Information Management parity.** 11 areas carry `informationManagement: true` and show
in-app guidance to assess information maturity once in that area and skip the Information
dimension in the domain's other areas. Without an equivalent, a state filling in the
workbook produces different input data than the same state using the tool. `02` and `04`
therefore carry an `Information Management` flag column, and `00_README` reproduces the
guidance text.

**Carry forward from the reference implementation:** the declarative `constants.ts`
column/header/width model (important — Shelley's team may edit the generated file and
send it back for folding in, `[20:03]`–`[20:29]`, so layout should be config not code);
level dropdowns via data validation with `N/A` as a token; hidden stable ID columns;
sheet protection with `selectLockedCells: true`; the `AVERAGEIFS` / `TEXTJOIN` formula
techniques.

**Do not carry forward:** `categoryName` / `categoryId` columns (the tier was deleted in
v4); the three-separate-org-types model (v4 has one area with three sections);
`buildProfilePlan`'s `section` / `domain` / `area` / `blank` label-row shape (see 5.3).

### 5.3 508 requirements for the workbook

Non-negotiable, and the reason the previous spreadsheet was rejected. Shelley's account:
a visually polished workbook was rewritten to look "like something from 1986," with
merged cells, images, and colors specifically called out (`[20:53]`–`[22:09]`).

| Requirement                                         | Implementation                                                                                                                                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No merged cells in data tables                      | Remove all 5 `mergeCells` calls. CMS guidance permits merging in the first row only; simplest to avoid it entirely                                                                                                               |
| Single header row per table, no multi-level headers | One frozen header row; no stacked or spanning headers                                                                                                                                                                            |
| No blank rows or columns inside tables              | Replace the reference implementation's `blank` spacer rows with real `Domain` / `Capability Area` / `Dimension` columns. This also makes autofilter work and simplifies future import                                            |
| Information not conveyed by color alone             | Append "(enter value)" to editable column headers rather than relying on the yellow `INPUT_FILL`                                                                                                                                 |
| Descriptive sheet tab names                         | Keep the numeric-prefix convention; hyphens and underscores are acceptable                                                                                                                                                       |
| No images or floating objects                       | None. Charts belong in the tool, not the workbook                                                                                                                                                                                |
| Document properties set                             | `title`, `subject`, `description`, `creator`, `category`                                                                                                                                                                         |
| Header/footer info duplicated in-sheet              | Anything in print headers also appears as sheet content                                                                                                                                                                          |
| Locked cells remain reachable by AT                 | Keep `selectLockedCells: true` — disabling it hides reference content from keyboard and screen reader users                                                                                                                      |
| ID columns are visible, not hidden                  | Hidden columns inside a table range conceal content from assistive tech and get flagged. Put the stable ID columns at the far right, narrow, with real headers, and **outside** the named table range — do not use column hiding |
| Defined table ranges                                | Named ranges per input table, aiding both navigation and formulas                                                                                                                                                                |

Flattening the profile sheet is the key move: it is simultaneously the 508 fix, better
for screen readers, and better for a future import. The old file's ugliness came from
retrofitting a merged-cell presentation layout; building flat from the start avoids it.

### 5.4 Scoring parity — the real risk

The workbook formulas are a second implementation of the tool's scoring. **Rounding happens
at different points in different rollups**, and getting that wrong is how the workbook
silently disagrees with the tool. Authoritative source is `src/services/scoring.ts` plus
`useCapabilityAssessments.finalizeAssessment`.

| Rollup                   | Rule                                                                                                                                | Rounding                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Aspect                   | The entered level                                                                                                                   | n/a                                                      |
| Non-Technology dimension | Mean of assessed aspect levels                                                                                                      | round once                                               |
| **Technology dimension** | Mean of the **two sub-dimension means** — not a flat mean of 11 aspects                                                             | sub-dimension means **unrounded**, round once at the end |
| Standard area            | Mean of its dimension scores                                                                                                        | dimension scores **already rounded**, then round         |
| **Organizational area**  | Mean of the three section means; sections with nothing assessed are excluded, so sections weigh equally despite 6/5/4 aspect counts | section means **unrounded**, round once at the end       |
| Aggregate dimension      | Mean of the per-area dimension scores across non-enterprise areas                                                                   | per-area scores **already rounded**, then round          |
| Domain                   | Mean of its areas' scores                                                                                                           | stored (rounded) area scores, then round                 |

Exclusions, uniform everywhere: unassessed (`0`) and N/A (`-1`) are both left out of every
average. A dimension with no assessed aspects is **dropped** from the area average rather
than counted as zero — Excel's `AVERAGE` over blanks matches this, but the test suite must
assert it rather than assume it.

**Blocked on OBS-21.** The tool currently computes the Technology dimension two different
ways — `calculateDimensionScore` (unrounded sub-dimension means) versus
`getDimensionScoresForAssessment` (rounded sub-dimension means) — and they disagree by 0.1
on real inputs. The workbook cannot mirror both. OBS-21 is therefore pulled into **Wave 1**,
and `calculateDimensionScore` is the canonical rule the workbook implements.

**Known accepted divergences.** The workbook has no concept of assessment _status_, but two
tool rules depend on it: aggregate dimensions count only **finalized** assessments, and
domain scores count only **finalized** areas. A workbook aggregate necessarily includes
everything entered. This is unrepresentable rather than fixable, so it gets documented in
`00_README` and in the handoff note rather than engineered around.

**The aggregate formula must average per-area scores, not raw input cells.** A flat
`AVERAGEIFS` over every Information input cell weights areas by how many aspects they
filled in; the tool weights each area equally. The formula therefore averages the 50
per-area Information cells on `06_Maturity_Profile`, not the input range.

**Honest limitation.** ExcelJS does not evaluate formulas, so no unit test can assert that
a cell computes 3.4. Mitigation, strongest first:

1. Write a JS reference implementation of each formula's intent, test it against
   `calculateDimensionScore` over shared fixtures, and generate the formula strings from
   that same spec.
2. Snapshot-test the generated formula strings so range and criteria drift is caught.
3. Content-fidelity tests: every domain, area, dimension, sub-dimension, and aspect present
   with correct IDs and counts — the checks promised at `[19:39]`.
4. Manual confirmation in Excel. Must be requested of Shelley's reviewers as **arithmetic**
   validation, not look-and-feel, because steps 1-3 cannot cover it.

**Excel `ROUND` and JS `Math.round(x * 10) / 10` are not equivalent** on decimal halfway
values, because the JS form operates on accumulated binary floats. `4.05 / 3` yields `1.3`
in JS and `1.4` from Excel's `ROUND(...,1)`. Step 1 cannot catch this — it shares the JS
primitive. Wave 7 therefore includes a halfway-value fixture set for manual Excel
comparison, and records which primitive is authoritative.

### 5.5 Delivery and CI

- `scripts/generate-xlsx-workbook.mjs` reads `src/data/capabilities.json` and
  `src/data/orbit-model.json`, writes `public/mita-4.0-self-assessment-workbook.xlsx`
- `npm run build` runs the generator first, so local and CI builds are identical and
  `deploy.yml` needs no XLSX-specific step
- Generated artifact is gitignored — it is a build output, not source
- `ci.yml` runs the generator plus its validation tests so PRs catch model drift
- In-app download links: Import/Export page (primary), Landing page (Decision 10), Guide
- ExcelJS is a `devDependency`. It never enters the browser bundle of an offline-first
  PWA, and its supply-chain exposure is limited to CI. Worth knowing: upstream `exceljs`
  has been dormant since v4.4.0 (October 2023). Still MIT and widely used; acceptable for
  a build-time-only dependency, and active forks exist if fixes are ever needed

---

## 6. Waves

Each wave ends with `npm run typecheck && npm run lint && npm test` green. Do not start
the next wave with a red repo.

### Wave 0 — Setup and baseline

- [x] Resolve **P3** (branch strategy); create the branch — `feature/pilot-clearance`
      cut from `feature/capability-model-v4` @ `33e7963`
- [x] Record baseline (see Section 8 for the recorded numbers)
- [x] `.gitignore`: add the generated workbook path. `temp-transcript.md` no longer needs
      an entry — the user deleted it and keeps a backup outside the repo
- [x] Confirm `deploy.yml` supports `workflow_dispatch` from an arbitrary branch
- [x] Sub-agent review of the two planning docs before building on them — see Section 8b.
      Found 14 issues; all corrections applied. Produced OBS-21, OBS-22, OBS-23 and P4

### Wave 1 — Content accuracy (do first; Shelley and Chris are reviewing now)

- [x] **OBS-1** — organizational Enterprise Architecture aspects render as raw IDs in
      Results. Fix `DimensionScoresTableWithTarget.tsx:118` **and**
      `DimensionScoresTable.tsx:89`; derive the check from `ORGANIZATIONAL_SECTIONS` /
      `getOrganizationalAssessmentTypes()` instead of a hand-written literal union so a
      fourth section cannot reintroduce it
- [x] Add a regression test covering all three sections, `enterprise-architecture` included
- [x] **OBS-21** — the Technology dimension score is computed two ways that disagree by 0.1
      (`calculateDimensionScore` uses unrounded sub-dimension means;
      `getDimensionScoresForAssessment` rounds them first). Make `useScores` delegate to the
      canonical `calculateDimensionScore` for the dimension roll-up while still displaying
      rounded per-sub-dimension values; same fix shape for the organizational section path.
      **Blocks Wave 7** — the workbook cannot mirror two different answers
- [x] Regression test pinning the divergent case: Infrastructure `2,2,2,2,1,1` plus
      Application `1,1,1,1,1` must yield the same Technology score in both paths
- [x] **Organizational section path: deliberately left as-is.** `getOrganizationalScoresForAssessment`
      still rounds each section mean while `finalizeAssessment` averages unrounded ones. That
      follows the same display-rounds/scoring-does-not rule as the Technology fix, and nothing
      recomputes an area score from the displayed section values, so there is no contradictory
      pair on screen. Recorded rather than changed
- [x] **OBS-17** — correct `.kiro/steering/development-standards.md`: 14 domains / 72
      areas / 3 layers; remove the `isCategorizedDomain` and `CategorizedCapabilityDomain`
      references (deleted in v4); correct "Currently at version 1" — `db.ts` defines schema
      versions 1 through 4; note that `UI.DEBOUNCE_MS = 300` is not what `AspectCard` uses
      (it passes 500 literally)
- [x] **OBS-16 (partial)** — `Dashboard.handleExportAssessment` is a "coming soon" stub.
      Either route it to Import/Export or remove the menu item; do not leave a dead end
      during review week
- [x] Verify green; push so it appears in the reviewed build

### Wave 2 — Pilot data integrity

- [ ] **OBS-6** — `updateNotes`, `updateBarriers`, `updatePlans` in `useOrbitRatings.ts`
      silently discard input when no rating row exists. Add the create-if-missing branch
      that `updateLevel` already has, so notes typed before a level is chosen persist
- [ ] Bump `capabilityAssessments.updatedAt` in those three, matching every other write,
      so text-only edits affect dashboard ordering
- [ ] **OBS-7** — `triggerSave` reports success on a 300ms timer without observing the
      promise. Await the handler and surface rejection through the `'error'` state that
      `AssessmentContextBar` already implements but nothing can currently trigger
- [ ] Tests: notes-before-level persists; a rejected save shows the error state
- [ ] Verify green

### Wave 3 — Draft banner (app surfaces)

- [ ] Create the draft-notice module per 5.1 (`IS_DRAFT`, title, body)
- [ ] Add the `VITE_DRAFT_MODE` declaration to `src/vite-env.d.ts`
- [ ] Build `DraftBanner` component: slim, single-line, non-dismissible, `error.dark`,
      labeled region — **not** `role="alert"`
- [ ] Wire into `Layout.tsx` below the `AppBar`, above `<main>`, with `flexShrink: 0`
- [ ] Confirm the assessment page's fixed-height working area still fits: sidebar,
      content, and context bar all usable at 1280×720
- [ ] Tests: renders when `IS_DRAFT`, absent when disabled, no axe violations
- [ ] Verify green

### Wave 4 — Accessibility audit and remediation

- [ ] Resolve **P2** (deliverable format and fix-versus-report policy)
- [ ] Automated pass: axe via Playwright on Landing, Dashboard, Assessment (standard,
      organizational, aggregate variants), Results, Import/Export, Guide, History, 404
- [ ] Measure banner and theme contrast for real; confirm `error.dark` and correct if not
- [ ] Keyboard-only pass: full assessment flow, results drill-down, dialogs, skip link,
      focus visibility and focus order
- [ ] Screen-reader-semantics review of the two custom widgets most likely to be wrong:
      `MaturityLevelSelector` (`role="radiogroup"` / `role="radio"` on `div`s, with a
      nested To-Be checkbox per row) and `AssessmentSidebar` list structure
- [ ] Fix findings per the P2 policy; log anything structural as new `OBS-*` entries
- [ ] Record the audit result — pages covered, tools used, findings, dispositions
- [ ] Verify green

### Wave 5 — Draft notice in exports, plus PDF correctness

- [ ] PDF: draft band on the cover and a footer line, from the shared module
- [ ] CSV: notice line above the profile header; teach `parseMaturityProfileCsv` to skip it
- [ ] **OBS-2** — `pdfExport.ts` labels `currentLevel === 0` as "N/A" in
      `generateDimensionDetails` while `generateOrganizationalDetails` correctly uses
      `-1`. Align to the project convention (`-1` = N/A, `0` = not assessed) so
      unassessed aspects stop being reported to stakeholders as not applicable
- [ ] **OBS-3** — aggregate dimensions are omitted from the PDF entirely because the
      generator iterates actual ratings and aggregates have none. Emit the aggregated
      dimension with its score and an "(Aggregate from N assessments)" note, matching
      what CSV and the results UI already do
- [ ] **OBS-25** — PDF and CSV compute the Technology dimension as a flat mean over all 11
      aspects, weighting by aspect count instead of by sub-dimension: 3.2 where the tool says
      3.0. The CSV profile is the CMS submission artifact. Delegate
      `generateStandardAreaProfile` and `generateDimensionDetails` to `calculateDimensionScore`.
      Needs a To-Be path too — the canonical scorer only reads `currentLevel`, so either
      parameterize the level selector or generalize it
- [ ] **OBS-25 follow-on** — decide what `generateExecutiveSummary`'s "ORBIT Dimension Summary"
      should mean. It currently flat-averages every rating across all areas, so it is weighted
      by both aspect count and area count. The defensible figure is the mean of per-area
      dimension scores; that is a semantic change, so confirm before altering a
      stakeholder-facing table
- [ ] While in these files, replace the inline three-literal organizational-section checks in
      `exportService.ts` and `pdfExport.ts` with `isOrganizationalDimensionId`
- [ ] Tests: draft notice present in each format when enabled and absent when disabled;
      N/A versus unassigned labeling; aggregate row present for enterprise domains;
      Technology export score matches `calculateDimensionScore`
- [ ] Verify green

### Wave 6 — XLSX foundation

- [ ] Add `exceljs` as a **devDependency**, pinned
- [ ] `scripts/generate-xlsx-workbook.mjs` skeleton: read both JSON files, write to
      `public/`, log a row-count summary
- [ ] Port `constants.ts` from the reference implementation, updated for v4: drop
      `categoryName` / `categoryId`, restructure organizational columns for the single
      combined area with a section column
- [ ] Sheets `00_README` (with draft notice), `01_Maturity_Levels`,
      `02_Capability_Reference`, `03_ORBIT_Criteria_Reference`
- [ ] Sheets `04_Assessment_Input` and `05_Organizational_Input`: flat tables, single
      header row, no merged cells, hidden ID columns, level dropdowns, protection with
      `selectLockedCells: true`
- [ ] Apply aggregate-dimension omission per **P1**; assert the row count is 1,625 + 15
- [ ] To-Be columns on both input sheets, with the same dropdown and validation as As-Is
- [ ] `Information Management` flag column on `02` and `04`; guidance text on `00_README`
- [ ] Set workbook document properties per 5.3
- [ ] Content-fidelity tests: all 14 domains, 72 areas, 41 aspects, 205 criteria rows
      present with correct IDs
- [ ] **508 structural test suite** (per P2): no merged cells anywhere; exactly one header
      row per table; no blank rows or columns inside tables; document properties populated;
      no floating objects; every editable column's header carries text signalling, not fill
      colour alone; `selectLockedCells` remains enabled on every protected sheet
- [ ] Verify green

### Wave 7 — XLSX maturity profile and formulas

- [ ] Flat `06_Maturity_Profile`: real Domain / Capability Area / Dimension columns
      replacing the reference implementation's merged label rows
- [ ] `AVERAGEIFS` rollups for the standard dimensions, with Technology as the mean of
      its two sub-dimension means (**not** a flat mean of 11 aspects)
- [ ] Organizational rows: per-aspect values plus section means, and an area score that
      is the mean of section means
- [ ] Aggregate-dimension cells per P1(a): formula averaging the dimension across
      non-enterprise areas, mirroring `getAggregateDimensionScore`
- [ ] `TEXTJOIN` rollups for notes, barriers, and plans
- [ ] To-Be rollups mirroring every As-Is rollup
- [ ] `07_Area_Scores` and `08_Domain_Scores` sheets per 5.2
- [ ] Halfway-value fixture set (e.g. `4.05 / 3`) comparing Excel `ROUND` against JS
      `Math.round(x * 10) / 10`; record which primitive is authoritative
- [ ] JS reference implementation of the formula spec, tested against
      `calculateDimensionScore` on shared fixtures (5.4 step 1)
- [ ] Snapshot tests on generated formula strings (5.4 step 2)
- [ ] Open the generated file in Excel and hand-verify a standard area, an enterprise
      domain area, and the organizational area
- [ ] Run Excel's built-in Accessibility Checker and record the result (manual complement
      to the automated 508 assertions, per P2)
- [ ] Verify green

### Wave 8 — Delivery, docs, handoff

- [ ] Wire the generator into `npm run build`; confirm the file lands in `dist/`
- [ ] Document the go-live switch: setting `VITE_DRAFT_MODE=false` in `deploy.yml` removes
      the disclaimer from the app and all exports in one change (Decision 13)
- [ ] Add the generator plus validation tests to `ci.yml`
- [ ] Download links: Import/Export (primary), Landing (Decision 10), Guide
- [ ] Handle dev mode: the workbook is a gitignored build output, so `npm run dev` has no
      file and the three links would 404. Add a `predev` generation step or a graceful message
- [ ] Resolve **P4** (PWA) and align the offline claims in Landing, About, README,
      PROJECT_FOUNDATION, and the steering file with reality
- [ ] Full check: `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] Manual smoke on a `workflow_dispatch` deploy: banner on every page, workbook
      downloads and opens cleanly, exports carry the notice
- [ ] `CHANGELOG.md` entry
- [ ] `PROJECT_FOUNDATION_v2.md`: workbook artifact, draft-mode flag, export formats table
- [ ] `.kiro/steering/development-standards.md`: workbook generator and the `scripts/` convention
- [ ] Resolve the `maturity-profile-template.csv` question (Section 4, Noted)
- [ ] Update `docs/CODEBASE_OBSERVATIONS.md`: mark OBS-1, 2, 3, 6, 7, 16, 17 resolved
- [ ] Version bump and `npm install --package-lock-only`
- [ ] Draft the follow-up email to Shelley (Section 7)

---

## 7. Handoff Email Contents

Nick owes Shelley a scoping reply (`[18:36]`, `[26:06]`). It should state:

- Delivery date for the reviewable build
- **That CMS internal 508 review is a separate gate on their clock** — the date is
  "ready for review," not "cleared"
- The specific ask: reviewers must validate the workbook's **arithmetic**, not only its
  look and feel, because automated tests cannot evaluate Excel formulas (5.4)
- That placeholder descriptions on 14 areas are intentional and pending NextGen's
  document, so they are not reported as defects (OBS-18)
- Offer: send back an edited workbook and the changes get folded into the generator
- Note that XLSX import and live-data XLSX export are deferred, not dropped (Decision 6)

---

## 8. Working Notes

Append findings here as waves complete, so later sessions inherit them.

- **2026-09-09** — Plan created. Reference implementation at `b0fc55d` audited: ~2,300
  lines, 7 sheets, ExcelJS 4.4.0. Genuinely useful, with three disqualifying gaps —
  v3-era category columns, three-separate-org-types model, and 508 violations (5
  `mergeCells`, merged label rows, blank spacer rows, color-only signaling for editable
  columns). **It does not handle aggregate dimensions at all** — `buildProfilePlan` emits
  BA/Information/Technology for every area including Data Management and Technology
  Management, which contradicts the aggregate rules that have existed since v2.0.5. That
  omission is the origin of question P1 and is the largest genuinely new piece of
  workstream C.
- **2026-09-09** — Confirmed the reference implementation sets `selectLockedCells: true`,
  avoiding the common 508 trap of hiding locked reference cells from assistive tech.
  Keep that.

### Wave 0 baseline — 2026-09-09, `feature/pilot-clearance` @ `33e7963`

| Check                       | Result                                               |
| --------------------------- | ---------------------------------------------------- |
| `npm run typecheck`         | clean                                                |
| `npm run lint`              | clean                                                |
| `npm test`                  | 514 passed / 28 files                                |
| `npm run build`             | succeeds, **with a pre-existing chunk-size warning** |
| `npm run audit:code` (knip) | clean                                                |

Restore this exact state with `git stash` + `git checkout 33e7963` if a wave needs backing out.

**Pre-existing build warning (not introduced here).** `vite.config.ts` sets
`chunkSizeWarningLimit: 520` with a comment saying the vendor chunk is "~510KB". Actual
output: `vendor-mui` 337 kB and `vendor` **1,418 kB** (450 kB gzipped). So the limit is
exceeded on every build and the comment is stale. Two consequences worth knowing:

- A warning that fires on every build trains people to ignore build warnings, which
  matters when we are about to add build steps.
- 450 kB gzipped of vendor JS is a real cost for an offline-first PWA on state networks.

This validates Decision 12 — keeping ExcelJS a build-time `devDependency` means the
workbook feature adds **zero** bytes to this chunk. Logged as a new backlog item
(OBS-20) rather than fixed here; it is out of scope for pilot clearance.

**Deploy path (Decision 11) confirmed by config inspection.** `deploy.yml` declares
`workflow_dispatch`, and its `actions/checkout@v4` step pins no `ref`, so a manual
dispatch builds whichever branch is selected. `VITE_BASE_PATH` and `VITE_GITHUB_REPO_URL`
both derive from `github.*` context that is populated for dispatch events, so they
resolve correctly off a feature branch. Not executed here — triggering the workflow is
the user's action, so this is verified as _supported_, not as _run_.

---

## 8b. Wave 0 Review Record

An independent sub-agent review (September 9, 2026) checked this plan and
`CODEBASE_OBSERVATIONS.md` against the actual code and data before any implementation
began. Verdict: ready-with-corrections. All corrections are applied above.

**Verified correct, unchanged:** every row count in 5.2 (26 aspects, 71+1 areas, 1,625 /
15 / 228 / 205 / 72); the aggregate-omission arithmetic and the `DOMAIN_AGGREGATE_DIMENSIONS`
mapping; OBS-6 in full, including that the Wave 2 fix cannot inflate completion counters
because `getAssessedCount` filters on level; OBS-1's two locations, with a broad search
confirming no third site (`pdfExport`, `exportService`, and `importService` all correctly
include `enterprise-architecture`); the `100vh` layout constraint, with no `calc(100vh - N)`
anywhere in `src/`, so a `flexShrink: 0` sibling degrades gracefully; both contrast figures
(`error.dark` 7.03:1, `error.main` 4.67:1).

**Corrections applied:**

| Finding                                                                                                                                     | Fix                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 5.4 said only "round to one decimal"; rounding actually happens at different points per rollup, and the Technology paths genuinely disagree | 5.4 rewritten as a rounding-point table; OBS-21 filed and pulled into Wave 1 as a Wave 7 blocker                      |
| Excel `ROUND` differs from JS `Math.round(x*10)/10` on halfway values, and mitigation step 1 shares the JS primitive so cannot catch it     | Halfway-value fixture set added to Wave 7                                                                             |
| P1(a) said "mirror `getAggregateDimensionScore`", but a flat `AVERAGEIFS` weights by aspect count and the workbook has no status concept    | 5.4 now specifies averaging per-area profile cells, and documents the finalized-only filter as an accepted divergence |
| Placeholder count was 13                                                                                                                    | Corrected to 14 in both documents                                                                                     |
| 5.4 omitted that domain scores are finalized-only, and that dimensions with no assessed aspects are dropped rather than zeroed              | Both added                                                                                                            |
| `03` specified a "question" column, but all 205 per-level `questions` arrays are empty — it would fail the plan's own no-empty-columns rule | Column dropped; OBS-23 filed                                                                                          |
| 228 profile rows left no room for area, domain, or section scores that 5.4 and Wave 7 both require                                          | Rollups moved to new `07_Area_Scores` / `08_Domain_Scores` sheets; Technology sub-dimension means become columns      |
| "Offline-first PWA" is false — no service worker exists                                                                                     | OBS-22 filed; raised as P4                                                                                            |
| The Information Management guidance had no workbook counterpart, so workbook and tool would collect different input for the same state      | Flag column plus README guidance added to Wave 6                                                                      |
| To-Be / `targetLevel` was absent from the workbook spec despite being a first-class tool feature and a CSV profile column                   | Added to 5.2 and Waves 6 and 7                                                                                        |
| 5.3 simultaneously required no-blank-columns and carried-forward hidden ID columns                                                          | Resolved: IDs visible at far right, outside the named range, never hidden                                             |
| A CSV notice above `lines[0]` would break state-name parsing entirely, not merely need skipping                                             | 5.1 now specifies placement after the header line, and notes the parser is currently unexported and unused            |
| The skip link bypasses a banner placed above `<main>`                                                                                       | Resolution added: keep placement, and append `(Draft)` to the document title                                          |
| Decision 4 covered PDF/CSV/XLSX but not JSON/ZIP, the primary export path                                                                   | JSON/ZIP added to the export-surface table                                                                            |
| OBS-17's correction list omitted the steering file's "Currently at version 1" schema claim (actual: v4)                                     | Added to Wave 1, along with the misleading `UI.DEBOUNCE_MS` constant                                                  |
| The workbook is a gitignored build output, so in-app download links 404 under `npm run dev`                                                 | Dev-mode handling added to Wave 8                                                                                     |
| Section 1 warned against committing `temp-transcript.md`, which no longer exists                                                            | Warning removed                                                                                                       |

## 9. Out of Scope

| Item                                                        | Disposition                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLSX import (fill in the spreadsheet, continue in the tool) | Deferred (Decision 6). Sean raised it `[11:30]`; Shelley agreed it is not the priority `[12:52]`. The reference implementation has a working `xlsxImport.ts` to revisit. Hidden ID columns keep it feasible |
| Live-data XLSX export                                       | Deferred (Decision 6). The reference implementation's `includeCurrentData` path covers it                                                                                                                   |
| Capability model or maturity criteria changes               | None. Content is unchanged; workstream C only reads it                                                                                                                                                      |
| Reviewing the v4 model against the source deck              | Shelley and Chris, this week `[13:52]`                                                                                                                                                                      |
| PRA submission                                              | Shelley; going in under the approved APD template PRA `[15:45]`                                                                                                                                             |
| Formal ACR/VPAT                                             | Pending P2                                                                                                                                                                                                  |
| Remaining `OBS-*` items                                     | OBS-4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 19 stay in the backlog. OBS-5 and OBS-8 are flagged as pre-pilot decisions in Section 4                                                                             |
