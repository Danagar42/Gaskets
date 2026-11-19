'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {StandardsCatalogAdapter: adapter} = require('../standards-base/src/catalog-adapter.js');
require('../standards.bundle.js');
const db = globalThis.FlangeStandardsDB;

const card = (id, filters) => adapter.getReferenceCard(db, id, filters);
const size = (id, diameter, filters) => card(id, filters).tables[0].rows.find(row => row.diameter === diameter);

test('six reference categories include five nut standards and searchable document names', () => {
  assert.equal(typeof adapter.listReferenceCategories, 'function');
  assert.deepEqual(adapter.listReferenceCategories().map(category => category.id),
    ['nuts', 'washers', 'threads', 'flanges', 'gaskets', 'torques']);
  const entries = adapter.listReferenceEntries(db);
  assert.equal(entries.filter(entry => entry.categoryId === 'nuts').length, 5);
  for (const query of ['9064–75', '  ГОСТ 9064-75  ']) {
    assert.equal(adapter.searchReferenceEntries(entries, query)[0].id, 'gost-9064-75');
  }
  assert.equal(adapter.searchReferenceEntries(entries, 'графітові')[0].id, 'graphite-annex-b1-b2-unidentified');
  assert.equal(card('unknown'), null);
});

test('nut, washer and pitch options preserve available and missing catalog data', () => {
  assert.equal(typeof adapter.getReferenceCard, 'function');
  const nut = size('gost-9064-75', 24, {type:'B', diameter:'М24'});
  assert.deepEqual([nut.bodyDiameterMm, nut.headHeightMm, nut.boreDepthMm], [40, 16, 40]);
  const washer = 'gost-11371-78';
  assert.equal(size(washer, 24, {accuracyClass:'A'}).innerDiameterMm, 25);
  assert.equal(size(washer, 24, {accuracyClass:'C'}).innerDiameterMm, 26);
  assert.equal(size(washer, 33, {accuracyClass:'C'}).innerDiameterMm, null);
  const execution = card(washer, {execution:'2', accuracyClass:'C'}).filters.find(filter => filter.key === 'accuracyClass');
  assert.deepEqual(execution.options.map(option => option.value), ['A']);
  assert.equal(execution.value, 'A');
  assert.deepEqual(size('gost-24705-2004', 24).pitchesMm, [3, 2, 1.5, 1, 0.75]);
});

test('gasket and torque tables show numeric values and recorded source status', () => {
  assert.equal(typeof adapter.getReferenceCard, 'function');
  const torque = card('universal-table-1');
  const torque24 = torque.tables[0].rows.find(row => row.diameter === 24);
  assert.deepEqual([torque24.minNm, torque24.maxNm, torque24.minKgfM, torque24.maxKgfM], [320, 360, 32, 36]);
  assert.ok(torque.sources.some(source => source.kind === 'user_supplied_table'));
  assert.equal(torque.drawingKind, null);
  const gasket = card('graphite-annex-b1-b2-unidentified');
  assert.ok(gasket.sources.some(source => source.documentId === null));
  assert.equal(gasket.tables.find(table => table.id === 'expansion').rows.find(row => row.temperature === 400).value, 1.61);
  assert.equal(gasket.drawingKind, null);
});

test('flange cards expose the original 925 rows and both supporting documents', () => {
  require('../flange-catalog.bundle.js');
  const catalog = globalThis.GostFlangeCatalog;
  const flange = require('../standards-base/src/flange-reference.js');
  const entries = adapter.listReferenceEntries(db, flange.listEntries(catalog));
  const ids = ['12820', '12821'].flatMap(standard =>
    flange.getCard(catalog, `gost-${standard}-80`).tables[0].rows.map(row => row.id));
  assert.equal(ids.length, 925);
  assert.equal(new Set(ids).size, 925);
  assert.deepEqual(new Set(ids), new Set(catalog.rows.map(row => row.id)));
  for (const standard of ['12815', '12816']) {
    const entry = adapter.searchReferenceEntries(entries, `${standard}-80`)[0];
    assert.equal(entry.id, `gost-${standard}-80`);
    assert.ok(flange.getCard(catalog, entry.id).sources[0].edition.includes('2003'));
  }
  assert.ok(flange.getCard(catalog, 'gost-12816-80').notes.some(note => note.includes('1.9')));
});

