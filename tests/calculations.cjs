const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');
const G = require('../calculations.js');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/control-node-1.json'),'utf8'));
const cell = address => fixture.cells[address].value;
const close = (actual,expected) => assert.ok(actual !== null && Math.abs(actual - expected) <= Math.max(1e-9,Math.abs(expected) * 1e-11), `${actual} != ${expected}`);
const gasket = {mode:'ring',outerDiameter:String(cell('F20')),innerDiameter:String(cell('F21')),thickness:String(cell('C15')),hasHoles:true,holeDiameter:String(cell('F23'))};
const ring = G.gasketGeometry(gasket,cell('C40'));
assert.deepEqual(ring.issues,[]);
for (const [key,address] of Object.entries({width:'C16',holeWidth:'C17',effectiveWidth:'C18',effectiveHoleWidth:'C19',meanDiameter:'F22',effectiveArea:'C22',pressureArea:'C23'})) close(ring.values[key],cell(address));
const thread = G.threadGeometry(cell('C34'),cell('C37'),cell('C36'));
assert.deepEqual(thread.issues,[]);
for (const [key,address] of Object.entries({rootDiameter:'C33',meanDiameter:'C35',smoothArea:'C47',threadArea:'C48'})) close(thread.values[key],cell(address));
close(G.gasketGeometry({...gasket,outerDiameter:'100',innerDiameter:'70',hasHoles:false},'').values.effectiveWidth,15);
assert.ok(G.gasketGeometry({...gasket,outerDiameter:'100.000002',innerDiameter:'70',hasHoles:false},'').values.effectiveWidth < 15);
close(G.gasketGeometry({...gasket,outerDiameter:'100',innerDiameter:'60',holeDiameter:'6'},'4').values.effectiveHoleWidth,3.8*Math.sqrt(14));
assert.equal(G.gasketGeometry({...gasket,innerDiameter:'1400'},32).values.effectiveArea,null);
assert.equal(G.gasketGeometry({...gasket,holeDiameter:'76'},32).values.effectiveArea,null);
assert.equal(G.gasketGeometry(gasket,'2.5').values.effectiveArea,null);
assert.equal(G.gasketGeometry(gasket,100000).values.effectiveArea,null);
close(G.gasketGeometry({mode:'area',effectiveArea:'1000,5',pressureArea:'5000'},32).values.effectiveArea,1000.5);
assert.equal(G.threadGeometry(24,3,24).values.threadArea,null);
assert.equal(G.threadGeometry('',3,0).values.rootDiameter,null);
assert.equal(G.packageLengths([{name:'Невідома висота',height:'',threaded:true}]).values.threadedLength,null);

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../standards.bundle.js'),'utf8'),context);
const catalog = context.FlangeStandardsDB;
const node = C.createNode('Контрольний вузол');
node.gasket = {...node.gasket,...gasket};
node.fastener.nominalDiameter = '24'; node.fastener.count = '32';
node.connection.sideA.height = String(cell('C87'));
node.connection.sideB.height = String(cell('C99'));
node.washers.placement = 'a';
const result = G.nodeGeometry(node,catalog);
close(result.lengths.values.smoothLength,cell('C38'));
close(result.lengths.values.threadedLength,cell('C39'));
close(result.lengths.values.totalLength,118.5);
node.washers.placement = 'both';
node.extras.push({name:'Проставка',thickness:'5'});
close(G.nodeGeometry(node,catalog).lengths.values.smoothLength,70);
close(G.nodeGeometry(node,catalog).lengths.values.threadedLength,57.5);
node.fastener.type = 'bolt';
close(G.nodeGeometry(node,catalog).lengths.values.smoothLength,106);
close(G.nodeGeometry(node,catalog).lengths.values.threadedLength,21.5);
node.nut.standardId = 'gost-9064-75'; node.nut.typeId = 'B';
assert.equal(G.nodeGeometry(node,catalog).lengths.values.threadedLength,null,'Do not use total cap-nut height as threaded height');
node.nut.threadedHeight = '20';
close(G.nodeGeometry(node,catalog).lengths.values.threadedLength,20);
node.nut.threadedHeight = '999';
assert.equal(G.nodeGeometry(node,catalog).lengths.values.threadedLength,null);
node.connection.sideA.height = '';
assert.equal(G.nodeGeometry(node,catalog).lengths.values.smoothLength,null,'Missing height must not disappear as zero');
console.log('OK: 13 геометричних величин Excel, межа 15 мм, отвори, ручні площі, довжини шпильки/болта, шайби й проставки.');
// Finite inputs can overflow intermediate geometry. Never present Infinity
// as a calculated area or a valid package length.
for (const result of [
  G.gasketGeometry({mode:'ring',outerDiameter:'1'+'0'.repeat(200),innerDiameter:'100',hasHoles:false},'4'),
  G.gasketGeometry({mode:'ring',outerDiameter:1.7e308,innerDiameter:1.6e308,hasHoles:false},'4'),
  G.gasketGeometry({mode:'ring',outerDiameter:1.9e154,innerDiameter:1e152,hasHoles:false},'4'),
  G.gasketGeometry({mode:'ring',outerDiameter:1e-200,innerDiameter:1e-201,hasHoles:false},'4'),
  G.threadGeometry(1e200,1),
  G.threadGeometry(1e-200,1e-210),
  G.packageLengths([{name:'А',height:1e308},{name:'Б',height:1e308,threaded:true}])
]) {
  assert(result.issues.length,'Overflow must have an explicit explanation');
  assert(Object.values(result.values).every(value=>value===null || Number.isFinite(value)));
}
