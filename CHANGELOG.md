# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Pilot clearance work on `feature/pilot-clearance`. See
`docs/decisions/PILOT_CLEARANCE_PLAN.md` for the scope record and decision log. The
version bump lands with the final wave.

### Fixed

- **Technology dimension score in PDF and CSV exports** (OBS-25). Both computed it as a
  flat mean over all 11 Technology aspects, which weights the 6-aspect Technical
  Infrastructure Management sub-dimension above the 5-aspect Application Management
  one. The rule is the mean of the two sub-dimension means. **A state's exported
  Technology figure can therefore change** — for example an area with Infrastructure
  all at 5 and Application all at 1 exported 3.2 and now correctly exports 3.0. This is
  a weighting correction, not rounding, so it does not diminish with more data. The CSV
  maturity profile is the artifact submitted to CMS, and it previously disagreed with
  the score the tool's own Results screen displayed for the same inputs
- **To-Be (target) Technology score**, same weighting error, in the CSV profile and on
  the Results screen. All scoring now delegates to the single canonical
  `calculateDimensionScore`
- **Aggregate dimensions were missing from PDF reports entirely** (OBS-3). A Data
  Management area's report showed Business Architecture and Technology but omitted
  Information, because the generator iterates actual ratings and aggregate dimensions
  have none by design. They now appear with their score and an
  `(Aggregate from N assessments)` note, matching the CSV and the Results screen
- **PDF labelled unassessed aspects as "N/A"** (OBS-2, fixed earlier in this branch,
  now covered by tests at the export boundary). Unassessed (`0`) reports as "Not Rated";
  only a genuine N/A determination (`-1`) reports as "N/A"
- `(Aggregate from 1 assessments)` now reads `(Aggregate from 1 assessment)`

### Changed

- **The PDF executive summary's "ORBIT Dimension Summary" is now the mean of per-area
  dimension scores, counting finalized assessments only.** It previously averaged every
  rating across all areas, so it was weighted by aspect count _and_ by how many areas
  had been assessed, and it silently included in-progress assessments while the domain
  table immediately above it counted finalized ones. A new "Areas" column shows the
  denominator

### Added

- Draft notice in every export format (PDF cover band and page footers, CSV, JSON, ZIP
  manifest), matching the in-app banner. Setting `VITE_DRAFT_MODE=false` removes it
  from the app and all exports in one build variable
- **Second disclaimer notice at the foot of every page**, carrying the Paperwork Reduction
  Act statement. CMS requires a notice at both the top and the bottom, with different
  wording in each

### Changed

- **Disclaimer wording replaced with CMS-supplied text.** Both notices now open
  "Predecisional Pilot Materials:". The top notice states the materials are preliminary
  and being made available for limited review and testing in support of MITA 4.0 pilot
  activities; the bottom notice adds that they do not represent final agency policy or
  requirements and may not be used for an information collection subject to the PRA until
  applicable PRA requirements, including OMB approval where required, have been satisfied.
  Exports carry the full statement, since an artifact circulating without the PRA language
  is the specific risk the disclaimer covers. The wording is reproduced verbatim and the
  two bodies differ, so neither is derived from the other

## [4.0.0] - 2026-07-30

This major release aligns the tool with the revised MITA 4.0 Capability Reference Model presented by the BA working group (July 2026, slides 4–6 of the capability overview deck). The ORBIT maturity criteria are unchanged — all 41 aspects and level definitions remain the May 3, 2026 PRA submission verbatim. It is a clean break from prior data: IndexedDB clears existing assessment data on first load because capability area ids changed. See `docs/decisions/CAPABILITY_MODEL_UPDATE_PLAN.md` for the full scope record and decision log.

### Restructured

- **Capability model totals**: 16 domains / 66 areas → **14 domains / 72 areas** (Strategic 3/10, Core 7/33, Support 4/29)
- **Enterprise Architecture domain**: moved Support → **Strategic**; now contains the single combined **Enterprise Governance** capability area hosting all 15 organizational aspects in three sections (Organizational Outcomes, Organizational Roles, Organizational Enterprise Architecture)
- **Organizational assessments consolidated**: the three separate organizational areas (`organizational-outcomes`, `organizational-roles`, `organizational-enterprise-architecture`) merged into the one `enterprise-governance` area; the Enterprise Governance domain was dissolved
- **Combined organizational scoring**: overall score = average of the three section averages (sections without assessed aspects excluded), mirroring how B-I-T assessments average dimension scores; sections weigh equally regardless of aspect counts (pending working-group affirmation in staging)
- **Category tier removed**: the metamodel is strictly Domain → Area; Data Management and Technology Management areas are flat lists

