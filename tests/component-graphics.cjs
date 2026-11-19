'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
require('../standards.bundle.js');
require('../component-imported-styles.js');
require('../component-visuals.js');
const graphics = globalThis.FlangeComponentVisuals;
globalThis.document = {createElementNS: () => ({
  setAttribute(key,value) { this[key] = value; }, querySelectorAll: () => []
})};

test('spring washer has a distinct outline at identical diameters and thickness', () => {
  const part = {diameter:24,inner:24.5,outer:35.5,h:5.5,execution:'1'};
  const draw = spring => graphics.create('passport','washer',{...part,spring},3).innerHTML.match(/<path d="[^"]+"/g);
  assert.ok(JSON.stringify(draw(true)) !== JSON.stringify(draw(false)));
});

test('radial section places thickness arrows inside when they fit', () => {
  const thicknessArrows = h => {
    const svg = graphics.create('passport','washer',{diameter:24,outer:44,inner:25,h},3);
    return svg.innerHTML.match(/<path d="M 90 -?[\d.]+ V -?[\d.]+"[^>]+marker-end="url\(#v5-arr\)"\/>/g) || [];
  };
  const inside = thicknessArrows(4);
  assert.equal(inside.length,1);
  assert.match(inside[0],/marker-start="url\(#v5-arr\)"/);
  assert.equal(thicknessArrows(1).length,2);
});

test('catalog wrench labels fit inside the nut drawing', () => {
  const catalog = require('../standards/nuts/gost-10605-94.json');
  for (const [d,size] of Object.entries(catalog.sizes)) {
    const svg = graphics.create('passport','nut',{diameter:+d,h:size.heightMm,acrossFlats:size.acrossFlatsMm},1);
    const [,y,,height] = svg.viewBox.split(' ').map(Number);
    const label = svg.innerHTML.match(/<text[^>]+ y="([\d.]+)"[^>]*>S = /);
    assert.ok(label && +label[1]+4 < y+height,'M'+d);
  }
});

test('M24 capped nut has the same Ø40 body around the head and the blind bore', () => {
  const part = {diameter:24,capped:true,acrossFlats:27,h:65};
  const svg = graphics.create('passport','nut',part,3).innerHTML;
  const scale = 202 / 65;
  const endBody = svg.match(/<circle cx="468" cy="170" r="([\d.]+)"/);
  assert.ok(endBody && Math.abs(2 * endBody[1] / scale - 40) < .05, 'end view must show the Ø40 body');
  const shoulderY = 69 + 16 * scale;
  const boreEndY = 271 - 40 * scale;
  const bodyX = 215 + 20 * scale;
  assert.ok(svg.includes('H ' + bodyX), 'right-hand section must reach the outside diameter');
  assert.ok(svg.includes('V ' + shoulderY), 'head must end at the shoulder');
  assert.ok(svg.includes('V ' + boreEndY), 'blind bore must end inside the cylindrical body');
  const section = svg.match(/<path d="([^"]+)" fill="url\(#v5-hatch\)"\/?>/)[1];
  const bore = section.match(/H ([\d.]+) L ([\d.]+) [\d.]+ V ([\d.]+) H 215$/);
  assert.ok(bore && +bore[1] < bodyX && +bore[2] < +bore[1] && +bore[3] > shoulderY,
    'the mouth and the blind end must leave a positive wall inside the body');
  assert.match(svg,/S = 27</);
  assert.match(svg,/l₁ = 65</);
});

test('assembly washer section follows the selected dimensions', () => {
  const assembly = (outer,inner,h) => graphics.assembly([
    {kind:'head',upper:true}, {kind:'washer',outer,inner,h},
    {kind:'side',upper:true},{kind:'gasket'},{kind:'side'},
    {kind:'nut',height:21.5}
  ],{diameter:24,pitch:3,bolt:true},'preview');
  const reference = assembly(44,25,4);
  for (const dims of [[46,25,4],[44,26,4],[44,25,5]]) {
    assert.ok(reference !== assembly(...dims),'washer '+dims.join(' × '));
  }
});
