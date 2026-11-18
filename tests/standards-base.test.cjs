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
