/**
 * Draft disclaimer copy.
 *
 * Deliberately separate from `constants/index.ts` and deliberately free of any
 * `import.meta` reference. `import.meta.env` is `undefined` in plain Node ESM and
 * touching it throws, so a module that reads it cannot be imported by build-time
 * tooling. The XLSX generator runs under Node and has to stamp this same wording
 * into the workbook, so the copy has to live somewhere Node can reach.
 *
 * Keep this file dependency-free. The `IS_DRAFT` flag stays in `constants/index.ts`
 * because it is environment-dependent; Node consumers derive it from
 * `process.env.VITE_DRAFT_MODE` instead.
 */

/** Emphasised lead-in for the draft notice. */
export const DRAFT_NOTICE_LABEL = 'Draft';

/**
 * Body of the draft notice. Wording agreed with the MITA team: it has to convey
 * that the tool is a draft and still being piloted.
 */
export const DRAFT_NOTICE_BODY =
  'This is a draft version of the MITA 4.0 State Self-Assessment Tool. ' +
  'It is still being piloted and is subject to change.';

/**
 * The notice as a single line, for surfaces with no rich text: the CSV maturity
 * profile, the ZIP manifest, the JSON envelope, and the PDF.
 *
 * The label is uppercased because those surfaces cannot render it bold, so the
 * marker has to carry itself.
 *
 * **`DRAFT:` is a wire-format constant, not just presentation.** It is the prefix
 * `parseMaturityProfileCsv` matches on to skip the notice row, so renaming
 * `DRAFT_NOTICE_LABEL` would silently stop every CSV already exported during the
 * pilot from being parseable. Because the parser derives its prefix from this same
 * constant, a rename would keep the whole suite green while breaking files in the
 * field — so there is a test asserting the literal `'DRAFT:'` rather than the derived
 * value. Do not "fix" that test to use the constant.
 */
export const DRAFT_NOTICE_LINE = `${DRAFT_NOTICE_LABEL.toUpperCase()}: ${DRAFT_NOTICE_BODY}`;