### Added

- **"Information Management" pattern**: every business domain has an `<X> Information Management` capability area (11 total; 9 new — Contract and Financial already existed)
- **Information Management guidance banner**: warning notice on Information Management area assessment pages explaining the assess-once-per-domain guidance (per BA working group meeting decision; conditional/aggregate workflow explicitly deferred)
- New capability areas: Program Administration, Strategy Oversight and Accountability, Contractor Support Management, Provider Eligibility, and the 9 new Information Management areas — all with marked placeholder descriptions pending the updated Capability Reference Model document from NextGen
- History view now renders the combined organizational assessment (sections and aspects); previously organizational snapshots displayed empty B-I-T pages
- Import validation: assessments and history entries referencing capability areas not in the current model are skipped with reason "Capability area not in current model" (prevents unreachable orphan records from v3 exports)
- CSV maturity profiles for the organizational assessment include `Section:` label rows grouping each section's aspects; the parser skips label rows on import
- Database schema v4 migration (clean break, clears all data)
- Archived sources under `docs/source-documents/2026-07-30/` (deck, meeting transcript, authoritative slide extraction); `scripts/extract-pptx.py` and `scripts/generate-capabilities-v4.py`

### Changed

- Renamed domains: Enterprise Data Management → **Data Management**; Enterprise Technology → **Technology Management** (ids `data-management`/`technical` retained; aggregate dimension behavior unchanged)
- Renamed areas: Provider Screening → **Provider Eligibility** (placeholder description; slide 5 authoritative), Maintain Strategic Plan → **Strategic Plan Maintenance**, Develop Agency Roadmap → **Strategic Roadmap Management**, Member Eligibility/Enrollment Management → **Member Eligibility**/**Member Enrollment**, Accounts Receivable/Payable → **Accounts Receivable/Payable Management**, Data Quality → **Data Quality Management**, Data Storage and Warehousing → **Data Storage, Operations, and Warehousing**
- Waiver Management moved from Care and Service Coordination to Plan and Policy Management
- Completion percentages now use per-area denominators: 15 aspects for the combined organizational area, standard aspects minus the aggregated dimension for enterprise-domain areas (16 for Data Management areas, 15 for Technology Management areas), 26 otherwise — fixes the prior fixed-26 divisor
- Assessment sidebar groups the organizational assessment's aspects under section headers; fixed a list-structure accessibility violation in the organizational navigation
- PDF export renders the organizational assessment per section with section subheaders
- In-app copy (Landing, Guide) updated to 72 areas and the combined organizational assessment

### Removed

- Business Relationship Management domain and its 2 areas
- Enterprise Governance domain (dissolved into the combined area)
- Capability areas: State Plan Administration, Business Intelligence & Data Science
- `CategorizedCapabilityDomain`/`CapabilityCategory` types and all category handling

## [3.0.0] - 2026-06-03

This is a major release that ingests the final MITA workgroup PRA submission (May 3, 2026) as the official source of truth for the MITA 4.0 maturity criteria. It is a clean break from prior data — IndexedDB will clear existing assessment data on first load to avoid orphaned ratings.

This release supersedes an unreleased April 26 v3.0.0 working draft. Users upgrading from v2.1.0 see the cumulative changes summarized below; the underlying model is the May 3 PRA submission verbatim.

### Restructured (vs v2.1.0)

- **Business Architecture**: Reworked from 7 enterprise-flavored aspects to 5 process-focused aspects (`Business Process Performance`, `Business Process Documentation`, `Business Process Governance`, `Business Process Automation`, `Business Process Reporting`)
- **Information**: Reworked from 11 data-management aspects to 10 information-focused aspects with new ordering (`Information Classification` first); `Metadata Management`, `Information Reporting`, and `Information Metadata` removed per workgroup direction
- **Technology**: Consolidated from 22 aspects across 7 sub-dimensions to 11 aspects across 2 sub-dimensions (`Technical Infrastructure Management` with 6 aspects; `Application Management` with 5 aspects)
- **Outcomes & Roles**: Extracted to organizational-level assessments under a new `Enterprise Governance` Support-layer domain. Outcomes has 6 aspects; Roles has 5 (was 6 — `Technology Resources` removed in May 3 source)
- **Enterprise Architecture**: New organizational-level assessment under a new `Enterprise Architecture` Support-layer domain with 4 aspects (`Business Capability`, `Enterprise Architecture`, `Policy Management`, `Strategic Planning`) — extracted from the old Business Architecture
- **Technical capability domain**: Restructured from 7 categories / 22 areas to 2 categories / 11 areas, mirroring the Technology dimension
- **Capability totals**: 75 areas / 14 domains → 66 areas / 16 domains
- **Aspect totals**: 52 → 41 (26 standard + 15 organizational)

### Added

- New source document `MITA Maturity Criteria_PRA Submission 2026-05-03.docx` archived under `docs/source-documents/2026-05-03/`
- `scripts/extract-new-docx.py` to extract aspects from the May 3 PRA submission docx
- `scripts/generate-orbit-model-v3.py` to generate `orbit-model.json` from the extracted aspects
- Database schema v3 migration that clears all existing data (model is incompatible with prior versions)
- New `enterprise-architecture-domain` capability domain (Support layer) with `organizational-enterprise-architecture` area
- New `enterprise-governance` capability domain (Support layer) with `organizational-outcomes` and `organizational-roles` areas
- `OrganizationalAssessmentId` and `RatingDimensionId` types
- Helper functions in `orbit.ts` for organizational assessments and enterprise-domain aggregates

### Changed

- **Maturity model now reflects May 3, 2026 PRA submission verbatim** — single official source replaces the prior April 26 working drafts
- Renamed dimension: `Information & Data` → `Information` (id `informationData` → `information`)
- Renamed domains: `Data Management` → `Enterprise Data Management`; `Technical` → `Enterprise Technology`
- Enterprise Data Management is now assessed B-T with Information shown as an aggregate of all other finalized assessments
- Enterprise Technology is now assessed B-I with Technology shown as an aggregate of all other finalized assessments
- `OrbitDimensionId` reduced to `'businessArchitecture' | 'information' | 'technology'` (Outcomes/Roles/EA moved to organizational assessments)
- Sub-dimension display name `Technology Infrastructure Management` → `Technical Infrastructure Management` (id `technologyInfrastructureManagement` retained for stability)
- Adopted source-verbatim Technology aspect names with one typo fix:
  - `Identify, Access, and Consent` → `Identity, Access and Consent` (typo corrected)
  - `Development, Testing, Release, and Security Compliance` → `Development, Testing, Release and Security Compliance`
  - `Business Rules and Workflow` → `Business Rules and Workflows`
  - `User Interface and Session Management` → `User Interfaces and Session Management`
- `capabilities.json` Technical capability area names and IDs aligned with the new Technology aspect names so platform-capability and platform-maturity views stay 1-to-1
- ORBIT model schema simplified per source: per-level question checklists removed in favor of one aspect-level question + per-level criteria + per-level "Suggested Documentation" (stored as `evidence`)
- Outcomes/Roles aspect descriptions and per-level descriptions populated from the docx (previously sparse)
- Dashboard groups domains by layer (Strategic, Core, Support) with section headers
- CSV export emits B-I-T rows for standard areas; organizational assessments use an `Aspect` header
- App version 2.1.0 → 3.0.0

### Removed

- Roles aspect `Technology Resources` (per May 3 source)
- Per-level question checklists in Information and Technology aspects (now a single aspect-level question per source)
- Outcomes/Roles dimensions from per-capability assessments (moved to organizational level)

### Documentation

- Restructured `docs/` into `source-documents/` (archived by date), `reference/` (reference snapshots), and `decisions/` (historic specs)
- Folded former `docs/updated-documents/` (April 26 drop) under `docs/source-documents/2026-04-26/`
- Folded former `docs/double-check-docs/` under `docs/source-documents/pre-pilot-originals/`
- Updated `README.md` and `PROJECT_FOUNDATION_v2.md` to describe the May 3 model

---

### Changed

- Extracted Outcomes and Roles from per-capability ORBIT dimensions to organizational-level assessments
- Standard capability assessments now use B-I-T dimensions only (Business Architecture, Information, Technology)
- Dashboard now groups domains by layer (Strategic, Core, Support) with visual section headers
- Assessment sidebar adapts to organizational assessments, showing aspects directly instead of dimensions
- Updated type system: `OrbitDimensionId` now only includes B-I-T; new `OrganizationalAssessmentId` for O&R
- New `RatingDimensionId` union type for flexible rating storage supporting both assessment types
- CSV export now generates B-I-T only rows for standard assessments (was O-R-B-I-T)
- CSV export uses "Aspect" column header for organizational assessments instead of "ORBIT"
- CSV parser now handles both "ORBIT" and "Aspect" column headers for import compatibility
- Area Results page now shows radar chart for B-I-T dimensions (standard) or bar chart for aspects (organizational)
- Area Results page displays aspect-level table for organizational assessments instead of dimension scores table

### Added

- New "Enterprise Governance" domain in Support Layer with two capability areas:
  - Organizational Outcomes: Assesses enterprise-wide outcome maturity (6 aspects)
  - Organizational Roles: Assesses enterprise-wide role management maturity (6 aspects)
- New organizational assessment functions in `orbit.ts`: `getOrganizationalAssessment`, `getOrganizationalAspects`, `getOrganizationalAspectCount`, `getOrganizationalAspect`
- New helper functions in `constants/index.ts`: `isOrganizationalAssessmentArea`, `getOrganizationalAssessmentType`
- Layer grouping in dashboard with color-coded headers (Strategic: blue, Core: green, Support: purple)
- Organizational assessment navigation mode in AssessmentSidebar for direct aspect selection
- Import service now filters ratings based on assessment type:
  - Standard assessments: only import B-I-T ratings, skip orphaned O&R ratings from old exports
  - Organizational assessments: only import outcomes/roles ratings, skip B-I-T ratings
- New tests for B-I-T only filtering and organizational assessment import handling
- New tests for organizational assessment CSV format with "Aspect" header

---

## [2.0.5] - 2026-01-28

### Changed

- Renamed ORBIT dimension "Information & Data" to "Information" (ID: `informationData` → `information`)
- Renamed domain "Data Management" to "Enterprise Data Management"
- Renamed domain "Technical" to "Enterprise Technology"
- Enterprise Data Management domain now assesses B-T only; Information dimension shows aggregate score from all other finalized assessments
- Enterprise Technology domain now assesses B-I only; Technology dimension shows aggregate score from all other finalized assessments
- Aggregate dimension scores are included in overall capability score calculations for enterprise domains
- Updated CSV export template to use "Information" instead of "Information & Data"
- Updated PDF export to reflect new dimension and domain names
- History snapshots for enterprise domains now store aggregate score at snapshot time for point-in-time accuracy
- CSV export now includes "(Aggregate from X assessments)" note for aggregate dimensions
- JSON/ZIP export now includes `enterpriseAggregates` metadata with contributing assessment IDs
- Improved assessment sidebar layout with column headers (Dimension, Prog, Score) for better clarity
- Technology dimension now displays as a parent row with rolled-up progress and score, with sub-dimensions indented underneath
- Progress indicators now use color-coded chips: plain text for not started, amber for in progress, green with checkmark for complete
- Streamlined dimension header in assessment view by removing redundant progress display (already shown in sidebar)
- Dimension header now uses inline layout for more compact appearance

### Added

- New `AggregateDimensionView` component for displaying aggregate scores in enterprise domains
- Aggregate dimension indicator in assessment sidebar with score preview
- Score breakdown view showing contributing assessments for aggregate dimensions
- New helper functions in `orbit.ts`: `getAggregatedDimensionForDomain`, `isAggregatedDimension`, `hasAggregatedDimension`, `isEnterpriseDomain`
- New `getAggregateDimensionScore` function in `useScores` hook for calculating aggregate scores
- Enterprise domain configuration constants: `ENTERPRISE_DOMAIN_IDS`, `DOMAIN_AGGREGATE_DIMENSIONS`
- `AggregateSnapshotData` type for storing aggregate metadata in history snapshots
- `ExportAggregateData` and `ExportEnterpriseAssessment` types for export metadata
- History view now properly displays stored aggregate scores for enterprise domain snapshots
- Import backwards compatibility: files exported with old `informationData` dimension ID are automatically mapped to `information` during import

### Removed

- Removed "opt" labels from optional dimensions in sidebar (Outcomes, Roles) to reduce visual clutter

## [2.0.4] - 2026-01-28

### Changed

- Consolidated duplicate history snapshot logic into shared `src/services/history.ts` service
- Unified scoring calculations to use `calculateAverageScore` from `scoring.ts` across all files
- Extracted tag management operations into shared `src/services/tags.ts` service
- Export service now uses build-time injected `__APP_VERSION__` instead of hardcoded version

### Added

- New `src/services/history.ts` with `createHistorySnapshot`, `calculateDimensionScores`, and `toHistoricalRatings` utilities
- New `src/services/tags.ts` with `incrementTagUsage`, `createTag`, `deleteTag`, `renameTag`, and `cleanupUnusedTags` utilities
- Comprehensive test coverage for new history service (16 tests)
- Comprehensive test coverage for new tags service (18 tests)

## [2.0.3] - 2026-01-28

### Fixed

- Fixed attachment upload bug where files would attach to the first aspect in a dimension instead of the selected aspect. The issue was caused by duplicate HTML element IDs across multiple AttachmentUpload components; now uses React's useId() hook to generate unique IDs.
- Fixed duplicate attachment filename bug in export/import: when multiple attachments had the same filename, only one would be preserved after export/import cycle. Export now uses unique filenames with embedded attachment IDs, and import matches by ID with fallback to filename for backward compatibility.

## [2.0.2] - 2026-01-25

### Added

- 404 Not Found page for invalid routes within the application
- GitHub Pages SPA redirect support to fix browser refresh on deep links

### Changed

- Renamed `/about` route to `/guide` to avoid conflict with GitHub Pages reserved paths

### Fixed

- Browser refresh on any route now correctly reloads the page instead of showing GitHub's 404
- Fixed infinite scroll issue on Results page when assessments are displayed
- Fixed scroll jumping when selecting domains/areas in Results by Domain section

## [2.0.1] - 2026-01-25

### Fixed

- Navigation now scrolls to top of page when clicking header links
- Assessment dimension sidebar navigation now scrolls content to top when switching dimensions

## [2.0.0] - 2026-01-25

The MITA tool 2.0 release implements the complete ORBIT Maturity Model assessment workflow as defined in the MITA 4.0 framework.

### Features

- **Dashboard**: Hierarchical view of all 14 capability domains and 75 capability areas with progress tracking, status indicators, and tag-based filtering
- **ORBIT Assessment Workflow**: Complete assessment interface for all 52 aspects across 5 dimensions (Outcomes, Roles, Business Architecture, Information & Data, Technology)
- **Maturity Rating**: 5-level maturity scale (Initial → Optimized) plus N/A option, with current level and target level ("To Be") tracking
- **Question Checklists**: Guided assessment questions and evidence tracking per maturity level
- **File Attachments**: Support for PDF, DOC, XLS, and image attachments stored locally in IndexedDB
- **Auto-Save**: Debounced auto-save for seamless editing with notes, barriers, and advancement plans per aspect
- **Assessment History**: Snapshots of finalized assessments for tracking progress over time
- **Results Visualization**: Domain and capability area score breakdowns with dimension-level detail

### Export Capabilities

- **PDF Export**: Professional reports for stakeholder presentations
- **CSV Export**: CMS Maturity Profile standard format for MESH upload
- **JSON Export**: Full data backup for restore or migration
- **ZIP Export**: Complete package with JSON data, PDF report, and all attachments

### Technical Foundation

- Privacy-first architecture: all data stored locally in browser (IndexedDB via Dexie.js)
- Offline-first PWA: full functionality after initial load without network
- WCAG 2.1 AA accessibility compliance for government use
- React 18 with TypeScript strict mode
- Material UI v6 with USWDS-aligned color theme
- Comprehensive test suite with Vitest and React Testing Library
