'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const picker = require('../flange-picker.js');
const { drawCandidate } = require('../flange-picker-drawing.js');
const source = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../flange-catalog.bundle.js'), 'utf8'), source);
const rows = source.GostFlangeCatalog.rows;
const flat = rows.find(row => row.id === '12820:1.6:100:А:2');
const neck = rows.find(row => row.id === '12821:1.6:100:-:2');
const part = () => ({ mode: 'pending', outerDiameter: '', innerDiameter: '', boltCircle: '', holeDiameter: '', height: '18', wallCylinder: '', wallCone: '' });
const node = () => ({
  connection: { kind: 'flange-flange', sideA: { material: 'A' }, sideB: { material: 'B' } },
  fastener: { nominalDiameter: '16', count: '8' },
  gasket: { mode: 'ring', innerDiameter: '112', outerDiameter: '158', hasHoles: false },
  flanges: { sideA: part(), sideB: part() },
});

assert.equal(picker.gasketFit(node(), flat).status, 'clear');
const overlap = node();
overlap.gasket.outerDiameter = '167';
assert.equal(picker.gasketFit(overlap, flat).status, 'conflict');
overlap.gasket.hasHoles = true;
overlap.gasket.holeDiameter = '18';
assert.equal(picker.gasketFit(overlap, flat).status, 'unknown');
overlap.gasket.holeDiameter = '15';
assert.equal(picker.gasketFit(overlap, flat).status, 'conflict');

const input = node();
input.flanges.sideB.boltCircle = '180';
input.flanges.sideB.outerDiameter = '216';
const before = structuredClone(input);
const preview = picker.previewApplication(input, flat, 'both');
assert.deepEqual(input, before);
assert.equal(preview.sides.sideB.fields.outerDiameter.status, 'preserve');
assert.equal(preview.sides.sideB.fields.boltCircle.status, 'same');
assert.equal(preview.sides.sideA.fields.boltCircle.status, 'fill');
assert.ok(picker.applyCandidate(input, flat, 'both').applied);
assert.deepEqual([input.flanges.sideA.outerDiameter, input.flanges.sideB.outerDiameter], ['215', '216']);
assert.deepEqual([input.flanges.sideA.holeDiameter, input.flanges.sideB.holeDiameter], ['18', '18']);
assert.equal(input.flanges.sideA.mode, 'flange');
assert.equal(input.flanges.sideB.height, '18');
assert.deepEqual(input.connection, before.connection);
assert.deepEqual(input.fastener, before.fastener);
assert.deepEqual(input.gasket, before.gasket);

for (const side of ['sideA', 'sideB']) {
  const item = node();
  const other = side === 'sideA' ? 'sideB' : 'sideA';
  const untouched = structuredClone(item.flanges[other]);
  assert.ok(picker.applyCandidate(item, flat, side).applied);
  assert.equal(item.flanges[side].boltCircle, '180');
  assert.deepEqual(item.flanges[other], untouched);
}
const blocked = node();
blocked.flanges.sideB.boltCircle = '190';
const blockedBefore = structuredClone(blocked);
assert.ok(!picker.applyCandidate(blocked, flat, 'both').applied);
assert.ok(!picker.applyCandidate(blocked, flat, 'sideA').applied);
assert.deepEqual(blocked, blockedBefore);
blocked.flanges.sideB.boltCircle = '+190';
assert.ok(!picker.applyCandidate(blocked, flat, 'sideA').applied);
blocked.flanges.sideB.boltCircle = '180,';
assert.ok(picker.applyCandidate(blocked, flat, 'sideA').applied);
const disabled = node();
disabled.flanges.sideB.mode = 'none';
assert.ok(!picker.applyCandidate(disabled, flat, 'both').applied);
assert.equal(disabled.flanges.sideA.mode, 'pending');
const outOfRim = node();
outOfRim.flanges.sideA.outerDiameter = '190';
assert.ok(picker.previewApplication(outOfRim, flat, 'sideA').errors.some(error => /краю фланця/.test(error)));
const tooSmallGasket = node();
Object.assign(tooSmallGasket.gasket, {innerDiameter:'72', outerDiameter:'142'});
assert.equal(picker.gasketFit(tooSmallGasket, flat).status, 'clear');
assert.ok(!picker.applyCandidate(tooSmallGasket, flat, 'both').applied);

const matches = picker.findCandidates(rows, node(), { D: 215, b: 18 },
  { standard: '12820', dn: 100, pressure: 1.6 }, 'sideA');
