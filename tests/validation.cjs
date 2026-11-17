'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../core.js'),G=require('../calculations.js'),X=require('../excel-export.js');
const root=path.join(__dirname,'..'),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'standards.bundle.js'),'utf8'),context);
const catalog=context.FlangeStandardsDB;
const fixture=require('./fixtures/workbook-comparison.json');
const base=fixture.nodes[0].application.node;
const report=node=>C.validateInputs(node,catalog);
assert.deepEqual(report(base),{errors:{},missing:{}});
let cases=0;
function invalid(field,value,expectedField=field) {
  const node=structuredClone(base);C.set(node,field,value);
  assert(report(node).errors[expectedField],`${field}=${value} must flag ${expectedField}`);cases++;
}
for(const value of ['abc','5 МПа','1e3','1,2.3','NaN','Infinity','-0.1'])invalid('operating.normal.pressure',value);
for(const field of ['gasket.thickness','fastener.nominalDiameter','connection.sideA.height','connection.sideB.area'])for(const value of ['0','-1'])invalid(field,value);
for(const value of ['0','1.5','9007199254740992'])invalid('fastener.count',value);
invalid('fastener.nominalDiameter','100');invalid('fastener.pitch','99');invalid('fastener.axialHoleDiameter','21');
invalid('operating.normal.temperature','-273.16');invalid('operating.hydro.temperature','-300');invalid('operating.normal.temperature','400.1');
invalid('operating.normal.medium','Відсутнє');invalid('gasket.innerDiameter','1300');invalid('gasket.outerDiameter','1100');
invalid('gasket.holeDiameter','75');invalid('fastener.count','100000');
invalid('flanges.sideA.boltCircle','1000');invalid('flanges.sideA.outerDiameter','1199');invalid('flanges.sideA.holeDiameter','126');
invalid('flanges.sideA.innerDiameter','1230');invalid('flanges.sideA.height','0');invalid('flanges.sideA.coneHeight','-1');
invalid('fastener.torqueNm','-1');invalid('fastener.torqueNm','200 Нм');
let node=structuredClone(base);
for (const [pattern,limit] of [['single',200],['cross',200/Math.SQRT2],['tee',200/Math.SQRT2],['parallel',100]]) {
  const sample=structuredClone(base);
  Object.assign(sample.gasket,{innerDiameter:'200',partitionPattern:pattern,partitionWidth:''});
  assert.ok(report(sample).missing['gasket.partitionWidth']);
  for (const width of ['-1','0',String(limit)]) {
    sample.gasket.partitionWidth=width;
    assert.ok(report(sample).errors['gasket.partitionWidth']);
  }
  sample.gasket.partitionWidth='12,5';
  assert.ok(!report(sample).errors['gasket.partitionWidth']);
  sample.gasket.partitionWidth='-1';
  sample.gasket.partitionPattern='none';
  assert.ok(!report(sample).errors['gasket.partitionWidth']);
  Object.assign(sample.gasket,{mode:'area',partitionPattern:pattern});
  assert.ok(!report(sample).errors['gasket.partitionWidth']);
}
node.operating.normal.pressure='0';node.operating.normal.temperature='-273.15';node.operating.hydro.temperature='500';
node.fastener.torqueNm='';node.connection.sideA.area='';node.flanges.sideA.holeDiameter='';node.flanges.sideA.coneHeight='0';
assert.deepEqual(report(node).errors,{},'Valid zeros, negative Celsius, auto areas and hydro thermal convention remain supported');
node=structuredClone(base);node.gasket.hasHoles=false;node.gasket.holeDiameter='bad';node.flanges.sideA.mode='none';node.flanges.sideA.height='bad';
assert.deepEqual(report(node).errors,{},'Inactive dimensions must not block a different construction');
node=structuredClone(base);node.gasket.mode='area';node.gasket.outerDiameter='bad';node.gasket.effectiveArea='1000,5';node.gasket.pressureArea='5000';node.flanges.sideA.gasketDiameter='1225';
assert.deepEqual(report(node).errors,{});
node.connection.sideA.area='';assert(report(node).missing['connection.sideA.area']);
node.gasket.effectiveArea='0';assert(report(node).errors['gasket.effectiveArea']);
node.flanges.sideA.gasketDiameter='1050';assert(report(node).errors['flanges.sideA.gasketDiameter']);
node=structuredClone(base);node.fastener.nominalDiameter='15';node.fastener.pitch='';
assert(report(node).missing['fastener.pitch']);node.fastener.pitch=String(catalog.threads[node.fastener.threadStandardId].sizes['15'].pitchesMm[0]);
assert(!report(node).errors['fastener.pitch']);assert(!report(node).missing['fastener.pitch']);
node=structuredClone(base);Object.assign(node.nut,{standardId:'gost-9064-75',typeId:'B',threadedHeight:''});
assert(report(node).missing['nut.threadedHeight']);
node.nut.threadedHeight=String(C.nutDimensions(catalog,node.nut.standardId,'24','B').heightMm+1);
assert(report(node).errors['nut.threadedHeight']);
node=structuredClone(base);node.extras=[{id:C.id(),name:'Проставка',thickness:'-1',area:'',material:null}];
assert(report(node).errors['extras.0.thickness']);assert(report(node).missing['extras.0.area']);
const empty=report(C.createNode('Порожній'));
assert.deepEqual(empty.errors,{});assert(empty.missing['operating.normal.pressure']);

