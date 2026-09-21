/**
 * Repository-root-relative path resolution for the workbook generator.
 *
 * ## Why this is not `new URL('../../thing', import.meta.url)`
 *
 * That is the idiomatic Node form, and it breaks here — but only under vitest, which
 * is the worst way for it to break. **Vite statically recognises the exact syntactic
 * pattern `new URL(<string literal>, import.meta.url)` and rewrites it** into its own
 * asset-URL handling, which yields an `http://` URL. `fileURLToPath` then throws
 * `TypeError: The URL must be of scheme file`.
 *
 * The generator has to run in both worlds: directly under Node when it produces the
 * workbook, and under Vite's transform when the tests import it. So paths are resolved
 * from a bare `import.meta.url` — which Vite leaves alone — through `node:path`, which
 * it cannot statically analyse.
 *
 * Worth knowing that the failure was not uniform: `new URL('../../src/data/capabilities.json',
 * import.meta.url)` survived the rewrite while `new URL('../../package.json', import.meta.url)`
 * did not, so the generator ran fine and only one of three test files failed. A rule of
 * thumb that holds only sometimes is worse than one that never holds, which is why
 * every path in the generator goes through here rather than each module rolling its own.
 */

import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path of the repository root.
 *
 * Derived from this module's own location — `scripts/xlsx/paths.ts`, so two levels up
 * — rather than from `process.cwd()`. cwd would work for both current callers (npm
 * scripts and vitest both run from the package root) but would silently resolve to the
 * wrong place the first time someone runs the generator from a subdirectory.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Resolve a path relative to the repository root. */
export function fromRepoRoot(...segments: string[]): string {
  return join(REPO_ROOT, ...segments);
}

/**
 * The workbook's filename, in one place.
 *
 * Both the generated copy under `public/` and the shipped copy under `dist/` are built from
 * this, so a rename cannot leave the artifact check looking at a path the generator no longer
 * writes. Also duplicated — deliberately, as a literal — in `.gitignore` and in the in-app
 * download link, neither of which can import from here.
 */
const WORKBOOK_FILENAME = 'mita-4.0-self-assessment-workbook.xlsx';

/**
 * Where the workbook is written.
 *
 * Lives here rather than in the generator because more than one consumer needs it — the generator
 * writes it and `verify-workbook-in-excel.ts` reads it — and the generator is a top-level script
 * that runs `main()` on import, so importing a constant from it would generate a workbook as a side
 * effect.
 *
 * The filename is stable and carries no version, so the guidance-site URL never breaks when the
 * model changes (Decision 14). Versions are printed inside the workbook on `00_README`. Also
 * referenced by the `.gitignore` entry, the in-app download links, and the CI check.
 */
export const WORKBOOK_OUTPUT_PATH = fromRepoRoot('public', WORKBOOK_FILENAME);

/**
 * Where the workbook ends up in the built site.
 *
 * Vite copies `public/` into `dist/` verbatim, so this is the same bytes at a different path —
 * and *that* is the thing worth checking, because it is the only copy a pilot user ever
 * downloads. `npm run verify:workbook-artifact` compares the two byte-for-byte and opens the
 * `dist/` one, which is end-to-end coverage the test suite cannot give: the suite builds a
 * workbook in memory and never touches either file.
 *
 * Kept beside `WORKBOOK_OUTPUT_PATH` and built from the same `WORKBOOK_FILENAME` so the two
 * cannot drift into checking different files.
 */
export const DIST_WORKBOOK_PATH = fromRepoRoot('dist', WORKBOOK_FILENAME);

/**
 * The timestamp stamped into the workbook, as a build input rather than "now".
 *
 * Two dates go into the artifact: the "Workbook generated" row on the README and the
 * `created`/`modified` document properties. Reading the clock makes the output differ on
 * every run, which forecloses the cheapest possible CI drift check — regenerate and diff
 * the bytes — and makes the file look changed when the model has not.
 *
 * `SOURCE_DATE_EPOCH` is the cross-ecosystem convention for this (Unix seconds). When it
 * is unset the clock is used, so local runs behave as expected and only CI needs to care.
 *
 * **Measured, so Wave 8 does not have to re-derive it:** with `SOURCE_DATE_EPOCH` fixed,
 * two runs produce *byte-identical unzipped content* — every part under `xl/` and
 * `docProps/` matches — but **different `.xlsx` bytes**, because ExcelJS stamps ZIP entry
 * timestamps it does not expose. So a CI drift check must unzip and diff the parts, or
 * simply regenerate and run the test suite. Diffing the `.xlsx` itself will report a
 * change on every run.
 */
export function getBuildTimestamp(): Date {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch === undefined || epoch.trim() === '') {
    return new Date();
  }

  const seconds = Number(epoch);
  if (!Number.isFinite(seconds)) {
    throw new Error(`SOURCE_DATE_EPOCH is not a number: ${epoch}`);
  }
  return new Date(seconds * 1000);
}