test('flange surface values, conflicting sources and incompatible filters follow the selected row', () => {
  require('../flange-catalog.bundle.js');
  const catalog = globalThis.GostFlangeCatalog;
  const flange = require('../standards-base/src/flange-reference.js');
  const id = '12820:0.1:600:-:1';
  const flat = flange.getCard(catalog, 'gost-12820-80', {dn:600, pressure:0.1, face:'4'}, id);
  assert.equal(flat.selectedRow, catalog.rows.find(row => row.id === id));
  assert.equal(flat.face, '4');
  const d3 = flat.tables[1].rows.find(row => row.id === 'D3');
  assert.equal(d3.value, 631);
  assert.match(d3.origin, /ГОСТ 12815-80/);
  assert.ok(flat.notes.some(note => /КОМПАС 531.*ГОСТ 631/.test(note)));
  assert.ok(flat.sources.some(source => source.label.includes('12816-80')));

  const neck = flange.getCard(catalog, 'gost-12821-80', {dn:50, pressure:0.1, face:'999'}, id);
  assert.equal(neck.selectedRow.dn, 50);
  assert.equal(neck.selectedRow.pressure, 0.1);
  assert.ok(Object.hasOwn(neck.selectedRow.faces, neck.face));
  assert.notEqual(neck.face, '999');
});

