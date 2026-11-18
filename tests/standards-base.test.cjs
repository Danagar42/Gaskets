// tests/standards-base.test.cjs
const assert = require('assert');
const path = require('path');

// Mock browser globalThis
require('../standards.bundle.js');
const { StandardsCatalogAdapter } = require('../standards-base/src/catalog-adapter.js');

const db = globalThis.FlangeStandardsDB;
assert.ok(db, 'FlangeStandardsDB must be defined');

// 1. Categories
const categories = StandardsCatalogAdapter.getCategories(db);
assert.ok(Array.isArray(categories), 'Categories must be an array');
assert.ok(categories.some(c => c.id === 'fasteners'), 'Must include fasteners category');
const fastenersCategory = categories.find(c => c.id === 'fasteners');
assert.strictEqual(fastenersCategory.count, 10, 'Fasteners count must be 10');
assert.strictEqual(fastenersCategory.active, true, 'Fasteners category must be active');
assert.ok(categories.some(c => c.id === 'flanges' && c.status === 'upcoming'), 'Flanges must be upcoming');
assert.ok(categories.some(c => c.id === 'gaskets' && c.status === 'upcoming'), 'Gaskets must be upcoming');

// Test default DB resolution
const categoriesNoDb = StandardsCatalogAdapter.getCategories();
assert.strictEqual(categoriesNoDb.length, categories.length, 'getCategories() without DB argument should use globalThis.FlangeStandardsDB');

// 2. Standards list
const standards = StandardsCatalogAdapter.getStandards(db, 'fasteners');
assert.strictEqual(standards.length, 10, 'Must have 10 fastener standards (5 nuts, 3 washers, 1 thread, 1 torque)');

const expectedFastenerIds = [
  'gost-5915-70',
  'gost-5927-70',
  'gost-10605-94',
  'gost-9064-75',
  'gost-iso-4032-2014',
  'gost-11371-78',
  'gost-6402-70',
  'gost-9065-75',
  'gost-24705-2004',
  'universal-table-1'
];
for (const id of expectedFastenerIds) {
  assert.ok(standards.some(s => s.id === id), `Must include standard ${id}`);
}

for (const s of standards) {
  assert.ok(s.id, 'Standard must have id');
  assert.ok(s.group, 'Standard must have group');
  assert.ok(s.document, 'Standard must have document');
  assert.ok(s.title, 'Standard must have title');
  assert.ok(s.type, 'Standard must have type');
}

// 3. Standard Details
const details5915 = StandardsCatalogAdapter.getStandardDetails(db, 'gost-5915-70');
assert.strictEqual(details5915.id, 'gost-5915-70');
assert.strictEqual(details5915.document, 'ГОСТ 5915-70');
assert.strictEqual(details5915.type, 'hex_nut');
assert.strictEqual(details5915.accuracyClass, 'B');
assert.ok(Array.isArray(details5915.nonPreferredDiametersMm), 'Must have nonPreferredDiametersMm array');
assert.ok(details5915.nonPreferredDiametersMm.includes(14), 'M14 must be non-preferred in ГОСТ 5915-70');

const details11371 = StandardsCatalogAdapter.getStandardDetails(db, 'gost-11371-78');
assert.strictEqual(details11371.id, 'gost-11371-78');
assert.strictEqual(details11371.type, 'washer');
assert.deepStrictEqual(details11371.accuracyClasses, ['A', 'C']);

// 4. Table Data: ГОСТ 5915-70
const nutData = StandardsCatalogAdapter.getTableData(db, 'gost-5915-70');
assert.ok(nutData.columns.some(c => c.key === 'diameter'), 'Must have diameter column');
assert.ok(nutData.rows.length >= 20, 'Must have at least 20 diameters');
const m24 = nutData.rows.find(r => r.diameter === 24);
assert.ok(m24, 'M24 row must exist');
assert.strictEqual(m24.heightMm, 21.5, 'M24 height must be 21.5 mm');
assert.strictEqual(m24.acrossFlatsMm, 36, 'M24 S must be 36 mm');
assert.strictEqual(m24.isNonPreferred, false, 'M24 is preferred');

const m14 = nutData.rows.find(r => r.diameter === 14);
assert.ok(m14, 'M14 row must exist');
assert.strictEqual(m14.isNonPreferred, true, 'M14 must be flagged as isNonPreferred');