node=structuredClone(base);
node.fastener.targetTorqueMinNm='500';node.fastener.targetTorqueMaxNm='300';
assert(report(node).errors['fastener.targetTorqueMaxNm']);
node.fastener.targetTorqueMinNm='-50';
assert(report(node).errors['fastener.targetTorqueMinNm']);
node.fastener.targetTorqueMinNm='200';node.fastener.targetTorqueMaxNm='300';
assert(!report(node).errors['fastener.targetTorqueMinNm']&&!report(node).errors['fastener.targetTorqueMaxNm']);

const materials=vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8')+';materialsDB');
node=structuredClone(fixture.nodes[1].application.node);
assert(G.nodeLimits(node,materials,catalog).rangePassed);
node.fastener.torqueNm='помилка';
const limits=G.nodeLimits(node,materials,catalog);
assert.equal(limits.rangePassed,false);assert(limits.inputErrors['fastener.torqueNm']);
assert.equal(C.sectionStatus(node,materials,catalog).fastener,false);
assert(X.inspect(node,materials,catalog).errors.length);

// Engineering advisory checks (Task 4)
const normalAdv = G.flangeGeometryAdvisories({boltCircle:'1200',count:'32',holeDiameter:'26',outerDiameter:'1300',innerDiameter:'1050'});
assert.ok(Math.abs(normalAdv.boltPitch - (Math.PI * 1200 / 32)) < 1e-9);
assert.ok(Math.abs(normalAdv.pitchRatio - ((Math.PI * 1200 / 32) / 26)) < 1e-9);
assert.equal(normalAdv.edgeOuter, 50);
assert.equal(normalAdv.edgeInner, 75);
assert.equal(normalAdv.warnings.length, 0);

const smallPitchAdv = G.flangeGeometryAdvisories({boltCircle:'200',count:'32',holeDiameter:'26',outerDiameter:'300',innerDiameter:'150'});
assert.ok(smallPitchAdv.warnings.some(w => w.includes('Крок кріплень малий')));

const largePitchAdv = G.flangeGeometryAdvisories({boltCircle:'1200',count:'4',holeDiameter:'20',outerDiameter:'1300',innerDiameter:'1050'});
assert.ok(largePitchAdv.warnings.some(w => w.includes('Крок кріплень великий')));

const smallEdgeAdv = G.flangeGeometryAdvisories({boltCircle:'1280',count:'32',holeDiameter:'26',outerDiameter:'1300',innerDiameter:'1050'});
assert.ok(smallEdgeAdv.warnings.some(w => w.includes('Зовнішня кромка фланця мала')));

const smallInnerEdgeAdv = G.flangeGeometryAdvisories({boltCircle:'1100',count:'32',holeDiameter:'26',outerDiameter:'1300',innerDiameter:'1080'});
assert.ok(smallInnerEdgeAdv.warnings.some(w => w.includes('Внутрішня кромка фланця мала')));

const emptyAdv = G.flangeGeometryAdvisories({});
assert.equal(emptyAdv.boltPitch, null);
assert.equal(emptyAdv.pitchRatio, null);
assert.deepEqual(emptyAdv.warnings, []);

// Nut standard compatibility for d > 48 (Task 5)
for (const d of ['52','56','60']) {
  assert.equal(C.nutDimensions(catalog,'gost-5915-70',d,'A'), null, `ГОСТ 5915-70 must not have sizes for M${d}`);
  assert.notEqual(C.nutDimensions(catalog,'gost-9064-75',d,'A'), null, `ГОСТ 9064-75 must have sizes for M${d}`);
}

console.log(`Input validation: ${cases} invalid values, cross-field geometry, optional fields and calculation/export gates passed.`);
