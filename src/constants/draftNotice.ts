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
