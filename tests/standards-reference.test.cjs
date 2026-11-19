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