assert.ok(matches.length && matches.every(match => match.row.dimensions.bolt === 16 && match.row.dimensions.n === 8));
assert.equal(matches[0].comparisons.b.delta, 5);
const secondSide = node();
secondSide.flanges.sideA.boltCircle = '+180';
secondSide.fastener.count = '8,';
const otherMatches = picker.findCandidates(rows, secondSide, {}, {}, 'sideB');
assert.ok(otherMatches.length && otherMatches.every(match => match.row.dimensions.D1 === 180 && match.row.dimensions.n === 8));
secondSide.flanges.sideA.holeDiameter = '14';
assert.ok(picker.previewApplication(secondSide, flat, 'sideB').errors.some(error => /іншій стороні/.test(error)));
secondSide.flanges.sideB.boltCircle = '190';
assert.equal(picker.findCandidates(rows, secondSide, {}, {}).length, 0);

const m12 = node();
m12.fastener.nominalDiameter = '12';
assert.equal(picker.findCandidates(rows, m12, {}, {}).length, 0);
assert.match(picker.attachmentMismatch(rows, m12), /М12.*\(8\).*— 4\./s);
m12.fastener.count = '';
assert.equal(picker.attachmentMismatch(rows, m12), '');
const m12Matches = picker.findCandidates(rows, m12, {}, {});
assert.ok(m12Matches.length && m12Matches.every(match => match.row.dimensions.n === 4));
assert.equal(picker.attachmentMismatch(rows, node()), '');

assert.match(picker.pressureHint({
  normal:{pressure:'0,6', temperature:'45'}, hydro:{pressure:'0,85', temperature:'20'},
}), /0,6 МПа при 45 °C.*0,85 МПа при 20 °C/s);
const partialPressureHint = picker.pressureHint({normal:{pressure:'0', temperature:'-10'}, hydro:{pressure:''}});
assert.match(partialPressureHint, /0 МПа при -10 °C/);
assert.doesNotMatch(partialPressureHint, /Гідровипробування/);

const flatSvg = drawCandidate(flat, 1, 'b');
assert.match(flatSvg, /data-flange-view="axial"/);
assert.match(flatSvg, /data-flange-view="front"/);
assert.match(flatSvg, /b 23 мм/);
const preciseFlat = {...flat, dimensions:{...flat.dimensions, b:23.4567}};
assert.match(drawCandidate(preciseFlat, 1), /b 23,46 мм/);
assert.equal(preciseFlat.dimensions.b,23.4567);
assert.match(flatSvg, /D₁ 180 мм/);
assert.match(flatSvg, /n 8 × ⌀18/);
assert.match(flatSvg, /dₙ труби ⌀108 мм/);
assert.match(flatSvg, /dв ⌀110 мм/);
assert.match(flatSvg, /data-size="b" class="fp-active"/);
assert.doesNotMatch(flatSvg, /h₄/);
assert.match(drawCandidate(neck, 1), /h₄ 50 мм/);
const tongue = drawCandidate(flat, 4, 'D3');
assert.match(tongue, /data-flange-view="seal"/);
assert.match(tongue, /data-size="D3" class="fp-active"/);
assert.match(tongue, /D₃ 129 мм/);
assert.notEqual(tongue, drawCandidate(flat, 5, 'D5'));
assert.notEqual(tongue, drawCandidate(flat, 4, 'D4'));
const coverNode = node();
coverNode.connection.kind = 'flange-cover';
coverNode.connection.sideA.name = 'Фланець';
coverNode.connection.sideB.name = 'Кришка';
coverNode.flanges.sideB.mode = 'none';
const coverPreview = picker.previewApplication(coverNode, flat, 'sideA');
assert.equal(coverPreview.errors.length, 0);
assert.equal(coverPreview.sides.sideA.fields.boltCircle.status, 'fill');
const coverPreviewB = picker.previewApplication(coverNode, flat, 'sideB');
assert.ok(coverPreviewB.errors.length > 0);
const coverPreviewBoth = picker.previewApplication(coverNode, flat, 'both');
assert.ok(coverPreviewBoth.errors.length > 0);
assert.ok(picker.applyCandidate(coverNode, flat, 'sideA').applied);
assert.equal(coverNode.flanges.sideA.boltCircle, '180');
assert.equal(coverNode.flanges.sideA.mode, 'flange');
assert.equal(coverNode.flanges.sideB.mode, 'none');

console.log('Flange picker: shortlist, clearance, confirmation, untouched inputs and drawing labels verified.');