// 5. Table Data: ГОСТ 11371-78 washer
const washerDataA = StandardsCatalogAdapter.getTableData(db, 'gost-11371-78', { execution: '1', accuracyClass: 'A' });
assert.ok(washerDataA.rows.length >= 20, 'Washer rows must exist');
const w24A = washerDataA.rows.find(r => r.diameter === 24);
assert.ok(w24A, 'Washer M24 must exist');
assert.strictEqual(w24A.innerDiameterMm, 25, 'Washer M24 class A inner diameter must be 25');
assert.strictEqual(w24A.outerDiameterMm, 44, 'Washer M24 outer diameter must be 44');
assert.strictEqual(w24A.thicknessMm, 4, 'Washer M24 thickness must be 4');

const washerDataC = StandardsCatalogAdapter.getTableData(db, 'gost-11371-78', { execution: '1', accuracyClass: 'C' });
const w24C = washerDataC.rows.find(r => r.diameter === 24);
assert.strictEqual(w24C.innerDiameterMm, 26, 'Washer M24 class C inner diameter must be 26');

// 6. Table Data: ГОСТ 9064-75 (types A and B)
const nut9064A = StandardsCatalogAdapter.getTableData(db, 'gost-9064-75', { type: 'A' });
const n9064_m24A = nut9064A.rows.find(r => r.diameter === 24);
assert.ok(n9064_m24A, 'M24 in ГОСТ 9064-75 must exist');
assert.strictEqual(n9064_m24A.heightMm, 24, 'ГОСТ 9064-75 Type A M24 height must be 24 mm');
assert.strictEqual(n9064_m24A.acrossFlatsMm, 36, 'ГОСТ 9064-75 Type A M24 across-flats must be 36 mm');

const nut9064B = StandardsCatalogAdapter.getTableData(db, 'gost-9064-75', { type: 'B' });
const n9064_m24B = nut9064B.rows.find(r => r.diameter === 24);
assert.strictEqual(n9064_m24B.heightMm, 65, 'ГОСТ 9064-75 Type B M24 height must be 65 mm');
assert.strictEqual(n9064_m24B.acrossFlatsMm, 27, 'ГОСТ 9064-75 Type B M24 across-flats must be 27 mm');

// 7. Table Data: Spring Washer ГОСТ 6402-70
const groverData = StandardsCatalogAdapter.getTableData(db, 'gost-6402-70');
const g24 = groverData.rows.find(r => r.diameter === 24);
assert.ok(g24, 'Grover M24 must exist');
assert.strictEqual(g24.innerDiameterMm, 24.5);
assert.strictEqual(g24.outerDiameterMm, 35.5);
assert.strictEqual(g24.thicknessMm, 5.5);

// 8. Table Data: Flange Washer ГОСТ 9065-75
const flangeWasherData = StandardsCatalogAdapter.getTableData(db, 'gost-9065-75');
const fw24 = flangeWasherData.rows.find(r => r.diameter === 24);
assert.ok(fw24, 'Flange washer M24 must exist');
assert.strictEqual(fw24.innerDiameterMm, 25);
assert.strictEqual(fw24.outerDiameterMm, 44);
assert.strictEqual(fw24.thicknessMm, 4);

// 9. Table Data: Thread ГОСТ 24705-2004
const threadData = StandardsCatalogAdapter.getTableData(db, 'gost-24705-2004');
const t24 = threadData.rows.find(r => r.diameter === 24);
assert.ok(t24, 'Thread M24 must exist');
assert.strictEqual(t24.coarsePitchMm, 3);
assert.ok(t24.pitchesMm.includes(3) && t24.pitchesMm.includes(2), 'Must include coarse and fine pitches');

// 10. Table Data: Torque Table 1
const torqueData = StandardsCatalogAdapter.getTableData(db, 'universal-table-1');
const torq24 = torqueData.rows.find(r => r.diameter === 24);
assert.ok(torq24, 'Torque M24 must exist');
assert.strictEqual(torq24.minNm, 320);
assert.strictEqual(torq24.maxNm, 360);
assert.strictEqual(torq24.minKgfM, 32);
assert.strictEqual(torq24.maxKgfM, 36);

// 11. Filtering
const filtered24 = StandardsCatalogAdapter.filterRows(nutData.rows, '24');
assert.strictEqual(filtered24.length, 1, 'Search for 24 should return M24');
assert.strictEqual(filtered24[0].diameter, 24);

const filteredM24 = StandardsCatalogAdapter.filterRows(nutData.rows, 'M24');
assert.strictEqual(filteredM24.length, 1, 'Search for M24 should return M24');
assert.strictEqual(filteredM24[0].diameter, 24);

const filteredCyrM24 = StandardsCatalogAdapter.filterRows(nutData.rows, 'М24');
assert.strictEqual(filteredCyrM24.length, 1, 'Search for Cyrillic М24 should return M24');

