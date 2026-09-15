/**
 * Mutation harness: proves every 508 assertion in `workbook.test.ts` can actually fail.
 *
 * ## Why this exists
 *
 * Wave 5 shipped three assertions over a generated PDF that could not fail, each
 * satisfied by unrelated content elsewhere in the document. The workbook's 508 checks
 * have exactly that shape: "no merged cells", "document properties populated" and "no
 * blank rows" all pass trivially on an empty or half-built workbook. A green suite
 * therefore proves nothing on its own.
 *
 * So each assertion is verified by breaking the thing it covers and confirming the test
 * goes red. Two genuinely vacuous assertions were found this way and fixed — both
 * self-referential, comparing the workbook against the same constant it was generated
 * from, so mutating the constant moved both sides and the test stayed green. That class
 * of defect is invisible to review and invisible to a passing suite.
 *
 * ## Kept rather than deleted
 *
 * Wave 7 adds sheets `06`-`09` with more assertions of the same shape, and this is what
 * validates them. It is also the evidence that the 508 suite is real, which matters when
 * CMS asks what the accessibility claim rests on.
 *
 * ## Safety
 *
 * It **mutates generator source files in place**, backing them up to a temp directory
 * first and restoring after each case. Signal and exit handlers restore as well, so a
 * Ctrl-C mid-run does not leave a mutation on disk. Even so, run it on a clean tree: if
 * the process is killed with SIGKILL, the backup in `os.tmpdir()` is the only copy.
 *
 * Run: `node scripts/xlsx/prove-assertions.ts`
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

/** One mutation: break something, name the test that must notice. */
interface MutationCase {
  /** The 508 requirement or behaviour being proved. */
  assertion: string;
  /** Generator source file to mutate. */
  file: string;
  /** Exact source text to replace. Reported if it no longer matches. */
  find: string;
  replace: string;
  /** Substring of the test name that must go red, passed to vitest's `-t`. */
  test: string;
  /** Which suite holds that test. Defaults to the reload-based 508 suite. */
  testFile?: string;
}

const DEFAULT_TEST_FILE = 'scripts/xlsx/workbook.test.ts';

interface MutationResult extends MutationCase {
  outcome: string;
  detail?: string;
}

const SOURCES = [
  'scripts/xlsx/workbook.ts',
  'scripts/xlsx/rows.ts',
  'scripts/xlsx/constants.ts',
  'scripts/xlsx/readme.ts',
  'scripts/xlsx/model.ts',
  'scripts/xlsx/paths.ts',
];

/**
 * Each case: the assertion under test, the file to mutate, the exact string to replace,
 * its replacement, and a `-t` filter naming the test that must fail.
 *
 * The mutations are deliberately *plausible* rather than absurd — a real off-by-one in
 * the validation loop, a real `topics: joinList(area.topics)` that goes empty on the one
 * area whose topics array is empty, a real `hidden: true` on the identifier columns.
 * An absurd mutation proves a test can fail; a plausible one proves it would catch the
 * bug someone is actually going to write.
 */
