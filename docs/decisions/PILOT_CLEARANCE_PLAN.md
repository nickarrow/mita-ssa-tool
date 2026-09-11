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

### Where things stand

|                |                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working branch | `feature/pilot-clearance`, cut from `feature/capability-model-v4` @ `33e7963`                                                                              |
| Commits so far | Waves 1-3 `a0b53c2` / `e25d665` / `81f076f`, docs `ef141e8` + `7710921`, accessibility `5580191` + `bdf1871` + `198c300`, docs `dbd54c7`, Wave 5 `1efdc9f` |
| Pushed         | Waves 1-4 are on `origin/feature/pilot-clearance` at `dbd54c7`. **Wave 5 (`1efdc9f`) is committed locally and NOT pushed**                                 |
| Deployed       | Pages dispatched from this branch at `198c300`, so the live build includes all of Wave 4 but **not Wave 5**                                                |
| Green at       | 675 tests / 35 files; typecheck, lint, knip, `format:check` all clean                                                                                      |
| Next wave      | **Wave 6 — XLSX foundation.** See the pre-brief in Section 8g                                                                                              |

> **Drop 1 is code-complete.** Waves 1-5 are done, which is the whole of the Friday
> September 12 scope. Wave 5 changes numbers in the CSV states submit to CMS and in the PDF
> stakeholder report — see the table at the top of the Wave 5 notes for exactly which — so
> pushing and dispatching a deploy is a deliberate act, not a formality. Wave 5 is not on the
> live site until that happens.

> **Stakeholders are now looking at the post-Wave-4 build,** and it differs visibly from what they
> reviewed before: darker score chips, a selected nav item that darkens rather than lightens,
> several recoloured chips, and a maturity level selector built from standard radio buttons. That
> was a deliberate, briefed deploy. Expect questions about appearance, and do not attribute those
> changes to Wave 5.

> **Do not push to `main`.** `deploy.yml` auto-triggers on pushes to `main`, and
> `origin/main` sits 10 commits behind at the pre-v4 capability model (`aa3708c`).
> Anything landing there — including a merged dependabot PR — auto-deploys and silently
> reverts the live site that stakeholders are reviewing back to the old model. Keep work
> on this branch, and deploy only by manually dispatching the Pages action from it
> (Decision 11).

> **Stakeholders are reviewing the deployed build as work continues.** Anything that changes
> what they see — or what a number says — should land as one deliberate deploy rather than a
> trickle, and the user decides when. Tell them before anything visually disruptive or
> score-changing goes out.

### How to resume

1. Read this file. Section 4 is the decision record, Section 5 is the specs, Section 6 is
   progress, and **Section 8g is the pre-brief for the next wave** — read that one carefully,
   it records traps that have already been paid for once.

   Section 8 has grown organically and its subsections are not in wave order. Where to look:

   | Looking for                                     | Section                                                     |
   | ----------------------------------------------- | ----------------------------------------------------------- |
   | Baseline to restore if a wave needs backing out | 8, "Wave 0 baseline"                                        |
   | What Waves 2, 3 learned                         | 8, "Wave 2 notes" and "Wave 3 notes"                        |
   | Review of the plan itself, before any code      | 8b                                                          |
   | Accessibility: the record to point CMS at       | **8d** (method, results, and what it does _not_ establish)  |
   | Accessibility: lessons and traps                | 8h, 8i                                                      |
   | Export scoring and the draft notice             | **8e**                                                      |
   | Pre-briefs                                      | 8c (Wave 4), 8f (Wave 5, historical), **8g (Wave 6, next)** |

2. Find the first wave with unchecked boxes — that is the current position.
3. Confirm the repo agrees with the checkboxes before trusting them:
   ```
   git branch --show-current && git status --short && git log --oneline -4
   npm run typecheck && npm run lint && npm test && npm run audit:code
   ```
4. Also read `docs/CODEBASE_OBSERVATIONS.md` — 35 `OBS-*` entries, referenced throughout
   this plan. 35 entries; **14 resolved** — OBS-1, 2, 3, 6, 7, 17, 21, 24, 25, 29, 30, 31, 32,
   34 — each carrying a `**Resolved` marker naming the wave, so the file can be scanned rather
   than cross-referenced against this one. **OBS-16 is only _partially_ resolved** (one of its
   four bullets); earlier revisions of this plan listed it as closed, which was wrong.
   Newest and unresolved: OBS-33 (collapsed panels stay mounted), OBS-35 (duplicate-rating
   path — decide before real state data exists).
5. Append what you learn to Section 8 so the next session inherits it.

### Working agreements established with the user

- **One commit per wave**, conventional-commit style, so each wave is a revertable
  checkpoint. Write the message with `git commit -F -` and a heredoc; the body explains
  _why_, not just what.
- **Invoke a sub-agent reviewer before each wave's commit.** This has caught a real
  regression or a false claim in the code every single time — three for three. Treat
  `NEEDS_CHANGES` as blocking.
- **Verify user-facing behaviour in a real browser**, not only in tests, for anything
  touching data integrity or visual output. Recipe below.
- Be explicit about what is verified versus assumed. The user values a stated limitation
  over an implied guarantee.

### Toolbox — things that cost time to rediscover

**Browser verification.** Playwright MCP is available and the fastest way to check real
rendering. Start the dev server as a background process (`npm run dev`, port 5173), then
drive it. Seed data straight into IndexedDB rather than clicking through the UI:

```js
// In browser_evaluate. DB name is 'Mita4Database'; stores are
// capabilityAssessments, orbitRatings, attachments, assessmentHistory, tags.
() =>
  new Promise((res, rej) => {
    const r = indexedDB.open('Mita4Database');
    r.onsuccess = () => {
      const tx = r.result.transaction(['capabilityAssessments', 'orbitRatings'], 'readwrite');
      tx.objectStore('capabilityAssessments').put({
        /* CapabilityAssessment shape */
      });
      tx.oncomplete = () => res('seeded');
      tx.onerror = () => rej(tx.error);
    };
  });
```

**Always clear the five stores afterwards** — the user's browser profile persists, and
leaving seed data behind pollutes their view of the tool.

**axe cannot evaluate colour contrast under jsdom.** It needs a canvas to sample rendered
pixels, which is what the "getContext not implemented" notice in test output means. Any
`toHaveNoViolations()` assertion in this repo silently skips contrast. Measure it in a real
browser by reading `getComputedStyle` and computing the ratio.

**Dev mode already runs axe and logs violations to the console** (`main.tsx` wires
`@axe-core/react`). Reading the browser console while clicking around is free findings.

**Test flake (OBS-27).** Running two arbitrary test files together flakes, because many
tests gate on a Dexie `liveQuery` emission they do not need. Run the **full suite** or a
**single file**; avoid arbitrary pairs. `asyncUtilTimeout` is 3000ms so failures report as
assertion differences rather than timeouts. **`testTimeout` is 15000**, raised in Wave 4
because a deliberate 4000ms `waitFor` was blowing vitest's 5000ms default under load — if
tests start reporting "Test timed out" instead of a diff, check that first. (A comment in
`src/test/setup.ts:8` still says 5000; the authoritative value is `vitest.config.ts:33`.)

**knip fails the build on unused exports.** Do not add an export before its consumer
exists — this bit twice, both times adding a constant one wave early.

**zsh, not bash.** Unquoted `$VAR` does **not** word-split, so `git checkout -- $FILES`
silently does nothing. And `$B:src/...` triggers zsh modifier expansion, mangling the path.
Quote everything or write paths literally.