const filteredEmpty = StandardsCatalogAdapter.filterRows(nutData.rows, '');
assert.strictEqual(filteredEmpty.length, nutData.rows.length, 'Empty search query should return all rows');

const filteredNoMatch = StandardsCatalogAdapter.filterRows(nutData.rows, '999');
assert.strictEqual(filteredNoMatch.length, 0, 'No match should return empty array');

// 12. Row Sorting
for (const std of standards) {
  const data = StandardsCatalogAdapter.getTableData(db, std.id);
  assert.ok(data.rows.length > 0, `${std.id} must have rows`);
  for (let i = 1; i < data.rows.length; i++) {
    assert.ok(data.rows[i].diameter > data.rows[i - 1].diameter,
      `${std.id} rows must be sorted by diameter in ascending order: ${data.rows[i - 1].diameter} vs ${data.rows[i].diameter}`);
  }
}

// 13. Browser compatibility via VM sandbox
const vm = require('vm');
const fs = require('fs');
const bundleCode = fs.readFileSync(path.join(__dirname, '..', 'standards.bundle.js'), 'utf8');
const adapterCode = fs.readFileSync(path.join(__dirname, '..', 'standards-base', 'src', 'catalog-adapter.js'), 'utf8');

const browserContext = {};
browserContext.window = browserContext;
browserContext.globalThis = browserContext;
browserContext.self = browserContext;
vm.createContext(browserContext);

vm.runInContext(bundleCode, browserContext);
vm.runInContext(adapterCode, browserContext);

assert.ok(browserContext.window.StandardsCatalogAdapter, 'StandardsCatalogAdapter must be attached to window in browser');
assert.ok(browserContext.globalThis.StandardsCatalogAdapter, 'StandardsCatalogAdapter must be attached to globalThis in browser');
const browserCats = browserContext.window.StandardsCatalogAdapter.getCategories();
assert.strictEqual(browserCats.length, 3, 'Browser getCategories must return 3 categories');
const browserStd = browserContext.window.StandardsCatalogAdapter.getStandards('fasteners');
assert.strictEqual(browserStd.length, 10, 'Browser getStandards must return 10 standards');

console.log('Catalog adapter tests passed');

// ==========================================
// Part 2: Drawing engine & templates tests
// ==========================================
const { StandardsDrawingEngine } = require('../standards-base/src/drawing-engine.js');
const { StandardsDrawingTemplates } = require('../standards-base/src/drawing-templates.js');

assert.ok(StandardsDrawingEngine, 'StandardsDrawingEngine must be exported');
assert.ok(StandardsDrawingTemplates, 'StandardsDrawingTemplates must be exported');

// Test Hex Nut M24 SVG
const nutSvg = StandardsDrawingEngine.render({
  standardId: 'gost-5915-70',
  type: 'hex_nut',
  row: { diameter: 24, heightMm: 21.5, acrossFlatsMm: 36 },
  theme: 'dark'
});
assert.ok(nutSvg.includes('<svg'), 'Output must be an SVG element');
assert.ok(!nutSvg.includes('NaN'), 'SVG must not contain NaN coordinates');
assert.ok(nutSvg.includes('36'), 'SVG must display across-flats dimension 36');
assert.ok(nutSvg.includes('21.5'), 'SVG must display height dimension 21.5');
assert.ok(nutSvg.includes('24'), 'SVG must display nominal diameter dimension 24');
assert.ok(!nutSvg.includes('undefined'), 'SVG must not contain undefined');
assert.ok(nutSvg.includes('viewBox='), 'SVG must have viewBox');
assert.ok(nutSvg.includes('preserveAspectRatio='), 'SVG must have preserveAspectRatio');

// Test Washer M24 SVG
const washerSvg = StandardsDrawingEngine.render({
  standardId: 'gost-11371-78',
  type: 'washer',
  row: { diameter: 24, innerDiameterMm: 25, outerDiameterMm: 44, thicknessMm: 4 },
  theme: 'light'
});
assert.ok(washerSvg.includes('<svg'), 'Washer output must be SVG');
assert.ok(!washerSvg.includes('NaN'), 'Washer SVG must not contain NaN');
assert.ok(washerSvg.includes('44'), 'Washer SVG must display outer diameter 44');
assert.ok(washerSvg.includes('25'), 'Washer SVG must display inner diameter 25');
assert.ok(washerSvg.includes('4'), 'Washer SVG must display thickness 4');
assert.ok(!washerSvg.includes('undefined'), 'Washer SVG must not contain undefined');