test('the drawing uses the three selected type Б cap dimensions and a blind bore', () => {
  require('../component-imported-styles.js');
  const {StandardsDrawingEngine: engine} = require('../standards-base/src/drawing-engine.js');
  assert.equal(typeof engine.renderReference, 'function');
  const standardId = 'gost-9064-75';
  const row = size(standardId, 24, {type:'B'});
  const drawing = engine.renderReference({standardId,type:'capped_nut',row});
  assert.match(drawing.svg, /D₁.*40\s*мм/);
  assert.match(drawing.svg, /l₀.*16\s*мм/);
  assert.match(drawing.svg, /Глибина глухого отвору/);
  assert.match(drawing.svg, /l\s*=\s*40\s*мм/);
  assert.doesNotMatch(drawing.svg, /NaN|undefined/);
  assert.match(drawing.svg, /V\s+\d+(?:\.\d+)?\s+H\s+\d+" fill="url\(#hatch_/);
  const typeA = engine.renderReference({standardId,type:'hex_nut',row:size(standardId,24,{type:'A'})});
  assert.match(typeA.svg, />24\s*мм<\/text>/);
  assert.doesNotMatch(typeA.svg, /Глибина глухого отвору/);
  assert.equal(engine.renderReference({standardId,type:'capped_nut',row:{...row,capProfile:null}}),null);
});

test('missing geometry is suppressed and the chosen pitch drives the thread profile', () => {
  const {StandardsDrawingEngine: engine} = require('../standards-base/src/drawing-engine.js');
  assert.equal(typeof engine.renderReference, 'function');
  const washer = 'gost-11371-78';
  assert.equal(engine.renderReference({standardId:washer,type:'washer',row:size(washer,33,{accuracyClass:'C'})}),null);
  const standardId = 'gost-24705-2004';
  const row = size(standardId,24);
  const fine = engine.renderReference({standardId,type:'thread',row,pitchMm:1.5});
  const coarse = engine.renderReference({standardId,type:'thread',row,pitchMm:3});
  const path = value => value.svg.match(/<path d="([^"]+)" fill="url\(#hatch_/)[1];
  assert.notEqual(path(fine),path(coarse));
  assert.match(fine.callout,/М24×1,5/);
  assert.match(fine.svg,/P = 1,5 мм/);
  assert.match(fine.svg,/Розраховано/);
  assert.equal(fine.calculated.value, 1.299038105676658);
});

test('flange drawing flags only dimensions with recorded calculated provenance', () => {
  const {drawCandidate} = require('../flange-picker-drawing.js');
  require('../flange-catalog.bundle.js');
  const row = globalThis.GostFlangeCatalog.rows[0];
  const flagged = drawCandidate(row,'1',null,{b:{calculated:true}});
  assert.match(flagged, /b 8 мм · Розраховано/);
  assert.equal((flagged.match(/Розраховано/g) || []).length,1);
  assert.doesNotMatch(drawCandidate(row,'1'), /Розраховано/);
});

function browserReference() {
  const context = vm.createContext({});
  for (const file of ['standards.bundle.js','flange-catalog.bundle.js','core.js','component-imported-styles.js',
    'flange-picker-drawing.js','standards-base/src/catalog-adapter.js','standards-base/src/flange-reference.js',
    'standards-base/src/drawing-templates.js','standards-base/src/drawing-engine.js','standards-base/src/app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  }
  return context;
}

test('unknown, category and card routes resolve without looking up unrelated workspace records', () => {
  const browser = browserReference();
  assert.equal(typeof browser.StandardsReference?.resolveRoute,'function');
  const entries = adapter.listReferenceEntries(db);
  const route = parts => JSON.parse(JSON.stringify(browser.StandardsReference.resolveRoute(parts,entries)));
  assert.deepEqual(route(['unknown']),{categoryId:null,entryId:null});
  assert.deepEqual(route(['nuts','gost-9064-75']),{categoryId:'nuts',entryId:'gost-9064-75'});
  assert.deepEqual(route(['washers','gost-9064-75']),{categoryId:null,entryId:null});
});

test('filter and row selection render the corresponding dimensions and drawing together', () => {
  const browser = browserReference();
  assert.equal(typeof browser.StandardsReference?.render,'function');
  const events = {};
  const panel = {innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
  const root = {querySelector:()=>panel,addEventListener(type,handler){events[type]=handler;}};
  const main = {firstElementChild:root,innerHTML:''};
  const filter = (key,value) => events.change({target:{dataset:{referenceFilter:key},value,tagName:'SELECT'}});
  const diameter = value => events.input({target:{dataset:{referenceFilter:'diameter'},value,tagName:'INPUT'}});
  const action = dataset => events.click({target:{closest:()=>({dataset})},preventDefault(){}});
  browser.StandardsReference.render(main,['nuts','gost-9064-75'],{navigate(){},toast(){}});
  filter('type','B');
  diameter('М24');
  assert.match(panel.innerHTML,/М24\.Б ГОСТ 9064-75/);
  assert.match(panel.innerHTML,/D₁.*40\s*мм/);
  assert.match(panel.innerHTML,/l₀.*16\s*мм/);
  assert.match(panel.innerHTML,/<td[^>]*>40<\/td><td[^>]*>16<\/td><td[^>]*>40<\/td>/);
  diameter('999');
  assert.match(panel.innerHTML,/Типорозмірів не знайдено/);
  action({referenceReset:''});
  assert.doesNotMatch(panel.innerHTML,/Типорозмірів не знайдено/);
  browser.StandardsReference.render(main,['washers','gost-11371-78'],{navigate(){},toast(){}});
  filter('accuracyClass','C');
  diameter('М33');
  assert.match(panel.innerHTML,/<td[^>]*>—<\/td>/);
  assert.match(panel.innerHTML,/Недостатньо розмірів для ескізу/);
  browser.StandardsReference.render(main,['flanges','gost-12820-80'],{navigate(){},toast(){}});
  filter('dn','600');
  filter('pressure','0.1');
  filter('series','1');
  filter('face','4');
  assert.match(panel.innerHTML,/КОМПАС 531, ГОСТ 631/);
  assert.match(panel.innerHTML,/D₃ 631 мм/);
  filter('dn','10');
  assert.doesNotMatch(panel.innerHTML,/D₃ 631 мм/);
});