export const MUTATION_CASES: MutationCase[] = [
  {
    assertion: 'no merged cells',
    file: 'scripts/xlsx/workbook.ts',
    find: `  titleRow.height = 26;`,
    replace: `  sheet.mergeCells(HEADER_ROW, 1, HEADER_ROW, 2);\n  titleRow.height = 26;`,
    test: 'has no merged cell range on any sheet',
  },
  {
    assertion: 'header is on row 2',
    file: 'scripts/xlsx/constants.ts',
    find: `export const HEADER_ROW = 2;`,
    replace: `export const HEADER_ROW = 3;`,
    test: 'places the notice on row 1, the single header row on row 2, and data from row 3',
  },
  {
    assertion: 'header fill appears on exactly one row',
    file: 'scripts/xlsx/workbook.ts',
    find: `  cell.font = { bold: true, color: { argb: COLORS.noticeFont }, size: 11 };`,
    replace: `  cell.font = { bold: true, color: { argb: COLORS.noticeFont }, size: 11 };\n  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerFill } };`,
    test: 'carries the header fill on exactly one row',
  },
  {
    assertion: 'header tuple appears exactly once',
    file: 'scripts/xlsx/rows.ts',
    find: `  return rows;\n}\n\n// =============================================================================\n// 05_Organizational_Input`,
    replace: `  rows.push(\n    Object.fromEntries(\n      Object.keys(rows[0] ?? {}).map((key) => [\n        key,\n        ({\n          domainName: 'Capability Domain',\n          areaName: 'Capability Area',\n          informationManagement: 'Information Management Area',\n          dimensionName: 'Dimension',\n          subDimensionName: 'Sub-Dimension',\n          aspectName: 'Aspect',\n          aspectQuestion: 'Aspect Question',\n          currentLevel: 'As-Is Level (enter value)',\n          targetLevel: 'To-Be Level (enter value)',\n          notes: 'Notes (enter value)',\n          barriers: 'Barriers and Challenges (enter value)',\n          plans: 'Advancement Plans (enter value)',\n          domainId: 'Domain ID',\n          areaId: 'Capability Area ID',\n          dimensionId: 'Dimension ID',\n          subDimensionId: 'Sub-Dimension ID',\n          aspectId: 'Aspect ID',\n        })[key] ?? '',\n      ])\n    )\n  );\n  return rows;\n}\n\n// =============================================================================\n// 05_Organizational_Input`,
    test: 'repeats the header tuple nowhere else',
  },
  {
    assertion: 'no blank rows',
    file: 'scripts/xlsx/workbook.ts',
    find: `    sheetRow.commit();
    rowNumber += 1;
  }`,
    replace: `    sheetRow.commit();
    rowNumber += 1;
    if (row.kind === 'heading') {
      rowNumber += 1;
    }
  }`,
    test: 'has no wholly blank row on any sheet',
  },
  {
    assertion: 'reference columns are populated everywhere',
    file: 'scripts/xlsx/rows.ts',
    find: `    topics: area.topics.length > 0 ? joinList(area.topics) : 'None listed',`,
    replace: `    topics: joinList(area.topics),`,
    test: 'populates every reference column on every data row',
  },
  {
    assertion: 'editable columns are the only empty ones',
    file: 'scripts/xlsx/rows.ts',
    find: `          notes: '',
          barriers: '',
          plans: '',
          domainId: domain.id,`,
    replace: `          notes: 'placeholder',
          barriers: '',
          plans: '',
          domainId: domain.id,`,
    test: 'leaves exactly the editable columns empty',
  },
  {
    assertion: 'input fill implies a textual header signal',
    file: 'scripts/xlsx/workbook.ts',
    find: `      if (column.editable) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputFill } };`,
    replace: `      if (column.editable || column.key === 'aspectQuestion') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputFill } };`,
    test: 'gives every input-filled cell a header that says so in words',
  },
  {
    assertion: 'editable headers carry the suffix',
    file: 'scripts/xlsx/constants.ts',
    find: `  return column.editable ? \`\${column.header}\${EDITABLE_HEADER_SUFFIX}\` : column.header;`,
    replace: `  return column.header;`,
    test: 'suffixes every editable column header and no other',
  },
  {
    assertion: 'no images embedded in the workbook',
    file: 'scripts/xlsx/workbook.ts',
    find: `  addReadmeSheet(workbook);`,
    replace: `  const imageId = workbook.addImage({\n    buffer: Buffer.from(\n      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AEB1n8AAAAASUVORK5CYII=',\n      'base64'\n    ),\n    extension: 'png',\n  });\n  addReadmeSheet(workbook);\n  workbook.worksheets[0]?.addImage(imageId, 'D1:E4');`,
    test: 'embeds no media in the workbook',
  },
  {
    assertion: 'no image placed on any sheet',
    file: 'scripts/xlsx/workbook.ts',
    find: `  addReadmeSheet(workbook);

  addTableSheet(workbook, {
    name: SHEET_NAMES.MATURITY_LEVELS,`,
    replace: `  addReadmeSheet(workbook);
  const proveImageId = workbook.addImage({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AEB1n8AAAAASUVORK5CYII=',
      'base64'
    ),
    extension: 'png',
  });
  workbook.worksheets[0]?.addImage(proveImageId, 'D1:E4');

  addTableSheet(workbook, {
    name: SHEET_NAMES.MATURITY_LEVELS,`,
    test: 'places no image on any sheet',
  },
  {
    assertion: 'document properties are populated',
    file: 'scripts/xlsx/workbook.ts',
    find: `  workbook.creator = 'MITA 4.0 State Self-Assessment Tool';`,
    replace: `  workbook.creator = '';`,
    test: 'sets creator to a non-trivial value that survives serialization',
  },
  {
    assertion: 'notice in A1 of every sheet',
    file: 'scripts/xlsx/workbook.ts',
    find: `  cell.value = isDraft() ? DRAFT_NOTICE_SHORT_LINE : sheet.name;`,
    replace: `  cell.value = isDraft() && sheet.name === '00_README' ? DRAFT_NOTICE_SHORT_LINE : sheet.name;`,
    test: 'puts the short notice in A1 of every sheet',
  },
  {
    assertion: 'notice appears in the print footer',
    file: 'scripts/xlsx/workbook.ts',
    find: `    const footer = \`&L&8\${escapeHeaderFooter(DRAFT_NOTICE_SHORT_LINE)}\`;
    assertFooterFits(sheet.name, footer);
    sheet.headerFooter.oddFooter = footer;`,
    replace: `    const footer = '&L&8';
    sheet.headerFooter.oddFooter = footer;`,
    test: 'puts the notice in the print footer of every sheet, within Excel limits',
  },
  {
    assertion: 'full PRA statement is present somewhere, not only abbreviated',
    file: 'scripts/xlsx/workbook.ts',
    find: `  workbook.description = isDraft()
    ? \`\${DRAFT_NOTICE_LABEL}: \${DRAFT_NOTICE_FULL_BODY}\`
    : 'Offline workbook equivalent of the MITA 4.0 State Self-Assessment Tool.';`,
    replace: `  workbook.description = \`\${DRAFT_NOTICE_LABEL}: \${DRAFT_NOTICE_SHORT_LINE}\`;`,
    test: 'keeps the full PRA statement out of the footer but present in the workbook',
  },
  {
    assertion: 'selection of locked cells is never disabled',
    file: 'scripts/xlsx/workbook.ts',
    find: `    selectLockedCells: true,`,
    replace: `    selectLockedCells: false,`,
    test: 'never disables selection of locked or unlocked cells',
  },
  {
    assertion: 'sheet protection is enabled',
    file: 'scripts/xlsx/workbook.ts',
    find: `  applyPrintSetup(sheet);
  protectSheet(sheet);
}

/**
 * Freeze the notice row`,
    replace: `  applyPrintSetup(sheet);
}

/**
 * Freeze the notice row`,
    test: 'enables sheet protection on every sheet',
  },
  {
    assertion: 'editable cells are unlocked',
    file: 'scripts/xlsx/workbook.ts',
    find: `        // Unlocked before the sheet-level protection below, which locks everything else.
        cell.protection = { locked: false };`,
    replace: `        // Unlocked before the sheet-level protection below, which locks everything else.`,
    test: 'unlocks exactly the editable cells',
  },
  {
    assertion: 'no column is hidden',
    file: 'scripts/xlsx/workbook.ts',
    find: `    sheetColumn.alignment = { vertical: 'top', wrapText: column.wrap === true };`,
    replace: `    sheetColumn.alignment = { vertical: 'top', wrapText: column.wrap === true };
    if (column.identifier) {
      sheetColumn.hidden = true;
    }`,
    test: 'hides no column on any sheet',
  },
  {
    assertion: 'named range excludes identifier columns',
    file: 'scripts/xlsx/workbook.ts',
    find: `  const lastNonIdentifierIndex = lastIndexOfNonIdentifier(spec.columns);`,
    replace: `  const lastNonIdentifierIndex = spec.columns.length - 1;`,
    test: 'scopes its range from the header to the last content column',
  },
  {
    assertion: 'level validation covers every data row',
    file: 'scripts/xlsx/workbook.ts',
    find: `  const range = \`\${cellReference(FIRST_DATA_ROW, first)}:\${cellReference(lastRow, last)}\`;`,
    replace: `  const range = \`\${cellReference(FIRST_DATA_ROW + 1, first)}:\${cellReference(lastRow, last)}\`;`,
    test: 'validates both level columns on all',
  },
  {
    assertion: 'README lists every sheet including the unbuilt ones',
    file: 'scripts/xlsx/readme.ts',
    find: `    ...Object.values(SHEET_NAMES).map((sheetName) =>`,
    replace: `    ...WAVE_6_SHEET_NAMES.map((sheetName) =>`,
    test: 'lists every sheet in the workbook, built or not',
  },
  {
    assertion: 'README quotes a row count matching the sheet',
    file: 'scripts/xlsx/readme.ts',
    find: `      \`Sheet \${SHEET_NAMES.ASSESSMENT_INPUT} has \${assessmentRowCount.toLocaleString('en-US')} \` +`,
    replace: `      \`Sheet \${SHEET_NAMES.ASSESSMENT_INPUT} has \${(assessmentRowCount + 1).toLocaleString('en-US')} \` +`,
    test: 'quotes a row count that matches the sheet it describes',
  },
  {
    assertion: 'palette clears WCAG AA',
    file: 'scripts/xlsx/constants.ts',
    find: `  headerFill: 'FF1A4480',`,
    replace: `  headerFill: 'FFBBBBBB',`,
    test: 'keeps the header, notice and input palettes above WCAG AA for their text',
  },
  {
    assertion: 'notice is the app banner red',
    file: 'scripts/xlsx/constants.ts',
    find: `  noticeFont: 'FFB0142F',`,
    replace: `  noticeFont: 'FFE31C3D',`,
    test: 'renders the notice in the measured 7.03:1 app banner red, bold',
  },
  {
    assertion: 'row counts per sheet',
    file: 'scripts/xlsx/rows.ts',
    find: `  for (const { domain, area } of getStandardAreasWithDomains()) {
    for (const dimensionId of getInputDimensionsForArea(area.id, domain.id)) {`,
    replace: `  for (const { domain, area } of getStandardAreasWithDomains()) {
    for (const dimensionId of ORBIT_DIMENSION_IDS) {`,
    test: 'has the expected row count on each sheet',
  },

  // ---------------------------------------------------------------------------
  // Raw-OOXML suite. These cover the requirements where the file format is the
  // ground truth and ExcelJS's reader normalises the difference away.
  // ---------------------------------------------------------------------------
  {
    assertion: 'raw: one validation element, not two overlapping',
    file: 'scripts/xlsx/workbook.ts',
    find: `  const range = \`\${cellReference(FIRST_DATA_ROW, first)}:\${cellReference(lastRow, last)}\`;
  asRangeValidatable(sheet).dataValidations.add(range, {
    type: 'list',
    allowBlank: true,
    formulae: [\`"\${LEVEL_DROPDOWN_VALUES.join(',')}"\`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Not a valid maturity level',
    error: \`Enter one of: \${LEVEL_DROPDOWN_VALUES.join(', ')}. Leave the cell blank if you have not assessed this aspect yet.\`,
  });`,
    replace: `  for (const columnIndex of levelColumnIndexes) {
    for (let row = FIRST_DATA_ROW; row <= lastRow; row += 1) {
      sheet.getCell(row, columnIndex).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [\`"\${LEVEL_DROPDOWN_VALUES.join(',')}"\`],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Not a valid maturity level',
        error: \`Enter one of: \${LEVEL_DROPDOWN_VALUES.join(', ')}. Leave the cell blank if you have not assessed this aspect yet.\`,
      };
    }
  }`,
    test: 'declares exactly one validation covering',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'raw: no mergeCell element',
    file: 'scripts/xlsx/workbook.ts',
    find: `  titleRow.height = 26;`,
    replace: `  sheet.mergeCells(HEADER_ROW, 1, HEADER_ROW, 2);\n  titleRow.height = 26;`,
    test: 'emits no mergeCell element on any sheet',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'raw: no media part in the archive',
    file: 'scripts/xlsx/workbook.ts',
    find: `  addReadmeSheet(workbook);

  addTableSheet(workbook, {
    name: SHEET_NAMES.MATURITY_LEVELS,`,
    replace: `  addReadmeSheet(workbook);
  const proveImageId = workbook.addImage({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AEB1n8AAAAASUVORK5CYII=',
      'base64'
    ),
    extension: 'png',
  });
  workbook.worksheets[0]?.addImage(proveImageId, 'D1:E4');

  addTableSheet(workbook, {
    name: SHEET_NAMES.MATURITY_LEVELS,`,
    test: 'contains no media, drawing, or VML parts',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'raw: selectLockedCells is not blocked',
    file: 'scripts/xlsx/workbook.ts',
    find: `    selectLockedCells: true,`,
    replace: `    selectLockedCells: false,`,
    test: 'protects every sheet without blocking selection of locked cells',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'raw: protection uses no password',
    file: 'scripts/xlsx/workbook.ts',
    find: `  void sheet.protect('', {`,
    replace: `  void sheet.protect('mita', {`,
    test: 'sets no protection password',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'raw: PRA statement in the description property',
    file: 'scripts/xlsx/workbook.ts',
    find: `  workbook.description = isDraft()
    ? \`\${DRAFT_NOTICE_LABEL}: \${DRAFT_NOTICE_FULL_BODY}\`
    : 'Offline workbook equivalent of the MITA 4.0 State Self-Assessment Tool.';`,
    replace: `  workbook.description = \`\${DRAFT_NOTICE_LABEL}: short body only, no PRA statement here.\`;`,
    test: 'carries the PRA statement in the description property',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'go-live README omits the notice section',
    file: 'scripts/xlsx/readme.ts',
    find: `    ...(isDraft()
      ? [heading('Predecisional notice'), entry(DRAFT_NOTICE_LABEL, DRAFT_NOTICE_FULL_BODY)]
      : []),`,
    replace: `    heading('Predecisional notice'),
    entry(DRAFT_NOTICE_LABEL, DRAFT_NOTICE_FULL_BODY),`,
    test: 'carries no predecisional notice in any cell of any sheet',
  },
  {
    assertion: 'input fill is present on editable cells',
    file: 'scripts/xlsx/workbook.ts',
    find: `        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputFill } };`,
    replace: ``,
    test: 'fills every editable data cell and no reference cell',
  },
  {
    assertion: 'editable cells are ruled on all four sides',
    file: 'scripts/xlsx/workbook.ts',
    find: `        cell.border = { top: edge, left: edge, bottom: edge, right: edge };`,
    replace: `        cell.border = { top: edge, bottom: edge };`,
    test: 'rules every editable cell on all four sides and no reference cell',
  },
  {
    assertion: 'input border clears 3:1 on the fill',
    file: 'scripts/xlsx/constants.ts',
    find: `  inputBorder: 'FF8C8C8C',`,
    replace: `  inputBorder: 'FFD4D4D4',`,
    test: 'keeps the input border above 3:1 against the fill it sits on',
  },
  {
    assertion: 'gridlines print, matching the cell borders',
    file: 'scripts/xlsx/workbook.ts',
    find: `    showGridLines: true,`,
    replace: ``,
    test: 'prints gridlines so the ruling is consistent on paper',
  },
  {
    // Reverts to the pre-fix form: alignment only on the wrapping columns, leaving every
    // other column at Excel's bottom default. That is the state the user saw in Excel, where
    // typed notes floated above their own As-Is level.
    assertion: 'every column is aligned to the top of the row',
    file: 'scripts/xlsx/workbook.ts',
    find: `    sheetColumn.alignment = { vertical: 'top', wrapText: column.wrap === true };`,
    replace: `    if (column.wrap) {
      sheetColumn.alignment = { vertical: 'top', wrapText: true };
    }`,
    test: 'aligns every column of every table sheet to the top of the row',
  },
  {
    assertion: 'header columns leave room for the filter button',
    file: 'scripts/xlsx/constants.ts',
    find: `  flag: 22,`,
    replace: `  flag: 8,`,
    test: 'leaves room for the filter button beside every header word',
  },
  {
    assertion: 'page numbers survive in go-live mode',
    file: 'scripts/xlsx/workbook.ts',
    find: `    printTitlesRow: \`\${HEADER_ROW}:\${HEADER_ROW}\`,`,
    replace: ``,
    test: 'keeps the header row repeating on printed pages',
  },
  {
    assertion: 'footer length guard rejects an over-long footer',
    file: 'scripts/xlsx/workbook.ts',
    find: `  if (footer.length > HEADER_FOOTER_LIMIT) {`,
    replace: `  if (footer.length > HEADER_FOOTER_LIMIT * 10) {`,
    test: 'throws for a footer one character over the limit',
    testFile: 'scripts/xlsx/footer.test.ts',
  },
  {
    assertion: 'README writes no empty-string cells',
    file: 'scripts/xlsx/workbook.ts',
    find: `    sheetRow.getCell(1).value = row.label === '' ? null : row.label;
    sheetRow.getCell(2).value = row.value === '' ? null : row.value;`,
    replace: `    sheetRow.getCell(1).value = row.label;
    sheetRow.getCell(2).value = row.value;`,
    test: 'writes no empty-string text cells on any sheet',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'raw: editable cells are blank, not empty text',
    file: 'scripts/xlsx/workbook.ts',
    find: `      cell.value = value === undefined || value === '' ? null : value;`,
    replace: `      cell.value = value ?? '';`,
    test: 'leaves the level cells truly blank, not empty text',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    // Removes the build-time guard *and* over-lengthens, because with the guard in place
    // generation throws before the test can observe the footer — which is the guard working,
    // but it makes the assertion's own coverage unprovable. This proves the test would catch
    // an over-long footer if the guard were ever bypassed.
    assertion: 'raw: footer stays within Excel 255-char limit',
    file: 'scripts/xlsx/workbook.ts',
    find: `    assertFooterFits(sheet.name, footer);
    sheet.headerFooter.oddFooter = footer;`,
    replace: `    sheet.headerFooter.oddFooter = footer.padEnd(300, ' ');`,
    test: 'puts the notice in the footer of every sheet, within Excel 255-char limit',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
  {
    assertion: 'go-live mode leaves no blank row',
    file: 'scripts/xlsx/workbook.ts',
    find: `  cell.value = isDraft() ? DRAFT_NOTICE_SHORT_LINE : sheet.name;`,
    replace: `  cell.value = isDraft() ? DRAFT_NOTICE_SHORT_LINE : null;`,
    test: 'still has no wholly blank row on any sheet',
  },
  {
    assertion: 'go-live document properties drop the notice',
    file: 'scripts/xlsx/workbook.ts',
    find: `  workbook.title = \`\${draftPrefix}MITA 4.0 State Self-Assessment Workbook\`;`,
    replace: `  workbook.title = \`\${DRAFT_NOTICE_LABEL} — MITA 4.0 State Self-Assessment Workbook\`;`,
    test: 'carries no predecisional notice in any footer or document property',
  },
  {
    assertion: 'go-live README does not describe a notice',
    file: 'scripts/xlsx/readme.ts',
    find: `      'Every sheet has a single header row on row 2, directly under row 1. There are no merged ' +`,
    replace: `      'Every sheet has a single header row on row 2, directly under the notice on row 1. There are no merged ' +`,
    test: 'describes its own structure without referring to a notice',
  },
  {
    assertion: 'the editable signal is the literal words "(enter value)"',
    file: 'scripts/xlsx/constants.ts',
    find: `export const EDITABLE_HEADER_SUFFIX = ' (enter value)';`,
    replace: `export const EDITABLE_HEADER_SUFFIX = ' (X)';`,
    test: 'spells the editable signal out in words on an input column header',
  },
  {
    assertion: 'levels run 1-5 within every aspect',
    file: 'scripts/xlsx/rows.ts',
    find: `      for (const [index, levelKey] of LEVEL_KEYS.entries()) {
        rows.push({
          dimensionName: location.dimensionName,`,
    replace: `      for (const [rawIndex, levelKey] of LEVEL_KEYS.entries()) {
        const index = rawIndex === 4 ? 3 : rawIndex;
        rows.push({
          dimensionName: location.dimensionName,`,
    test: 'numbers levels 1 to 5 in order within every aspect',
    testFile: 'scripts/xlsx/rows.test.ts',
  },
  {
    assertion: 'workbook IM guidance keeps its load-bearing claims',
    file: 'scripts/xlsx/readme.ts',
    find: `  "the Information dimension in that domain's other capability areas. If you are assessing " +`,
    replace: `  "the other dimensions in that domain's other capability areas. If you are assessing " +`,
    test: 'makes every load-bearing claim in the workbook guidance',
    testFile: 'scripts/xlsx/readme.test.tsx',
  },
  {
    assertion: 'raw: header row repeats on printed pages',
    file: 'scripts/xlsx/workbook.ts',
    find: `    printTitlesRow: \`\${HEADER_ROW}:\${HEADER_ROW}\`,`,
    replace: ``,
    test: 'repeats the header row on printed pages of the table sheets',
    testFile: 'scripts/xlsx/workbook.raw.test.ts',
  },
];

/** Vitest colourises its summary, which defeats a naive regex over the output. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001B\[[0-9;]*m/g, '');
}

/**
 * `execSync` options.
 *
 * `maxBuffer` is raised because one mutation — adding an image — makes vitest dump every
 * image anchor and produces ~195 MB of output. At the 1 MB default `execSync` throws
 * `ENOBUFS` and the classifier then reads a prefix that does not contain the summary line,
 * so the outcome was decided by a coincidental substring match rather than by the summary.
 */
const EXEC_OPTIONS = { stdio: 'pipe', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 } as const;

function runCommand(testCase: MutationCase): string {
  const file = testCase.testFile ?? DEFAULT_TEST_FILE;
  // `--silent` suppresses per-test console output. Without it the image mutation makes
  // vitest dump every image anchor — roughly 195 MB — which overran the buffer and left
  // the classifier reading a prefix with no summary line in it.
  return `npx vitest run ${file} --silent -t ${JSON.stringify(testCase.test)}`;
}

/**
 * Decide what a non-zero vitest exit actually means.
 *
 * The distinction matters more than it looks. A loose `/\d+ failed/` also matches
 * `Test Files  1 failed (1)`, which vitest prints on a **collection error** — so a mutation
 * that broke the module at import time, running zero assertions, was reported as proof that
 * the assertion works. `41 of 41` is the evidence behind the accessibility claim, and it
 * cannot rest on a check that a broken import satisfies.
 *
 * So the summary line is required, and "no tests ran" is its own outcome that counts
 * against the total rather than for it.
 */
function classifyFailure(output: string): string {
  if (/Tests\s+no tests/.test(output)) {
    return 'NO-ASSERTION-RAN';
  }
  if (/Tests\s+\d+\s+failed/.test(output)) {
    return 'FAILS-AS-EXPECTED';
  }
  return 'ERRORED';
}

/**
 * Run every mutation.
 *
 * Wrapped in a function, and only invoked when this module is the process entry point, so
 * that `footer.test.ts` can import `MUTATION_CASES` to check for staleness without
 * triggering a multi-minute run that rewrites source files mid-test.
 */
function proveAssertions(): void {
  const backupDir = mkdtempSync(join(tmpdir(), 'xlsx-prove-'));
  for (const source of SOURCES) {
    copyFileSync(source, join(backupDir, source.replace(/\//g, '_')));
  }

  function restore(): void {
    for (const source of SOURCES) {
      copyFileSync(join(backupDir, source.replace(/\//g, '_')), source);
    }
  }

  /**
   * Restore on any exit path, not just the happy one.
   *
   * Without this, interrupting the run leaves a deliberately broken generator on disk —
   * and the mutations are plausible enough that the damage would not be obvious from a
   * glance at the diff.
   */
  process.on('exit', restore);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => {
      restore();
      process.exit(1);
    });
  }

  const results: MutationResult[] = [];

  for (const testCase of MUTATION_CASES) {
    const original = readFileSync(testCase.file, 'utf8');

    if (!original.includes(testCase.find)) {
      // The generator changed and this mutation no longer applies. Reported rather than
      // skipped silently, because a stale mutation is an unproved assertion.
      // `footer.test.ts` catches this case in milliseconds so it does not depend on
      // somebody remembering to run the slow harness.
      results.push({ ...testCase, outcome: 'MUTATION-NOT-APPLIED' });
      continue;
    }

    writeFileSync(
      testCase.file,
      original.replace(testCase.find, () => testCase.replace)
    );

    let outcome: string;
    try {
      const output = execSync(runCommand(testCase), EXEC_OPTIONS);
      // A zero exit with no matching test is not a pass — it means the -t filter did
      // not select anything, which would report every mutation as vacuous.
      outcome = /No test found/.test(stripAnsi(output))
        ? 'FILTER-MATCHED-NOTHING'
        : 'VACUOUS-STILL-PASSES';
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      const output = stripAnsi(String(failure.stdout ?? '') + String(failure.stderr ?? ''));
      outcome = classifyFailure(output);
      if (outcome !== 'FAILS-AS-EXPECTED') {
        results.push({ ...testCase, outcome, detail: output.slice(-600) });
        restore();
        continue;
      }
    }

    results.push({ ...testCase, outcome });
    restore();
  }

  restore();

  console.log('\n=== Mutation results ===\n');
  let unproved = 0;
  for (const result of results) {
    const marker = result.outcome === 'FAILS-AS-EXPECTED' ? 'ok  ' : 'FAIL';
    console.log(`${marker} ${result.assertion.padEnd(50)} ${result.outcome}`);
    if (result.outcome !== 'FAILS-AS-EXPECTED') {
      unproved += 1;
      if (result.detail) {
        console.log(result.detail);
      }
    }
  }
  console.log(`\n${results.length - unproved} of ${results.length} assertions proved failable.`);
  if (unproved > 0) {
    console.log(
      'An assertion that stays green under its mutation is a defect in the test, not in the mutation.'
    );
  }
  process.exitCode = unproved === 0 ? 0 : 1;
}

/**
 * Only run when invoked directly, never on import.
 *
 * `footer.test.ts` imports `MUTATION_CASES` to check the mutations are still current, and
 * without this guard that import would kick off a multi-minute run that rewrites generator
 * source files while the suite is executing.
 */
if (process.argv[1] !== undefined && process.argv[1].endsWith('prove-assertions.ts')) {
  proveAssertions();
}