**Sub-agent reviewers write to `semantic-review/`**, which is gitignored. The
`semantic_reviewer` agent **stalled twice** in Wave 5 on this workspace ("Model stream
stalled"); `general-task-execution` given an explicit adversarial-reviewer brief worked and
produced the better review of the five. Try that first rather than retrying the specialist.

**Capturing a real export.** Every export on the Import/Export page is gated behind a
state-name dialog, so clicking the button alone produces nothing. And the Playwright MCP
wrapper handles the `download` event itself, racing `page.waitForEvent('download')` — which
then times out even though the file arrived. Register `page.on('download', ...)` and save from
inside it.

**Reading a generated PDF.** Two routes, both needed:

- **Outside the suite:** extract text with `uv run --with "pypdf==5.4.0" python3 -` and a
  heredoc. Nothing PDF-related is installed locally, and `uv` avoids installing anything.
- **Inside the suite:** `generatePdfReport` returns a `Blob`, and jsdom implements neither
  `Blob.text()` nor `Blob.arrayBuffer()`, so use `buildPdfDocument(...).output()` instead — it
  returns the uncompressed document as a searchable string. **Unescape PDF string escapes
  first** (`text.replace(/\\([()\\])/g, '$1')`): a literal parenthesis is written `\(`, so
  every assertion on a bracketed score silently fails to match without it, while assertions on
  plain words pass — which reads like an exporter bug rather than a test bug.

**A substring assertion over a PDF is usually reachable another way.** Wave 5 shipped three
that could not fail: a dimension name that the executive summary's intro sentence prints in
every report, an `Areas` table header that another table already emitted, and `DRAFT` which
the footer supplied while the assertion was meant to cover the cover band. Prefer asserting
through an extracted pure function, anchoring the search past a unique heading, or counting
occurrences against page count — **and prove each assertion by breaking the code it covers.**

**Pre-commit hooks** run prettier and eslint via lint-staged and will reformat staged
files, so run `npx prettier --write` on what you touched before committing to keep the
commit and the working tree identical.

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

| #   | Decision                                                                                                                                                                                                                                                   | Source                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Draft banner is red, at the top, on every page. Precedent: the draft guidance site used red                                                                                                                                                                | Shelley `[07:14]`                         |
| 2   | Copy conveys "draft version of the tool, still being piloted." Exact prior wording not required                                                                                                                                                            | Shelley `[07:08]`                         |
| 3   | Banner is visible but not alarming — no flashing, no bright-red alarm styling                                                                                                                                                                              | Nick `[06:20]`                            |
| 4   | **The draft notice also appears in exports** (PDF, CSV, XLSX) for consistency                                                                                                                                                                              | Nick, follow-up                           |
| 5   | **The notice must be easily removable** so CMS can drop it at go-live                                                                                                                                                                                      | Nick, follow-up                           |
| 6   | **Blank workbook only.** Live-data XLSX export and XLSX import are deferred — they over-complicate this delivery                                                                                                                                           | Nick, follow-up; aligns with `[12:34]`    |
| 7   | **Focus is parity** with existing content, functionality, and accessibility                                                                                                                                                                                | Nick, follow-up                           |
| 8   | **No rebase of `feat-xlsx-workbook-generation`.** It was an experiment; harvest what is useful                                                                                                                                                             | Nick, follow-up                           |
| 9   | **Accessibility audit is in scope**, bundled with the banner work                                                                                                                                                                                          | Nick, follow-up; committed at `[22:15]`   |
| 10  | Workbook download is linked from the homepage as well as Import/Export                                                                                                                                                                                     | Nick, follow-up                           |
| 11  | Deployment stays a manual `workflow_dispatch` of the Pages action from the feature branch                                                                                                                                                                  | Nick, follow-up                           |
| 12  | Workbook is generated at build time as a Node script, not client-side. Keeps ExcelJS out of the browser bundle as a devDependency                                                                                                                          | Plan recommendation, accepted `[25:33]`   |
| 13  | Banner removal is controlled by `VITE_DRAFT_MODE`, defaulting to draft-on. Follows the existing `VITE_BASE_PATH` / `VITE_GITHUB_REPO_URL` precedent                                                                                                        | Plan default under Decision 5             |
| 14  | Workbook filename is stable and unversioned so the guidance-site URL never breaks; the version is printed inside the workbook                                                                                                                              | Plan default; addresses Shelley `[10:08]` |
| 15  | **Two notices, top and bottom, with CMS-supplied wording reproduced verbatim.** Supersedes Decisions 1-3's "draft version, still being piloted" copy. Bottom notice carries the PRA statement; exports carry the full statement. See the Copy block in 5.1 | CMS, September 11                         |

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
- **OBS-35 (duplicate ratings from arrow-key level selection).** Native radio groups select
  as focus moves, so arrowing from Level 1 to Level 5 fires four saves in as many
  milliseconds over a read-then-write upsert, and the compound index in `db.ts` is not
  unique so the database will not reject a duplicate. Not reproduced — six rapid presses did
  not trigger it — but the failure mode is duplicate `orbitRatings` rows for one aspect,
  which would double-count in a score a state submits to CMS. **Decide before real state data
  exists.** The durable fix is a unique index, which means a Dexie version bump, and every
  bump in this project has been a clean break that clears all tables — so it wants to ride
  along with a migration that is happening anyway.
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

**Copy — superseded September 11 by CMS-supplied wording (Decision 15).** What Wave 3
shipped was:

> **Draft** — This is a draft version of the MITA 4.0 State Self-Assessment Tool. It is
> still being piloted and is subject to change.

CMS then asked for a notice at the top **and** the bottom of every page, with specific
text for each. Both are reproduced verbatim in `src/constants/draftNotice.ts` and **must
not be edited for length or consistency.** The two bodies genuinely differ — the top says
"in support of MITA 4.0 pilot activities", the bottom says "in support of pilot
activities" and adds the PRA statement — so neither can be derived from the other:

> **Top.** Predecisional Pilot Materials: These materials are preliminary and are being
> made available for limited review and testing in support of MITA 4.0 pilot activities.

> **Bottom.** Predecisional Pilot Materials: These materials are preliminary and are being
> made available for limited review and testing in support of pilot activities. They do not
> represent final agency policy or requirements and may not be used to conduct an
> information collection subject to the Paperwork Reduction Act (PRA) unless and until
> applicable PRA requirements, including OMB approval where required, have been satisfied.

**Removal mechanism (Decision 13).** One module exports both the flag and the text so
every surface — app, PDF, CSV, XLSX — reads from the same place:

```ts
export const IS_DRAFT = import.meta.env.VITE_DRAFT_MODE !== 'false';
// The rest live in constants/draftNotice.ts, which stays free of `import.meta`:
//   DRAFT_NOTICE_LABEL      'Predecisional Pilot Materials'
//   DRAFT_NOTICE_BODY       top body
//   DRAFT_NOTICE_FULL_BODY  bottom body, with the PRA statement
//   DRAFT_NOTICE_LINE       label + full body, single line, for exports
//   DRAFT_NOTICE_SHORT_LINE label + top body, for space-constrained surfaces
//   DRAFT_TITLE_MARKER      'Predecisional', for document.title
```

The label is no longer usable as a title suffix at 29 characters, hence
`DRAFT_TITLE_MARKER`. The internal names keep saying "draft" on purpose:
`VITE_DRAFT_MODE` is a deploy-workflow variable and renaming it would break that contract,
so internal naming and user-facing copy are deliberately decoupled.

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

| Rollup                    | Rule                                                                                                                                                                                                     | Rounding                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Aspect                    | The entered level                                                                                                                                                                                        | n/a                                                      |
| Non-Technology dimension  | Mean of assessed aspect levels                                                                                                                                                                           | round once                                               |
| **Technology dimension**  | Mean of the **two sub-dimension means** — not a flat mean of 11 aspects                                                                                                                                  | sub-dimension means **unrounded**, round once at the end |
| Standard area             | Mean of its dimension scores                                                                                                                                                                             | dimension scores **already rounded**, then round         |
| **Organizational area**   | Mean of the three section means; sections with nothing assessed are excluded, so sections weigh equally despite 6/5/4 aspect counts                                                                      | section means **unrounded**, round once at the end       |
| Aggregate dimension       | Mean of the per-area dimension scores across non-enterprise areas                                                                                                                                        | per-area scores **already rounded**, then round          |
| Domain                    | Mean of its areas' scores                                                                                                                                                                                | stored (rounded) area scores, then round                 |
| Enterprise-wide dimension | Mean of the per-area dimension scores, finalized areas only. Aggregate dimensions are **not** folded in — an aggregate derives from these same per-area scores, so counting it double-counts those areas | per-area scores **already rounded**, then round          |
| **To-Be, every rollup**   | Identical to the As-Is rule at the same level, reading `targetLevel` instead of `currentLevel`. An absent `targetLevel` is excluded exactly like unassessed                                              | identical to the As-Is row above it                      |

Exclusions, uniform everywhere: unassessed (`0`) and N/A (`-1`) are both left out of every
average. A dimension with no assessed aspects is **dropped** from the area average rather
than counted as zero — Excel's `AVERAGE` over blanks matches this, but the test suite must
assert it rather than assume it.

**Resolved — there is now exactly one rule to mirror.** This section previously recorded a
blocker: the tool computed the Technology dimension two different ways and the workbook could
not mirror both. That is discharged, and it took three waves rather than one.

| Wave | What it fixed                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | OBS-21 — the results table double-rounded sub-dimension means, disagreeing with `calculateDimensionScore` by 0.1                                                   |
| 5    | OBS-25 — both export paths, the PDF executive summary, and the live To-Be column all flat-averaged 11 Technology aspects. Five sites in total, plus a latent sixth |
| 5    | To-Be gained a canonical rule at all, via `calculateDimensionScore(..., 'targetLevel')`. Before this there was none, and each caller averaged `targetLevel` itself |

`calculateDimensionScore` in `src/services/scoring.ts` is the single canonical
implementation and the one the workbook formulas mirror. `summariseDimensionsAcrossAreas` in
`src/services/export/pdfExport.ts` is the reference for the enterprise-wide row above.

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

- [x] **OBS-6** — `updateNotes`, `updateBarriers`, `updatePlans` in `useOrbitRatings.ts`
      silently discard input when no rating row exists. Add the create-if-missing branch
      that `updateLevel` already has, so notes typed before a level is chosen persist
- [x] Bump `capabilityAssessments.updatedAt` in those three, matching every other write,
      so text-only edits affect dashboard ordering
- [x] **OBS-7** — `triggerSave` reports success on a 300ms timer without observing the
      promise. Await the handler and surface rejection through the `'error'` state that
      `AssessmentContextBar` already implements but nothing can currently trigger
- [x] Tests: notes-before-level persists; a rejected save shows the error state
- [x] Verify green

### Wave 3 — Draft banner (app surfaces)

- [x] Create the draft-notice module per 5.1 (`IS_DRAFT`, title, body)
- [x] Add the `VITE_DRAFT_MODE` declaration to `src/vite-env.d.ts`
- [x] Build `DraftBanner` component: slim, single-line, non-dismissible, `error.dark`,
      labeled region — **not** `role="alert"`
- [x] Wire into `Layout.tsx` below the `AppBar`, above `<main>`, with `flexShrink: 0`
- [x] Confirm the assessment page's fixed-height working area still fits: sidebar,
      content, and context bar all usable at 1280×720
- [x] Tests: renders when `IS_DRAFT`, absent when disabled, no axe violations
- [x] Verify green

### Wave 4 — Accessibility audit and remediation

- [x] Resolve **P2** — settled: build to WCAG 2.1 AA, verify with our own automated plus
      manual testing, fix what is safe, report the rest for a decision, no formal ACR. CMS
      runs the official 508 review. Applies to the workbook as well as the app
- [x] Automated pass: axe via Playwright on Landing, Dashboard, Assessment (standard,
      organizational, aggregate variants), Results, Import/Export, Guide, History, 404 —
      plus both orphaned results routes. 12 routes, axe-core 4.11.1 in real Chromium
- [x] Banner contrast measured in a browser: 7.03:1 at 12.8px, passes AA and AAA. Theme
      contrast beyond the banner **measured and logged as OBS-30** — deferred, needs sign-off
- [x] Keyboard-only pass: full assessment flow, results drill-down, dialogs, skip link,
      focus visibility and focus order
- [x] Screen-reader-semantics review of the two custom widgets most likely to be wrong:
      `MaturityLevelSelector` (OBS-29, deferred for a decision) and `AssessmentSidebar`
      list structure (fixed — it was a critical `aria-required-children` failure)
- [x] Fix findings per the P2 policy; log anything structural as new `OBS-*` entries —
      OBS-29, 30, 31, 32 filed; OBS-24 closed
- [x] Record the audit result — see Section 8d
- [x] Verify green — 567 tests / 32 files; typecheck, lint, knip clean

### Wave 5 — Draft notice in exports, plus PDF correctness

- [x] PDF: draft band on the cover and a footer line, from the shared module
- [x] CSV: notice line **directly after** the `MITA 4.0 Maturity Profile: <state>` header — not
      above it, which would break state-name parsing (see 5.1) — and teach
      `parseMaturityProfileCsv` to skip it
- [x] JSON / ZIP: `draftNotice` field in the export envelope, and a line in the ZIP
      `manifest.json`. This is the primary export path, so do not skip it (Decision 4)
- [x] **OBS-2** — done early, in Wave 2. `pdfExport.ts` labelled `currentLevel === 0` as
      "N/A" in `generateDimensionDetails` while `generateOrganizationalDetails` correctly
      used `-1`. Pulled forward because the OBS-6 fix makes notes-only rows (level 0) a
      common case, so shipping Wave 2 without it would have amplified a stakeholder-facing
      misreport. Still needs the export-side test in this wave
- [x] **OBS-3** — aggregate dimensions are omitted from the PDF entirely because the
      generator iterates actual ratings and aggregates have none. Emit the aggregated
      dimension with its score and an "(Aggregate from N assessments)" note, matching
      what CSV and the results UI already do
- [x] **OBS-25** — PDF and CSV compute the Technology dimension as a flat mean over all 11
      aspects, weighting by aspect count instead of by sub-dimension: 3.2 where the tool says
      3.0. The CSV profile is the CMS submission artifact. Delegate
      `generateStandardAreaProfile` and `generateDimensionDetails` to `calculateDimensionScore`.
      Needs a To-Be path too — the canonical scorer only reads `currentLevel`, so either
      parameterize the level selector or generalize it. **Resolved by generalizing:**
      `calculateDimensionScore` gained an optional `levelField` parameter defaulting to
      `'currentLevel'`, so the To-Be rule lives beside the As-Is rule instead of being
      re-derived per call site
- [x] **OBS-25 follow-on** — decide what `generateExecutiveSummary`'s "ORBIT Dimension Summary"
      should mean. **User's call, September 11: mean of per-area dimension scores, finalized
      assessments only.** Extracted as `summariseDimensionsAcrossAreas`, with a new "Areas"
      column so the denominator is visible. The old figure was weighted by aspect count _and_
      area count, and separately read every rating regardless of status while the domain table
      directly above it counted finalized only
- [x] **New in this wave, and a third divergence the pre-brief did not know about:**
      `ResultsMasterDetail.calculateTargetDimensionScores` flat-averaged `targetLevel` in the
      **live UI**, so fixing export To-Be alone would have created a fresh UI-versus-export
      disagreement. **User's call: one rule everywhere.** It now delegates to the canonical
      scorer. Logged under OBS-25
- [x] While in these files, replace the inline three-literal organizational-section checks in
      `exportService.ts` and `pdfExport.ts` with `isOrganizationalDimensionId`
- [x] Tests: draft notice present in each format when enabled and absent when disabled;
      N/A versus unassigned labeling; aggregate row present for enterprise domains;
      Technology export score matches `calculateDimensionScore`
- [x] Verify green — 675 tests / 35 files; typecheck, lint, knip, `format:check` all clean

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
- [ ] **OBS-28** — add `public/favicon.svg` and reference it as `%BASE_URL%favicon.svg`. No
      favicon exists today and the root-absolute path would not respect the base path anyway.
      Natural pairing with the PWA manifest, which needs an icon set
- [ ] Mark the draft in `index.html`'s `<title>` and `<meta name="description">`. Those are
      what render as the link preview when the pilot URL is pasted into Teams or Slack, and
      they are currently unmarked — the runtime title suffix does not reach a crawler. Needs
      a Vite HTML transform so `VITE_DRAFT_MODE=false` still removes it; deferred here rather
      than hardcoding "(Draft)" into static HTML, which would survive go-live. Pair with the
      PWA manifest name, which has the same problem
- [ ] Full check: `npm run typecheck && npm run lint && npm test && npm run build`
- [ ] Manual smoke on a `workflow_dispatch` deploy: banner on every page, workbook
      downloads and opens cleanly, exports carry the notice
- [ ] `CHANGELOG.md`: fold the `[Unreleased]` section into a version entry. Wave 5 already
      populated it, because that wave changes the Technology figure a state submits to CMS and
      shipping Drop 1 with no record of that would have been wrong
- [ ] `PROJECT_FOUNDATION_v2.md`: workbook artifact, draft-mode flag, export formats table
- [ ] `.kiro/steering/development-standards.md`: workbook generator and the `scripts/` convention
- [ ] Resolve the `maturity-profile-template.csv` question (Section 4, Noted)
- [ ] Update `docs/CODEBASE_OBSERVATIONS.md` — most entries are already marked resolved as
      their wave landed; check nothing from Waves 6-8 is left unrecorded
- [ ] Version bump and `npm install --package-lock-only`
- [ ] Draft the follow-up email to Shelley (Section 7)

---

## 7. Handoff Email Contents

Nick owes Shelley a scoping reply (`[18:36]`, `[26:06]`). It should state:

- Delivery date for the reviewable build
- **That CMS internal 508 review is a separate gate on their clock** — the date is
  "ready for review," not "cleared"
- **That exported Technology scores changed in Drop 1, and why.** Anyone who exported a CSV or
  PDF before Wave 5 has a Technology figure computed as a flat mean over all 11 aspects rather
  than the mean of the two sub-dimension means; it can differ by a couple of tenths, and it
  read higher whenever Technical Infrastructure Management scored above Application
  Management. The tool's own Results screen was already correct, so the export was the outlier.
  Worth saying plainly and unprompted — a reviewer who spots a score move and is not told why
  will reasonably assume the new number is the broken one. The `[Unreleased]` CHANGELOG section
  has the detail
- That the PDF's "ORBIT Dimension Summary" changed meaning in the same drop: it is now the
  mean of per-area dimension scores over finalized areas, where it previously averaged every
  rating and quietly included in-progress work
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

### Wave 2 notes — 2026-09-09

Verified the OBS-6 fix end to end in a real browser, not just in unit tests, because it is a
data-loss fix shipping into a pilot: typed notes into a fresh aspect with **no** level
selected, confirmed the row persisted at `currentLevel: 0`, confirmed sidebar progress stayed
at 0%, reloaded and confirmed the text rendered back, then picked a level and confirmed the
notes survived (`updateLevel` patches only the level, so it does not clobber text).

The save indicator now reports the real outcome and is a polite live region.

**Head start on Wave 4.** The app already runs axe in dev mode, and it reported these on the
assessment page during the check above — so Wave 4's remediation looks bounded rather than
structural:

| Finding               | Detail                                                     |
| --------------------- | ---------------------------------------------------------- |
| Contrast 4.31:1       | `#ffffff` on `#1a7fc3`, 14px normal — needs 4.5:1          |
| Contrast 3.49:1       | `#757575` on `#e0e0e0`, 12px — needs 4.5:1, reported twice |
| Heading order invalid | Heading levels skip on the assessment page                 |

Plus OBS-24 (mouse-only expandable dimension rows), already logged. Note the second contrast
pair looks like a disabled/greyed chip, so it may recur across several components.

**Test-suite flake — diagnosed and fixed, and my first diagnosis was wrong.** I initially
recorded this as a `waitFor` timeout to be fixed by raising the timeout. Measurement said
otherwise:

| Invocation                                | Failures |
| ----------------------------------------- | -------- |
| `useOrbitRatings.test.ts` alone           | 0 / 8    |
| With a second file (`useDebounce`)        | 1 / 8    |
| With a fake-timers file (`useSaveStatus`) | 5 / 10   |
| Full suite (what CI runs)                 | 0 / 5    |

Raising `asyncUtilTimeout` to 5000 made it _worse-looking_, not better: it matched vitest's
5000ms `testTimeout`, so a failing `waitFor` blew the test timeout and reported "Test timed
out" instead of the actual assertion difference. It is now 3000, deliberately below the test
timeout.

The real cause was unnecessary synchronization. Many tests gate on a Dexie `liveQuery`
emission (`await waitFor(() => expect(result.current.ratings).toEqual([]))`) before mutating
— but the mutation paths resolve rows straight from IndexedDB via `findExistingRating` and
never read `ratings`. That gate only made the tests sensitive to liveQuery scheduling under
CPU contention. Removing it from the tests added in this wave took the two-file failure rate
from **5/10 to 0/10**, with the full suite still clean 4/4.

The same unnecessary pattern remains in roughly a dozen pre-existing tests in that file.
Logged as OBS-27 rather than changed here, to keep this wave's diff reviewable.

### Wave 3 notes — 2026-09-09

Banner measured in a real browser rather than asserted from theory, because axe-core
**cannot evaluate colour contrast under jsdom** — it needs a canvas to sample rendered
pixels, which is what the "getContext not implemented" notice in the test output means. The
`toHaveNoViolations()` assertion in `DraftBanner.test.tsx` therefore does _not_ cover
contrast, which is this banner's main accessibility risk. Noted in the test itself so nobody
reads it as broader coverage than it is.

Measured at `error.dark` (`#b0142f`) on white text:

| Property       | Value         | Verdict                                             |
| -------------- | ------------- | --------------------------------------------------- |
| Contrast ratio | **7.03:1**    | Passes AA (4.5:1) and AAA (7:1) for normal text     |
| Font size      | 12.8px normal | Below the large-text threshold, so 4.5:1 is the bar |
| Banner height  | 27px          | Slimmer than the 32-36px target                     |

Layout impact on the fixed-height shell at 1280x720, with the banner present: document
scroll height equals the viewport (no overflow), the sidebar still reaches the bottom, and
"Review & Finalize" remains visible. The assessment working area survives the banner.

Responsive behaviour: one line down to 768px, wrapping to three lines (66px) at 390px. That
is a real bite out of a phone viewport, but the assessment page already needs a 240px fixed
sidebar plus content, so phones are not a supported target for this tool. Accepted rather
than special-cased.

Document title becomes "MITA 4.0 State Self-Assessment Tool (Draft)". That is the fix for
the skip-link gap: `#main-content` sits below the banner, so anyone using the skip link never
reaches the notice, but the title is announced on load regardless.

**The go-live switch removes the copy, not just the banner.** Verified against real builds:
with `VITE_DRAFT_MODE=false` the phrase "still being piloted" is absent from
`dist/assets/*.js` entirely — Rollup tree-shakes the whole branch, since `IS_DRAFT` resolves
to a constant at build time. The default build contains it. So Decision 5's "easily
removable" is satisfied by one workflow variable with no dead copy left in the artifact, and
the change is verifiable by grepping the bundle rather than clicking through the app.

Tests also pin that only the exact string `'false'` disables it, so a variable set to `FALSE`
or `0` cannot quietly drop the disclaimer.

**Review outcomes.** Three things the Wave 3 review changed:

- The banner is now a **labelled landmark** (`<section aria-label="Draft notice">`), which is
  what Section 5.1 and the wave checklist actually specified — I had ticked "labeled region"
  while shipping a plain `Box`. It follows the USWDS Site Alert shape, a closer precedent for
  a government tool than the GOV.UK phase banner I originally cited, and it satisfies axe's
  `region` rule for top-level content outside any landmark.
- The comment justifying the no-live-region decision was **wrong**, and is corrected in the
  component. A live region does not "re-announce unchanging text"; announcements fire on
  mutation, so a static live region would simply never fire. The conclusion held, the stated
  reason did not, and the comment is the durable record.
- The draft **copy moved to `src/constants/draftNotice.ts`**, a module with no `import.meta`
  reference. `import.meta.env` is `undefined` under plain Node and touching it throws, so the
  Wave 6 XLSX generator could not have imported the copy from `constants/index.ts` —
  defeating Section 5.1's "one module exports both the flag and the text". The flag stays in
  `constants/index.ts` because it is environment-dependent; Node derives it from
  `process.env.VITE_DRAFT_MODE`.

**A real bug the duplication test caught.** The title guard was first written as
`endsWith(' (Draft)')`. The DOM **trims `document.title`**, so once the value round-trips the
leading space is gone, the guard never matches, and the marker is appended again on every
mount — observed as `"(Draft) (Draft)"`. It now keys on the parenthesised marker with no
leading whitespace.

**Two stale axe suppressions removed** from `Layout.test.tsx`. The `region` and
`landmark-one-main` rules were disabled with comments claiming the skip link was missing and
main needed a label; both have existed for some time. The full ruleset passes now, and the
"allow up to 2 violations" tolerance in the navigation test is gone too.

**Layout re-checked on the tightest page.** `/history/:historyId` is the same fixed-height
master-detail shell as Results but keeps the footer _and_ adds a header plus an alert, so it
has the least vertical room in the app. At 1280x720 with the banner present it still does not
overflow.

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

## 8c. Wave 4 Pre-Brief (accessibility audit)

Written at the end of Wave 3 so the next session starts with what is already known rather
than rediscovering it. **Wave 4 is the wave with genuinely unbounded scope** — the audit
itself is a couple of hours, but remediation depends on what it finds.

### Already-known findings

Collected from dev-mode axe while verifying Waves 2 and 3, plus the audit in
`CODEBASE_OBSERVATIONS.md`. These are the starting worklist:

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                      | Source                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Contrast **4.31:1** — `#ffffff` on `#1a7fc3`, 14px normal. Needs 4.5:1                                                                                                                                                                                                                                                                                                                                                                       | dev axe, assessment page |
| 2   | Contrast **3.49:1** — `#757575` on `#e0e0e0`, 12px. Reported twice; looks like a disabled or greyed chip, so it likely recurs across components                                                                                                                                                                                                                                                                                              | dev axe, assessment page |
| 3   | **Heading order invalid** — levels skip on the assessment page                                                                                                                                                                                                                                                                                                                                                                               | dev axe                  |
| 4   | **OBS-24: expandable dimension rows are mouse-only.** `DimensionRow` in both `DimensionScoresTable.tsx` and `DimensionScoresTableWithTarget.tsx` puts `onClick` on the `TableRow` with `aria-expanded` but no `tabIndex`, no `role="button"`, no key handler. Everything behind the expansion — per-aspect levels, notes, barriers, attachments — is unreachable without a mouse. `aria-expanded` on a non-focusable element is also invalid | OBS-24                   |

For #4 the fix pattern already exists in the codebase: `DomainTable` uses a real
`IconButton` for its expand control and _is_ keyboard reachable. Prefer that over adding
`role="button"` to the row, which also avoids a row-wide click target fighting text
selection.

### The item most likely to blow up the estimate

`MaturityLevelSelector` (`src/components/assessment/MaturityLevelSelector.tsx`) is the
most-used control in the app — it is how every one of the 26 aspects gets rated — and its
markup is the riskiest in the codebase:

- The level rows are `div`s carrying `role="radiogroup"` and `role="radio"` rather than real
  inputs, so keyboard support (arrow-key navigation within the group, roving tabindex) is
  hand-rolled or absent. Verify with keyboard only, not with axe: axe checks that roles are
  _valid_, not that the interaction _works_.
- Each radio row contains a **nested To-Be checkbox**. A checkbox inside a radio is not a
  valid ARIA composition — interactive content must not nest inside a `role="radio"`.

If this needs restructuring it is real surgery on the control states actually use, with
regression risk. Two mitigations worth considering before touching it: it currently has no
test file, so add coverage first; and the plan's Drop 1 date (Sept 12) is for a _reviewable_
build, so a documented finding with a proposed fix may serve better than a rushed rewrite.
Get the user's call rather than deciding unilaterally.

### Scope guidance

- P2 is settled: fix what is safe, report the rest with a recommendation, no formal ACR.
- Pages to cover: Landing, Dashboard, Assessment (standard **and** organizational **and**
  an enterprise-domain aggregate variant — they render different components), Results
  (including the master-detail drill-down), Import/Export, Guide, History, 404.
- `Layout` is a clean baseline: its two stale axe suppressions were removed in Wave 3 and
  the full ruleset passes, so violations found now are in page content, not the shell.
- Remember contrast must be measured in a browser (see the toolbox in Section 1).
- Log anything structural as a new `OBS-*` entry rather than expanding this wave.

### Deliverable

Record pages covered, tools used, findings, and dispositions — that record is what the user
points CMS at, and it is also the honest answer to "is it accessible?" which is otherwise
unanswerable without assistive-technology testing by real users.

## 8d. Wave 4 Accessibility Audit Record

**Date:** September 10, 2026 · **Branch:** `feature/pilot-clearance` · **Standard:** WCAG 2.1
Level AA · **Policy:** Decision P2 — fix what is safe, report the rest, no formal ACR

This is the record to point CMS at. It states what was tested, what was fixed, what was
deliberately not fixed, and — importantly — **what this exercise cannot tell you**.

### Method

| Aspect                 | Detail                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool                   | axe-core **4.11.1**, injected into the running app from `node_modules` via the Vite dev server, driven by Playwright                                                            |
| Rule sets              | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, **plus** `best-practice`                                                                                                            |
| Environment            | Real Chromium at 1280×720 and 1400×1000 — **not** jsdom, so colour contrast was genuinely evaluated                                                                             |
| Data                   | IndexedDB seeded directly with 5 assessments / 109 ratings / 1 history snapshot, covering a standard area, an aggregate-dimension area, and the organizational area             |
| Manual                 | Keyboard-only traversal, focus-indicator inspection via `getComputedStyle` **and screenshots**, dialog focus-trap and Escape, skip-link activation                              |
| Routes (12)            | Landing, Dashboard, Assessment ×3 (standard / aggregate / organizational), Results, Import/Export, Guide, History detail, both orphaned results routes, 404                     |
| Interaction states (7) | Results with a domain selected, an area selected, and a dimension row expanded; a collapsed layer; Assessment with 2 and 3 aspect accordions expanded; the finalize dialog open |

Why `best-practice` was included: `heading-order` is **not** WCAG-tagged in axe. A run
filtered to WCAG tags alone reports zero heading problems on this app, which is misleading —
the first pass did exactly that and found nothing, while the app had heading-order failures
on seven routes.

Why interaction states are listed separately: **auditing routes by URL is not sufficient
coverage for this app.** `ResultsMasterDetail` renders its detail panel only after a click and
holds selection in component-local state rather than the URL (OBS-12), and the assessment
page's aspect panels load collapsed. Two findings below — the last heading skips and
`landmark-unique` — exist _only_ in states a route sweep cannot reach. The first pass of this
audit reported `heading-order` clean on `/results` for precisely that reason; a reviewer caught
the gap, and the states were then driven explicitly.

### Result

| Rule                     | Impact       | Before                                     | After                                                               |
| ------------------------ | ------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| `aria-required-children` | **critical** | 4 routes                                   | **0** — fixed                                                       |
| `role-img-alt`           | serious      | 3 routes                                   | **0** — fixed                                                       |
| `aria-conditional-attr`  | serious      | 1 route (3 nodes)                          | **0** — fixed                                                       |
| `heading-order`          | moderate     | 7 routes (19 nodes) + 2 interaction states | **0** — fixed, re-verified in the interaction states                |
| `landmark-unique`        | moderate     | assessment, expanded panels only           | **0** — fixed                                                       |
| `listitem`               | serious      | 0                                          | **0** — introduced by the first fix attempt, then resolved (OBS-31) |
| `color-contrast`         | serious      | 12 distinct pairs                          | 12 — **deferred, OBS-30**                                           |
| `nested-interactive`     | serious      | 3 assessment routes                        | 3 — **deferred, OBS-29**                                            |

Landing and 404 were clean before and after. Every remaining automated violation is one of
the two deferred items.

Two findings surfaced only once panels were expanded, and both are worth knowing about
because the same shape recurs easily:

- **`landmark-unique`.** `AspectCard` set `role="region"` plus an `id` on `AccordionDetails`,
  but MUI's `Accordion` already renders its own `div.MuiAccordion-region` carrying
  `role="region"`, the same `id`, and `aria-labelledby`. Every expanded aspect therefore
  produced **two identically-named landmarks and a duplicate DOM `id`**. Removing the manual
  attributes took the landmark count on a five-aspect page from 16 to 6 and left zero
  duplicate ids (verified by enumerating every `id` in the document).
- `AttachmentUpload` used `role="region"` with the fixed label "File upload area", so it
  appeared once per aspect. Changed to `role="group"`, which keeps the name without claiming
  page-level structure.

Plus one failure **axe never reported**, found only by manual testing and the most
consequential thing in this audit:

> **WCAG 2.4.7 Focus Visible failed across essentially the whole application.** MUI's
> `ButtonBase` sets `outline: 0` and signals keyboard focus with a background tint from
> `palette.action.focus`; this app's own `sx` backgrounds override that tint. Measured on the
> assessment sidebar with focus on it: `outline: none`, `box-shadow: none`, background
> `rgba(0,0,0,0.004)`. Confirmed by screenshot — the focused row was visually identical to
> its neighbours. This affected every `ButtonBase`-derived control — `Button`, `IconButton`,
> `ListItemButton`, `AccordionSummary`, `MenuItem`, `Checkbox`, `Radio`. Anchors and the few
> `role="button"` divs were unaffected, because they still received the browser's default ring.
>
> Fixed at the theme level with `'&.Mui-focusVisible': { outline: '2px solid currentColor' }`.
> `currentColor` was chosen deliberately: an outline cannot be clobbered by a background
> rule, and it adapts to context — measured white (`rgb(255,255,255)`) on the dark blue
> AppBar and near-black (`rgb(33,33,33)`) on light page backgrounds.
>
> **`currentColor` alone was not sufficient, and the first attempt shipped a ring nobody
> could see.** On a _contained_ button the text colour is `palette[color].contrastText`
> (white), and the default `outline-offset: 2px` draws the ring entirely outside the button
> onto the white page — measured **1.00:1**, i.e. invisible, on the primary call to action of
> five pages and on every dialog confirm. A reviewer caught this. Contained buttons now use
> `outlineOffset: -4` so the white ring is drawn on the button's own fill: measured
> **5.14:1** on primary and 4.67:1 on error, both clearing the 3:1 required for non-text
> contrast, and confirmed by screenshot.
>
> **Scope limits worth stating.** `Chip` is `styled('div')` rather than `ButtonBase`, so the
> clickable attachment-download chips are _not_ covered by this override and still signal
> focus only with a background tint. Disabled controls resolve `currentColor` to
> `text.disabled` and would give a sub-3:1 ring, but they are exempt under WCAG 1.4.11 and
> MUI removes them from the tab order.
>
> Because the rule keys off `:focus-visible`, **mouse and touch users see no change.**

### What was fixed

| Fix                                                                                                                              | Visual impact                             |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Theme focus-visible outline on `ButtonBase` controls, inset on contained buttons and full-bleed rows                             | Keyboard focus only; none for mouse users |
| `AssessmentSidebar` standard branch: rows wrapped in `ListItem`, Technology rollup row is an `li` — was `ul` with `div` children | None                                      |
| `AssessmentContextBar` tag-suggestion list: rows wrapped in `ListItem`                                                           | None                                      |
| `ResultsMasterDetail`: `Collapse` nested inside each `li` so the tree is valid list markup at every level (OBS-31)               | None                                      |
| 24 `Typography` sites given explicit `component` so `variant` no longer emits stray headings (OBS-32)                            | None — `variant` still drives styling     |
| Chart accessible names moved onto the `<canvas>` (where react-chartjs-2 sets `role="img"`) instead of a wrapper `div`            | None                                      |
| `AspectCard`: removed the duplicate `role="region"` and duplicate DOM `id` that shadowed MUI's own accordion region              | None                                      |
| `AttachmentUpload`: `role="region"` → `role="group"` so it is not a repeated landmark                                            | None                                      |
| `DimensionScoresTable`: `aria-expanded` moved from `TableRow` to a real focusable button (OBS-24 remainder)                      | None                                      |

**Every fix in this wave is invisible to a mouse user.** The first draft of the
`DimensionScoresTable` fix added chevron icons and dropped the `↳` sub-dimension marker;
both were reverted after review, since `all: unset` on the new `<button>` already makes it
render identically to the text node it replaced.

Tests added: 14 — 5 `AssessmentSidebar` standard-mode (two list-structure guards, two axe
checks), 5 `ResultsMasterDetail` (list validity collapsed, domain-expanded and
layer-collapsed, plus an axe check), 4 theme. Suite went 558 → **572**, files 31 → 33.

### Follow-up — both Wave 4 deferrals were subsequently fixed

Wave 4 first deferred OBS-29 and OBS-30 as open AA failures, on the grounds that both change
what stakeholders see mid-review. The instruction was to fix them properly rather than defend
them, so both were completed in two further commits, each independently reviewed.

**The automated result is now zero violations across 12 routes and 9 interaction states**, under
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` **and** `best-practice`.

- **OBS-30 — contrast.** Fixing root causes rather than reported instances showed the audit had
  under-counted: **all five** `SCORE_COLORS` failed in every role at 2.16-3.68:1, not the two axe
  flagged, because axe measures only what renders. `info` was never defined, so MUI's failing
  default was in play; Alert icons and outlined chips both paint from fill-grade `.main` tokens.
  Fixed with theme overrides so the patterns are corrected wherever they appear, plus two states
  reachable only on hover or in a striped progress bar.
- **OBS-29 — `MaturityLevelSelector`.** Rewritten onto native radio inputs: arrow keys work in
  both directions, tab stops fell from 11 per aspect to 2, and the To-Be control is a sibling
  radio group rather than a checkbox nested inside a `role="radio"`. A 28-test file was written
  **first**, against the old implementation — 13 of its tests failed there, describing exactly
  the defects — which is what made the rewrite safe on a control that had no coverage.
- Two more defects surfaced only by expanding panels, both fixed: duplicate DOM ids and duplicate
  landmarks from hardcoded ids in `QuestionChecklist` and `AspectCard` (OBS-34), and a
  `div role="button"` wrapping a real `<button>` in `AssessmentContextBar`.

### What remains deliberately unfixed

- **OBS-31 — proper ARIA `tree` semantics** for the results nav. The Wave 4 change makes the
  markup valid; making it a real tree is a refactor.
- **OBS-33 — collapsed aspect panels stay mounted**, so the ten-aspect Information dimension
  mounts ~110 invisible radio inputs. The fix is one MUI prop, but it removes the element that
  the summary's `aria-controls` points at, so it needs its own accessibility pass rather than
  landing the day before a stakeholder drop.
- **Clickable `Chip` focus indicators.** `Chip` is `styled('div')`, not `ButtonBase`, so the
  theme focus ring does not reach it.

### Limitations — what this audit does not establish

State these alongside any claim about accessibility:

1. **No assistive-technology testing was performed.** No screen reader (NVDA, JAWS, VoiceOver)
   was driven against the app. Every screen-reader claim here is inferred from the accessibility
   tree and ARIA semantics, not heard. This is the single largest gap, and automated tooling
   cannot close it.
2. **Automated rules cover a minority of WCAG.** axe finds roughly a third of WCAG issues by
   common estimates. A clean axe run is a floor, not a pass.
3. **"Zero automated violations" is not "meets WCAG 2.1 AA."** Both originally-deferred failures
   are now fixed and every rule axe can evaluate passes, but that is a floor, not a pass — see
   points 1 and 2. The honest statement is: no known open AA failure, and no assistive-technology
   testing to confirm it.
4. **Contrast was measured on the states that happened to render.** Hover, disabled, error and
   validation states were not systematically enumerated.
5. **Zoom and reflow (1.4.10), text spacing (1.4.12) and 400% magnification were not tested.**
   The assessment page is a fixed-height shell with a 240px sidebar, which is where reflow
   problems would concentrate.
6. **No testing below 768px.** Accepted deliberately in Wave 3 — the fixed sidebar plus content
   means phones are not a supported target.
7. **Verified in Chromium only.** No Firefox or Safari pass, and `:focus-visible` heuristics
   differ between engines.
8. **Interaction-state coverage is representative, not exhaustive.** Seven states were driven
   explicitly (listed under Method), chosen because they render different components. Others
   were not enumerated — notably import/export progress and error states, snackbar alerts, the
   tag editor's validation states, and the organizational assessment's review step. Given that
   two findings in this audit existed _only_ in interaction states, assume more remain.
9. **`Chip` focus indicators were not fixed.** Clickable chips are outside the `ButtonBase`
   override (see the focus-ring note above) and still rely on a background tint.

### Recommended next steps

1. **Before any "accessible" claim reaches states, do one screen-reader pass on the assessment
   flow.** This is now the single largest remaining gap, and automation cannot fill it. It also
   matters more than it did: the rewritten level selector is the control states will spend all
   their time in, and its semantics have only been verified through the accessibility tree.
2. Resolve OBS-33 (unmount collapsed aspect panels) with an axe pass over both states.
3. Give clickable `Chip`s a focus indicator; they are the one interactive control class the theme
   override does not reach.
4. When auditing again, drive interaction states rather than routes. Four of this audit's findings
   existed only behind an expand or a selection, so a sweep that only visits URLs will report this
   app cleaner than it is.

## 8e. Wave 5 Notes — 2026-09-11

Full record of what changed is the Wave 5 checklist above. What is here is the things
that cost time to learn, and the numbers a later session should not have to re-derive.

**Every figure below was read out of a generated artifact**, not asserted from a
function's return value. Exports were driven through the real Import/Export page in
Chromium with IndexedDB seeded to 3 finalized areas plus 1 in-progress area; the PDF was
then text-extracted with `pypdf`.

| Surface                     | Before          | After                                        |
| --------------------------- | --------------- | -------------------------------------------- |
| CSV Technology As-Is        | 3.2             | **3.0**                                      |
| CSV Technology To-Be        | 3.2             | **3.0**                                      |
| PDF per-area Technology     | `(Avg: 3.2)`    | **`(Avg: 3.0)`**                             |
| PDF exec summary Technology | 3.2             | **3.0**, over 2 areas                        |
| Results UI Technology To-Be | 3.2             | **3.0**                                      |
| PDF aggregate dimension     | absent entirely | `Information (Avg: 3.0)` + contribution note |

The fixture is Infrastructure ×6 at 5 and Application ×5 at 1: canonical `mean(5, 1) = 3.0`
against a flat `(30 + 5) / 11 = 3.18 → 3.2`.

**Generalising the scorer beat adapting at the call sites.** `calculateDimensionScore` took
an optional third parameter, `levelField`, defaulting to `'currentLevel'`. The alternative —
each caller remapping `{currentLevel: r.targetLevel ?? 0}` — leaves the To-Be rule
re-derived per site, which is the exact failure OBS-21 and OBS-25 document. It also puts the
`undefined`-means-unassessed sentinel in one place rather than three, where one `?? -1` would
be a silent wrong answer. The default keeps every pre-existing As-Is caller byte-identical.

**The first parameter was also widened, `OrbitDimensionId` → `RatingDimensionId`.** This is
honest rather than convenient: `technology` is the only branch, so organizational sections
already take the plain-mean path, and `DimensionScore.dimensionId` is already
`RatingDimensionId`. Widening let the UI caller pass its id straight through instead of
asserting it is narrower than it is — and a cast of exactly that shape is what produced
OBS-1.

**The PDF was untestable, and that is why OBS-2 and OBS-3 survived 631 tests.** Two things
to know:

- `generatePdfReport` returns a `Blob`. Its bytes are intact (`blob.size` matches
  `doc.output().length`), but **jsdom implements neither `Blob.text()` nor
  `Blob.arrayBuffer()`**, so reading it needs a `FileReader` and an async hop. Splitting out
  `buildPdfDocument`, which returns the document before serialisation, is the shorter path.
  Beware a wrong turn taken here: an early note recorded "the Blob yields 13 bytes" — that
  was `String(blob).length`, i.e. `"[object Blob]"`. The reviewer caught it.
- **PDF literal strings escape parentheses**, so `(Avg: 3.0)` is written `\(Avg: 3.0\)`.
  Without unescaping, every assertion on a bracketed score silently fails to match while
  assertions on plain words pass — which reads like a bug in the exporter rather than in the
  test. `pdfExport.test.ts` has a `pdfText` helper that undoes it.

**Grepping a content stream produces vacuous assertions unless you fight for it.** The
review found three that could not fail, all of which looked reasonable:

| Assertion                               | Why it was inert                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `toContain('Information')` for OBS-3    | the exec summary's intro sentence names all three dimensions in every report |
| `toContain('Areas')` for the new column | the Domain table above already emits that exact header                       |
| `toContain('DRAFT')` for the cover band | `DRAFT_NOTICE_LINE` starts with `DRAFT:`, so the footers alone satisfy it    |

The general lesson: in a document full of numbers and dimension names, a bare substring is
almost always reachable another way. What works is asserting through an extracted pure
function, anchoring a search past a unique heading, or counting occurrences against page
count. **Each fix was proved by neutering the code it covers and watching the test fail** —
worth doing, because two of the three had passed against deliberately broken code.

**The scoring rule had a fourth implementation, not three.** `useOrbitRatings.getAverageLevelForDimension`
still flat-averaged, and its signature accepts `'technology'`. No caller reaches it with
Technology today — `buildStandardNavItems` emits Technology either per-sub-dimension or as a
rollup handled earlier — so no wrong number shipped from it. It now delegates anyway. Second
time the count of these has been wrong; assume there is another and grep before claiming
otherwise.

**`DRAFT:` is a wire format, not presentation.** `parseMaturityProfileCsv` skips the notice
row by matching that prefix, and derives the prefix from `DRAFT_NOTICE_LABEL`. So renaming
the label would keep the entire suite green while making every CSV already exported during
the pilot unparseable. There is now a test asserting the **literal**, with a comment saying
not to "fix" it to use the constant.

**Playwright download capture.** The MCP wrapper handles the `download` event itself and
races `page.waitForEvent('download')`, which then times out even though the file arrived.
Register `page.on('download', ...)` and save from there. Also: every export is gated behind a
state-name dialog, so the click alone produces nothing.

**One thing checked and cleared, recorded so it is not re-investigated.** Dev-mode axe
reported a `color-contrast` failure of 1.32:1 (white on `#e0e0e0`, 15px) on Import/Export.
At rest, axe's full ruleset over that page reports **zero** violations, and when the export
buttons are genuinely disabled their text resolves to `rgba(0,0,0,0.26)`, which axe exempts.
It is most likely axe sampling MUI's colour transition mid-animation. Not reproducible as a
stable state, so it is **not** filed as an `OBS-*` entry — but note it sits inside Wave 4's
stated limitation 8, that import/export interaction states were never enumerated.

**The PDF print palette was verified rather than assumed** — Section 8f flagged `stat.color`
at `pdfExport.ts:192` as untraced. It comes from the local `COLORS` table
(`accent`/`primary`/`darkGray`), measuring 4.89:1, 6.56:1 and 5.43:1 on `lightGray`. Every
pair in the palette clears AA, so Wave 4's contrast work not reaching the PDF turned out not
to matter. New `COLORS.draft` `#b0142f` is 7.03:1 on white — and contrast is symmetric, so
that one figure covers both the white-on-red band and the red-on-white footer. An earlier
comment quoted a second, different ratio for the reversed pairing; there is no such thing.

**Limitations of this wave's verification, stated plainly.**

1. PDF content is asserted by substring search over a content stream. That proves a string
   was written. It does **not** prove it is legible, correctly positioned, or on the page a
   reader expects.
2. **The PDF was never rendered to an image and looked at.** Text extraction confirms
   presence and order; it says nothing about overlap or visual balance. The cover band's
   geometry was reasoned about (roughly y 60-74 against a state name fixed at y 90, so about
   three spare lines) rather than seen. The cover does not reflow — `drawCoverDraftBand`
   returns a y coordinate the caller ignores, deliberately, and this is noted in its
   docstring.
3. The footer notice is drawn at **7pt**. It clears AA on contrast and now wraps rather than
   overflowing, but 7pt is small and legibility at that size was not assessed.
4. Excel/`ROUND` parity is untouched here; that is Wave 7's problem.
5. `parseMaturityProfileCsv` still has no consumer outside its own test, so the CSV
   round-trip guarantee remains real but hypothetical.

## 8f. Wave 5 Pre-Brief — historical

> **Wave 5 is complete.** This is kept as written, before the work, because comparing it
> against what actually happened is useful: it called four defects and there were six, and it
> did not know about the live UI's To-Be divergence at all. **Section 8e is the record of what
> was actually done.**

Written at the end of Wave 4 so the next session starts with what is already known. Wave 5 is
the last wave of Drop 1 and, unlike Wave 4, its scope is **bounded and enumerable** — the work
is four known defects plus the draft notice on four surfaces.

### Why this wave matters beyond Drop 1

**OBS-25 is a Wave 7 blocker.** The workbook formulas have to reproduce one Technology dimension
score, and there are currently still two answers in the codebase: the canonical
`calculateDimensionScore` (mean of the two sub-dimension means) and the export path's flat mean
over all 11 aspects. Wave 1 fixed the results table; export was out of its scope. Until this is
settled, Wave 7 has no single number to target — so this wave unblocks the whole of Drop 2.

It also matters on its own terms: **the CSV maturity profile is the artifact states submit to
CMS**, and the PDF is the stakeholder report. Both currently print a Technology score the tool's
own UI disagrees with. Example from OBS-25: Infrastructure all at 5 and Application all at 1
gives 3.0 canonically and 3.2 in export — a weighting difference, so it does not shrink with
more data.

### The four defects, in dependency order

1. **OBS-25 — Technology weighting in `exportService.generateStandardAreaProfile` and
   `pdfExport.generateDimensionDetails`.** Delegate to `calculateDimensionScore`. The wrinkle:
   that scorer only reads `currentLevel`, so the **To-Be column needs a path too** — either
   parameterise the level selector or generalise the scorer. Decide which, and say why.
2. **OBS-25 follow-on — `generateExecutiveSummary`'s "ORBIT Dimension Summary".** This is a
   different question, not a delegation: it flat-averages every rating for a dimension across all
   areas, so it is weighted by both aspect count _and_ how many areas were assessed. The
   defensible enterprise figure is the mean of per-area dimension scores. **That is a semantic
   change to a stakeholder-facing table — get the user's call before changing it.**
3. **OBS-3 — aggregate dimensions are missing from the PDF entirely.** `generateCapabilityAreaSection`
   groups actual ratings, and aggregate dimensions have none by design, so a Data Management
   area's PDF silently omits Information. CSV and the results UI both handle this; copy their
   shape (`(Aggregate from N assessments)`).
4. **OBS-2 export-side test.** The fix landed in Wave 2 — `pdfExport` had labelled
   `currentLevel === 0` as "N/A" where the convention is `-1` — but it still has no test at the
   export boundary. Cheap, and it guards a stakeholder-facing misreport.

Plus the draft notice on four surfaces (Decision 4), and replacing the inline three-literal
organizational-section checks in `exportService.ts` and `pdfExport.ts` with
`isOrganizationalDimensionId`.

### Traps already known

- **CSV notice placement is constrained.** `parseMaturityProfileCsv` reads the state name from
  `lines[0]` specifically (`csvExport.ts:141-143`), so a notice _above_ that line makes every
  parsed state name `Unknown`. Put it on the line **after** the
  `MITA 4.0 Maturity Profile: <state>` header, padded with the existing `,,,,,` convention, and
  teach the parser to skip it. Worth knowing: that parser is not exported from
  `services/export/index.ts` and has no consumer outside its own test, so the round-trip
  constraint is currently hypothetical — but leaving it broken traps whoever wires CSV import.
- **The draft copy lives in `src/constants/draftNotice.ts`**, deliberately free of any
  `import.meta` reference so Node build tooling can import it. `IS_DRAFT` stays in
  `constants/index.ts` because it is environment-dependent. Do not merge them.
- **The PDF has its own colour set** — `COLORS` in `pdfStyles.ts`, unrelated to `SCORE_COLORS`.
  The Wave 4 contrast work therefore did **not** reach the PDF. Spot-checked and the print
  palette looks conservative (`#005b96`, `#646464`, `#007a5c` all clear 4.5:1 on white), but
  `stat.color` at `pdfExport.ts:192` is passed in from elsewhere and was not traced. Verify, do
  not assume — and note the PDF is a fifth place score colours are decided.
- **`npm test` needs `testTimeout`.** Wave 4 raised it to 15000 in `vitest.config.ts` because a
  deliberate 4000ms `waitFor` inside vitest's 5000ms default was timing out under load. If tests
  start reporting "Test timed out" rather than assertion differences, check that first.

### Suggested sequence

OBS-25 first — it is the blocker, and getting the canonical score into export makes the notice
work purely additive. Then OBS-3, then the notice on all four surfaces, then the OBS-2 test.
Land it as one commit with a sub-agent review, as with Waves 1-4.

## 8g. Wave 6 Pre-Brief (XLSX foundation)

Written at the end of Wave 5. Wave 6 opens Drop 2 and is the first wave that adds a new
artifact rather than correcting an existing one.

### Read before writing any code

- **Section 5.2** (sheet structure and row counts), **5.3** (the 508 requirements, which are
  the reason the previous spreadsheet was rejected) and **5.5** (delivery).
- **Branch `feat-xlsx-workbook-generation` @ `b0fc55d`.** Roughly 2,300 lines of working
  ExcelJS generator already exist there. Reference only — never rebase it (Decision 8). Take
  the declarative `constants.ts` column/header/width model, the data-validation dropdowns, the
  `AVERAGEIFS`/`TEXTJOIN` techniques and `selectLockedCells: true`. Do **not** take the
  `categoryName`/`categoryId` columns (that tier was deleted in v4), the three-separate-org-types
  model, or `buildProfilePlan`'s merged label-row shape.
- It **does not handle aggregate dimensions at all**, which is the largest genuinely new piece
  of work and the origin of decision P1.

### What Wave 5 has already settled for you

The scoring parity problem in Section 5.4 is now tractable, which it was not before:

- **There is one Technology rule, in one place.** `calculateDimensionScore` in
  `src/services/scoring.ts` is the only implementation the workbook has to mirror. Wave 1
  fixed the results table, Wave 5 fixed both export paths, the executive summary and the live
  To-Be column, and closed a latent fourth copy in `useOrbitRatings`. Section 5.4's
  "Blocked on OBS-21" note is discharged.
- **To-Be has a canonical rule too**, via `calculateDimensionScore(..., 'targetLevel')`. Every
  input and profile row carries As-Is and To-Be, so the workbook needs both, and there is now
  a single answer to target for each.
- **The enterprise-wide dimension figure has agreed semantics**: mean of per-area dimension
  scores, finalized only, aggregate dimensions not folded in. If the workbook grows a
  summary sheet, that is the rule — `summariseDimensionsAcrossAreas` in `pdfExport.ts` is the
  reference implementation, and Section 5.4's rounding table still governs.
- **The draft notice has a Node-safe home.** `src/constants/draftNotice.ts` exports
  `DRAFT_NOTICE_LABEL`, `DRAFT_NOTICE_BODY` and `DRAFT_NOTICE_LINE` and is deliberately free
  of `import.meta`, so the build-time generator can import it directly. Derive the flag from
  `process.env.VITE_DRAFT_MODE`, never from `constants/index.ts`, which does read
  `import.meta.env` and throws under plain Node.

### Traps specific to this wave

- **knip fails the build on unused exports.** This has bitten twice, both times adding a
  constant one wave early. Add an export only once its consumer exists.
- **`ExcelJS` is a `devDependency`, pinned** (Decision 12). It must never enter the browser
  bundle. The vendor chunk is already 450 kB gzipped and over its own warning threshold
  (OBS-20).
- **The generated workbook is a gitignored build output**, so `npm run dev` has no file and
  the three in-app download links 404. That is Wave 8's problem, but do not be surprised by it.
- **ExcelJS does not evaluate formulas**, so no unit test can assert a cell computes 3.4.
  Section 5.4's four-step mitigation is the plan; step 1 (a JS reference implementation of each
  formula's intent, tested against `calculateDimensionScore`) is the one that carries the
  weight, and it now has a single scorer to test against.
- **Excel `ROUND` and JS `Math.round(x * 10) / 10` disagree on decimal halfway values**, and
  step 1 cannot catch it because it shares the JS primitive. The halfway-value fixture set is
  Wave 7, not here, but design the formulas knowing it is coming.

### A lesson from Wave 5 that transfers directly

Wave 5's tests searched a generated PDF for substrings, and three assertions turned out unable
to fail — each satisfied by unrelated text elsewhere in the document. The workbook's 508
assertions in Wave 6 have exactly the same shape: "no merged cells", "one header row per
table", "document properties populated" are all easy to write in a form that passes on an empty
or half-built workbook. **Prove each assertion by breaking the thing it covers and watching it
fail.** That step caught two of Wave 5's three.

## 8h. Wave 4 Notes — 2026-09-10

Full audit record is Section 8d. What is here is the things that cost time to learn.

**Run axe with `best-practice` included, or heading order is invisible.** `heading-order` is
not WCAG-tagged in axe. My first sweep filtered to the four WCAG tags and reported zero
heading problems; the app had them on seven routes. The pre-brief's "heading order invalid"
item came from dev-mode axe, which uses the default ruleset — so the two sources disagreeing
was the clue.

**Injecting axe into the real browser is the whole game, and it is easy.** `page.addScriptTag({
path: '<abs>/node_modules/axe-core/axe.min.js' })` after each `page.goto`. Note the path must
be **absolute** — Playwright's cwd is not the repo root. This gives real contrast evaluation,
which jsdom cannot do at all, and it took one Playwright call to sweep 12 routes.

**The biggest finding was not automatable.** Focus-visible failed across nearly the whole app
and axe reported nothing, because axe cannot tell whether a focus indicator is _perceivable_.
It was found by tabbing and reading `getComputedStyle`, then confirmed by screenshot. Worth
remembering for the workbook's 508 work in Wave 7: the same logic applies — the automated
assertions are a floor.

**`currentColor` is the right primitive for a focus ring in this app.** Two reasons, both
learned the hard way. MUI `ButtonBase` sets `outline: 0` and expresses focus as a background
tint — which the app's own `sx` backgrounds silently override, so a background-based fix would
have been fragile in exactly the places that were already broken. And the ring has to work on
both the dark blue AppBar and light page backgrounds; `currentColor` resolves to white on the
former and near-black on the latter, measured on both.

**My first fix for the results tree was wrong twice, and each time a different check caught
it.** Wrapping `ListItemButton` in `ListItem` is the correct fix for the sidebar and silenced
the critical `aria-required-children` there. Applying the same shape to `ResultsMasterDetail`
traded one violation for another: because `Collapse` renders a `div` between the levels, the
new `li`s were not inside a `ul`, producing `listitem` × 14. Re-running axe in the browser
caught that — typecheck, lint and 558 tests were green on it.

I then concluded the tree _could not_ be valid list markup and documented that as a
limitation. **That was also wrong**, and the sub-agent reviewer disproved it with a
counter-example: nest the `Collapse` **inside** the `li` rather than beside it, give each level
its own `ul`, and it passes clean. Shipped that instead. The general lesson: "this cannot be
done accessibly" is a claim that deserves a counter-example before it goes in a document
headed for CMS. See OBS-31.

**MUI 6.5 wraps `AccordionSummary` in `<h3 class="MuiAccordion-heading">`.** Nothing in this
repo writes that heading, so the assessment page's `h2 → h3 → h6` outline looked inexplicable
until I queried the live DOM for it. Every aspect card had a heading nested inside a heading.
Do not try to reason about heading order in this app from the JSX alone.

**Two things are deferred with a decision attached, not quietly dropped:** OBS-30 (contrast)
and OBS-29 (`MaturityLevelSelector`). For OBS-29 the useful distinction, which changes how
urgent it is, is that the control **is** operable by keyboard — Enter/Space selects, Tab reaches
the To-Be checkbox — so it fails WCAG 4.1.2, not 2.1.1. It is announced wrong rather than
unusable, which is what makes "document it for Drop 1" defensible.

**A URL sweep under-reports this app, and two findings hid behind clicks.** `/results` renders
its detail panel only after a selection, held in component-local state (OBS-12), and assessment
aspect panels load collapsed. Driving those states found the last heading skips plus
`landmark-unique` — and behind the latter, a **duplicate DOM `id`**: `AspectCard` set
`role="region"` and `id` on `AccordionDetails`, not knowing MUI's `Accordion` already renders a
`div.MuiAccordion-region` with the same id and a proper `aria-labelledby`. Removing the manual
copy took a five-aspect page from 16 landmarks to 6 with zero duplicate ids. Removing it also
broke a test helper that had been matching the _unnamed duplicate_ via
`getByRole('region', { name: '' })` — worth knowing that a test can silently depend on a bug.

**`currentColor` needed one exception.** On contained buttons the text colour is white, and the
default outward `outline-offset` drew the ring on the white page instead of the button: 1.00:1,
invisible, on the primary CTA of five pages. The reviewer caught it. Contained buttons now use
`outlineOffset: -4`, measured 5.14:1. Generalisable point — an adaptive colour still needs
checking against every surface it can land on, not just the two you looked at.

**Seed and clean up.** The 12-route sweep needs data on Dashboard/Results/Assessment/History.
Seeded 5 assessments / 109 ratings / 1 snapshot straight into IndexedDB, then cleared all five
stores afterwards and **read the counts back to prove they were zero** — the user's browser
profile persists. `.playwright-mcp/` (screenshots, console logs) is now gitignored; it was not
before, and it would otherwise have landed in this commit.

## 8i. Wave 4 Follow-Up Notes — 2026-09-10

The two Wave 4 deferrals were fixed rather than documented. Lessons worth inheriting.

**Reported instances are not root causes, and axe only sees what renders.** OBS-30 was filed as
"twelve failing colour pairs". Chasing the causes instead found that **all five** score colours
failed in every role they are used in, at 2.16-3.68:1 — axe had flagged two of the five, being
the two that happened to render during the sweep. Same shape for `info`, which the theme never
defined, so MUI's failing default was silently in play everywhere. If a contrast finding looks
like a short list, check the token rather than the list.

**Fix the token or the theme, not the call site.** MUI paints outlined-chip text and Alert icons
from `palette[x].main`, which is a fill-grade colour. Two `styleOverrides` entries fixed every
outlined success/warning/info chip and every Alert icon in the app at once. Chasing call sites
would have missed the conditional ones — three `color="info"` chips only render in states the
sweep never reached.

**Compute contrast, do not eyeball it.** A throwaway Node script computing luminance ratios
settled every palette choice in minutes and caught that `#b26500` misses at 4.42:1 while
`#a15c00` passes at 5.19:1 — a distinction no amount of looking would reveal. The maths then went
into tests, because the old palette's docstring _claimed_ AA compliance while failing everywhere,
and a comment cannot enforce anything.

**Write the tests before the rewrite, especially with no existing coverage.**
`MaturityLevelSelector` had no test file. Writing 28 tests against the _old_ implementation first
produced a baseline of 12 passing and 13 failing, where the 13 failures were precisely the
defects OBS-29 described. After the rewrite the same file went green without being rewritten to
match the implementation — which is the only real evidence that behaviour was preserved.

**jsdom is not a browser, and knowing where it lies matters.** It does not implement the roving
tabindex for a radio group with nothing checked: Tab visits every unchecked radio, where Chrome
exposes only the first. A tab-stop count measured in jsdom would therefore have been wrong. The
12-to-2 figure is measured in Chromium; the jsdom test asserts the count only in the state where
both engines agree. Separately, MUI puts `pointer-events: none` on disabled controls, so
`userEvent` refuses to click them — a disabled-state test that does not set
`pointerEventsCheck: 0` passes without exercising anything.

**Expanding panels is where the remaining bugs were.** Four findings across this work existed
only behind an interaction: two heading skips, `landmark-unique`, and duplicate DOM ids in both
`QuestionChecklist` and `AspectCard`. Hardcoded `id` attributes in a component that renders once
per aspect are invisible until two instances are on screen, and in the `QuestionChecklist` case
every region's `aria-labelledby` resolved to the _first_ matching header, so four of five panels
were mislabelled. Prefer `useId()`, and check whether MUI already provides the wiring before
adding `id`/`role` by hand. `useId()` returns `:r3:`-style values — strip the colons, they break
unescaped CSS selectors.

**A performance regression showed up as a test flake.** Moving to real radio inputs took a
five-aspect dimension from 25 to 55 mounted inputs per page, because collapsed accordion
panels stay mounted. The OBS-6 notes test started missing its 4s gate on about one full-suite run
in three. Shortening the typed string restored stability across four consecutive runs, but the
underlying cost is real and is logged as OBS-33 — the one-prop fix removes the element
`aria-controls` points at, so it needs its own accessibility pass rather than a rushed landing.

## 9. Out of Scope

| Item                                                        | Disposition                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLSX import (fill in the spreadsheet, continue in the tool) | Deferred (Decision 6). Sean raised it `[11:30]`; Shelley agreed it is not the priority `[12:52]`. The reference implementation has a working `xlsxImport.ts` to revisit. Hidden ID columns keep it feasible                                                                                    |
| Live-data XLSX export                                       | Deferred (Decision 6). The reference implementation's `includeCurrentData` path covers it                                                                                                                                                                                                      |
| Capability model or maturity criteria changes               | None. Content is unchanged; workstream C only reads it                                                                                                                                                                                                                                         |
| Reviewing the v4 model against the source deck              | Shelley and Chris, this week `[13:52]`                                                                                                                                                                                                                                                         |
| PRA submission                                              | Shelley; going in under the approved APD template PRA `[15:45]`                                                                                                                                                                                                                                |
| Formal ACR/VPAT                                             | Pending P2                                                                                                                                                                                                                                                                                     |
| Remaining `OBS-*` items                                     | 21 of 35 stay in the backlog: OBS-4, 5, 8, 9, 10, 11, 12, 13, 14, 15, **16 (partially)**, 18, 19, 20, 22, 23, 26, 27, 28, 33, 35. OBS-22 (PWA, via P4) and OBS-28 (favicon) are scheduled for Wave 8. OBS-5, OBS-18 and OBS-35 are carried in Section 4 as needing a decision rather than code |
