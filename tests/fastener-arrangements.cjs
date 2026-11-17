'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js'), G = require('../calculations.js'), P = require('../project.js');
const catalog = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../standards.bundle.js'),'utf8')+';FlangeStandardsDB');

// Case geometry in mm: 55 mm cover, 36 mm body, 2 mm gasket, M24,
// 12 mm engagement in the tapped part or 21.5 mm of thread in a normal nut.
// Different yields and expansion coefficients expose a swapped physical side.
function material(name,rp,alpha) {
  const data = {E:{20:200,50:200},RTm:{20:700,50:700},RTp:{20:rp,50:rp},Alpha:{20:alpha,50:alpha}};
  return {name,grades:[{kp:'',description:name,data}]};
}
const materials = [material('Стрижень',600,11),material('Кришка',280,10),material('Корпус',500,12),material('Гайка',350,11),material('Друга гайка',110,11)];
const ref = m=>C.materialRef(m,m.grades[0]);
function example(type,reversed=false) {
  const node = C.createNode('Контроль кріплення');
  Object.assign(node.fastener,{type,reversed,nominalDiameter:'24',count:'32',torqueNm:'200',engagement:'12',material:ref(materials[0])});
  Object.assign(node.gasket,{outerDiameter:'1300',innerDiameter:'1150',thickness:'2',hasHoles:true,holeDiameter:'24'});
  Object.assign(node.connection.sideA,{height:'55',material:ref(materials[1])});
  Object.assign(node.connection.sideB,{height:'36',material:ref(materials[2])});
  node.flanges.sideA.mode = node.flanges.sideB.mode = 'none';
  node.nut.material = ref(materials[3]);
  node.operating = {normal:{temperature:'45',pressure:'0.6',medium:'Рідина'},hydro:{temperature:'20',pressure:'0.85',medium:'Вода'}};
  return node;
}
const close = (a,b)=>assert.ok(Number.isFinite(a) && Math.abs(a-b) < 1e-9, `${a} != ${b}`);
for (const [type,forwardA,forwardB,smooth,reverseSmooth,threaded] of [
  ['stud','nut','body',57,38,33.5],
  ['body-bolt','head','body',57,38,12],
  ['bolt','head','nut',93,93,21.5],
  ['through-stud','nut','nutB',93,93,43]
]) {
  for (const reversed of [false,true]) {
    const node = example(type,reversed), mount = C.mounting(node);
    assert.deepEqual([mount.a,mount.b],reversed ? [forwardB,forwardA] : [forwardA,forwardB]);
    if (type === 'body-bolt') {
      // Retained form data for a hidden nut must never require a material or height.
      node.nut = {material:null,standardId:'gost-9064-75',typeId:'B',threadedHeight:'1000'};
      assert(!Object.hasOwn(C.sectionStatus(node,materials,catalog),'nut'));
    }
    assert.deepEqual(C.validateInputs(node,catalog).errors,{});
    const lengths = G.nodeGeometry(node,catalog).lengths;
    assert.deepEqual(lengths.issues,[]);
    assert.equal(lengths.values.smoothLength,reversed ? reverseSmooth : smooth);
    assert.equal(lengths.values.threadedLength,threaded);
    const {sideA,sideB} = G.nodeThermal(node,materials,catalog).normal.values;
    close(sideA,mount.a === 'body' ? 0 : 55*10*25e-6);
    close(sideB,mount.b === 'body' ? 0 : 36*12*25e-6);
    const {issues,threads} = G.nodeStrength(node,materials,catalog).states.normal;
    assert.deepEqual(issues,[]);
    assert.equal(threads.nut.active,type !== 'body-bolt');
    assert.equal(threads.fastenerBody.active,!!mount.body);
    if (mount.body) {
      assert.equal(threads.body.height,12);
      close(threads.body.allowable,0.32*(reversed ? 280 : 500));
    }
    const limits = G.nodeLimits(node,materials,catalog);
    assert(limits.maximum.torqueNm > 0);
    assert.equal(limits.verification.maximum.pending.length,0);
    const active = limits.maximum.candidates.filter(c=>c.mode === 'normal' && c.active).map(c=>c.key);
    assert.equal(active.includes('nutB'),type === 'through-stud');
    assert.equal(active.includes('body'),!!mount.body);
    assert.equal(active.includes('nut'),type !== 'body-bolt');
  }
}

const double = example('through-stud');
double.nutB = {standardId:'gost-9064-75',typeId:'B',threadedHeight:'8',material:ref(materials[4])};
double.fastener.differentNuts = true;
assert.equal(G.nodeGeometry(double,catalog).lengths.values.threadedLength,29.5);
const strength = G.nodeStrength(double,materials,catalog).states.hydro.threads;
close(strength.nutB.allowable,110*0.25);
close(strength.nutB.area,Math.PI*24*8*32*0.87*0.55);
const limits = G.nodeLimits(double,materials,catalog);
assert(limits.maximum.governing.some(c=>c.key === 'nutB'));
assert(limits.verification.minimum.checks.some(c=>c.key === 'nutB'));
const equipment = C.createEquipment('Насос');
equipment.nodes.push(double);
const restored = P.parse(P.serialize({version:1,equipment:[equipment]})).equipment[0].nodes[0];
assert.deepEqual(restored,double);
double.nutB.threadedHeight = '1000';
assert(C.validateInputs(double,catalog).errors['nutB.threadedHeight']);
assert.equal(G.nodeLimits(double,materials,catalog).maximum.torqueNm,null);
double.fastener.differentNuts = false;
assert.equal(G.nodeGeometry(double,catalog).lengths.values.threadedLength,43);
assert.deepEqual(C.validateInputs(double,catalog).errors,{});

const tapped = example('body-bolt');
tapped.fastener.engagement = '45';
assert(C.validateInputs(tapped,catalog).errors['fastener.engagement']);
assert.equal(G.nodeGeometry(tapped,catalog).lengths.values.totalLength,null);
assert.equal(G.nodeLimits(tapped,materials,catalog).maximum.torqueNm,null);
tapped.fastener.reversed = true;
assert.deepEqual(C.validateInputs(tapped,catalog).errors,{});
delete tapped.fastener.engagement;
assert(C.validateInputs(tapped,catalog).missing['fastener.engagement']);
assert.equal(G.nodeLimits(tapped,materials,catalog).maximum.torqueNm,null);
const legacy = example('stud');
delete legacy.fastener.engagement;
assert.equal(G.nodeGeometry(legacy,catalog).lengths.values.threadedLength,36+21.5);
console.log('Fastener arrangements: both orientations, engagement, second-nut properties, active limits and JSON round trip passed.');