// Test Spring Washer (Grover)
const groverSvg = StandardsDrawingEngine.render({
  standardId: 'gost-6402-70',
  type: 'spring_washer',
  row: { diameter: 24, innerDiameterMm: 24.5, outerDiameterMm: 40, thicknessMm: 5 },
  theme: 'dark'
});
assert.ok(groverSvg.includes('<svg'), 'Grover output must be SVG');
assert.ok(!groverSvg.includes('NaN'), 'Grover SVG must not contain NaN');
assert.ok(!groverSvg.includes('undefined'), 'Grover SVG must not contain undefined');

// Test Thread Profile
const threadSvg = StandardsDrawingEngine.render({
  standardId: 'gost-24705-2004',
  type: 'thread',
  row: { diameter: 24, coarsePitchMm: 3, pitchesMm: [3, 2, 1.5, 1] },
  theme: 'light'
});
assert.ok(threadSvg.includes('<svg'), 'Thread output must be SVG');
assert.ok(!threadSvg.includes('NaN'), 'Thread SVG must not contain NaN');
assert.ok(!threadSvg.includes('undefined'), 'Thread SVG must not contain undefined');

// Test Torque infographic
const torqueSvg = StandardsDrawingEngine.render({
  standardId: 'universal-table-1',
  type: 'torque',
  row: { diameter: 24, minNm: 320, maxNm: 360, minKgfM: 32, maxKgfM: 36 },
  theme: 'dark'
});
assert.ok(torqueSvg.includes('<svg'), 'Torque output must be SVG');
assert.ok(!torqueSvg.includes('NaN'), 'Torque SVG must not contain NaN');
assert.ok(torqueSvg.includes('320'), 'Torque SVG must contain minNm');
assert.ok(!torqueSvg.includes('undefined'), 'Torque SVG must not contain undefined');

// Test callouts
const nutCallout = StandardsDrawingEngine.getStandardCallout('gost-5915-70', { diameter: 24 });
assert.strictEqual(nutCallout, 'Гайка М24 ГОСТ 5915-70');

const washerCallout = StandardsDrawingEngine.getStandardCallout('gost-11371-78', { diameter: 24 });
assert.strictEqual(washerCallout, 'Шайба 24 ГОСТ 11371-78');

const groverCallout = StandardsDrawingEngine.getStandardCallout('gost-6402-70', { diameter: 24 });
assert.strictEqual(groverCallout, 'Шайба 24 ГОСТ 6402-70');

const washerCalloutExec2 = StandardsDrawingEngine.getStandardCallout('gost-11371-78', { diameter: 24 }, '2');
assert.strictEqual(washerCalloutExec2, 'Шайба 2.24 ГОСТ 11371-78');

const nut9064Callout = StandardsDrawingEngine.getStandardCallout('gost-9064-75', { diameter: 24, type: 'B' });
assert.strictEqual(nut9064Callout, 'Гайка М24.Б ГОСТ 9064-75');

const threadCallout = StandardsDrawingEngine.getStandardCallout('gost-24705-2004', { diameter: 24, pitch: 3 });
assert.strictEqual(threadCallout, 'Різьба М24×3 ГОСТ 24705-2004');

const torqueCallout = StandardsDrawingEngine.getStandardCallout('universal-table-1', { diameter: 24 });
assert.strictEqual(torqueCallout, 'Моменти затягування М24');

// Type auto-inference (omitting type parameter)
const inferredSvg = StandardsDrawingEngine.render({
  standardId: 'gost-5915-70',
  row: { diameter: 24, heightMm: 21.5, acrossFlatsMm: 36 },
  theme: 'dark'
});
assert.ok(inferredSvg.includes('S = 36'), 'Inferred hex_nut must render across-flats S=36');

// Empty row safety check
const emptyRowSvg = StandardsDrawingEngine.render({ standardId: 'gost-5915-70' });
assert.ok(emptyRowSvg.includes('<svg'), 'Empty row must still render SVG');
assert.ok(!emptyRowSvg.includes('NaN'), 'Empty row must not contain NaN');
assert.ok(!emptyRowSvg.includes('undefined'), 'Empty row must not contain undefined');

// No negative radii checks
assert.ok(!nutSvg.match(/r="-[\d.]+"/), 'No negative radii in nut SVG');
assert.ok(!washerSvg.match(/r="-[\d.]+"/), 'No negative radii in washer SVG');
assert.ok(!groverSvg.match(/r="-[\d.]+"/), 'No negative radii in grover SVG');
assert.ok(!threadSvg.match(/r="-[\d.]+"/), 'No negative radii in thread SVG');
assert.ok(!torqueSvg.match(/r="-[\d.]+"/), 'No negative radii in torque SVG');

