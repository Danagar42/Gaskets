'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
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