// Test rendering for all 10 standards from catalog
for (const std of standards) {
  const tableData = StandardsCatalogAdapter.getTableData(db, std.id);
  const firstRow = tableData.rows[0];
  const renderedSvg = StandardsDrawingEngine.render({
    standardId: std.id,
    type: std.type,
    row: firstRow,
    theme: 'light'
  });
  assert.ok(renderedSvg.includes('<svg'), `${std.id} must render SVG`);
  assert.ok(!renderedSvg.includes('NaN'), `${std.id} SVG must not contain NaN`);
  assert.ok(!renderedSvg.includes('undefined'), `${std.id} SVG must not contain undefined`);
}

// Test browser context in VM sandbox
const templatesCode = fs.readFileSync(path.join(__dirname, '..', 'standards-base', 'src', 'drawing-templates.js'), 'utf8');
const engineCode = fs.readFileSync(path.join(__dirname, '..', 'standards-base', 'src', 'drawing-engine.js'), 'utf8');

vm.runInContext(templatesCode, browserContext);
vm.runInContext(engineCode, browserContext);

assert.ok(browserContext.window.StandardsDrawingTemplates, 'StandardsDrawingTemplates must be attached to window in browser');
assert.ok(browserContext.window.StandardsDrawingEngine, 'StandardsDrawingEngine must be attached to window in browser');

const browserRender = browserContext.window.StandardsDrawingEngine.render({
  standardId: 'gost-5915-70',
  type: 'hex_nut',
  row: { diameter: 24, heightMm: 21.5, acrossFlatsMm: 36 },
  theme: 'dark'
});
assert.ok(browserRender.includes('<svg'), 'Browser render must return SVG');
assert.ok(!browserRender.includes('NaN'), 'Browser render must not contain NaN');

console.log('Drawing engine tests passed');

// ==========================================
// Part 3: UI HTML validation
// ==========================================
const html = fs.readFileSync(path.join(__dirname, '..', 'standards-base', 'index.html'), 'utf8');

assert.ok(html.includes('id="searchInput"'), 'Must have search input');
assert.ok(html.includes('id="standardsList"'), 'Must have standards list container');
assert.ok(html.includes('id="passportCard"'), 'Must have passport card container');
assert.ok(html.includes('id="dimensionsTable"'), 'Must have dimensions table container');
assert.ok(html.includes('id="drawingContainer"'), 'Must have drawing container');
assert.ok(html.includes('id="btnCopyCallout"'), 'Must have copy callout button');
assert.ok(html.includes('id="btnExportSvg"'), 'Must have export SVG button');
assert.ok(html.includes('id="themeToggle"'), 'Must have theme toggle');
assert.ok(html.includes('id="btnToggleSidebar"'), 'Must have sidebar toggle button');
assert.ok(html.includes('id="toastContainer"'), 'Must have toast container');
assert.ok(html.includes('tailwind-local.css'), 'Must link tailwind-local.css');
assert.ok(html.includes('styles.css'), 'Must link styles.css');
assert.ok(html.includes('../standards.bundle.js'), 'Must link shared standards.bundle.js');
assert.ok(html.includes('src/catalog-adapter.js'), 'Must link catalog-adapter.js');
assert.ok(html.includes('src/drawing-templates.js'), 'Must link drawing-templates.js');
assert.ok(html.includes('src/drawing-engine.js'), 'Must link drawing-engine.js');
assert.ok(html.includes('src/app.js'), 'Must link app.js');

const appJsPath = path.join(__dirname, '..', 'standards-base', 'src', 'app.js');
const appCode = fs.readFileSync(appJsPath, 'utf8');
assert.ok(appCode.length > 0, 'app.js must not be empty');

const app = require('../standards-base/src/app.js');
assert.ok(app.state, 'app must export state');
assert.strictEqual(typeof app.init, 'function', 'app must export init');
assert.strictEqual(typeof app.selectStandard, 'function', 'app must export selectStandard');
assert.strictEqual(typeof app.loadTableData, 'function', 'app must export loadTableData');
assert.strictEqual(typeof app.renderDrawing, 'function', 'app must export renderDrawing');
assert.strictEqual(typeof app.showToast, 'function', 'app must export showToast');

// Test browser context in VM sandbox
vm.runInContext(appCode, browserContext);
assert.ok(browserContext.window.StandardsApp, 'StandardsApp must be attached to window in browser');
assert.strictEqual(typeof browserContext.window.StandardsApp.selectStandard, 'function', 'browser StandardsApp has selectStandard');

console.log('HTML and UI structure tests passed');


