const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');
const G = require('../calculations.js');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/control-node-1.json'),'utf8'));
const cell = address => fixture.cells[address].value;
const close = (actual,expected) => assert.ok(actual !== null && Math.abs(actual-expected) <= Math.max(1e-18,Math.abs(expected)*1e-10), `${actual} != ${expected}`);
const makeInput = column => ({
  count:cell('C40'),
  gasket:{height:cell('C15'),area:cell('C22'),modulusMPa:cell(column+'24')},
  sideA:{height:cell('C87'),area:cell('C89'),modulusMPa:cell(column+'85')},
  sideB:{height:cell('C99'),area:cell('C101'),modulusMPa:cell(column+'94')},
  washerA:{height:cell('C60'),area:3.1415*cell('C61')*cell('C62'),modulusMPa:cell(column+'64')},
  extras:[],
  fastener:{modulusMPa:cell(column+'45'),nominalDiameter:cell('C34'),pitch:cell('C37'),rootDiameter:cell('C33'),meanDiameter:cell('C35'),smoothLength:cell('C38'),threadedLength:cell('C39'),smoothArea:cell('C47'),threadArea:cell('C48')}
});
for (const [inputColumn,resultColumn] of [['C','I'],['D','J']]) {
  const result = G.compliance(makeInput(inputColumn));
  assert.deepEqual(result.issues,[]);
  const rows = {gasket:4,washerA:8,sideB:10,sideA:11,threadJoint1:13,threadJoint2:14,smoothPart:15,threadedPart:16,fastener:17,loadFactor:18};
  for (const [key,row] of Object.entries(rows)) close(result.values[key],cell(resultColumn+row));
  assert.equal(result.fastenerClass,'short');
  assert.equal(result.values.washerB,0);
  assert.equal(result.values.extras,0);
}
const input = makeInput('C');
input.fastener.smoothLength = 144;
const long = G.compliance(input);
assert.equal(long.fastenerClass,'long','At exactly 6d use the long-fastener branch');
close(long.values.fastener,144/(cell('C45')*cell('C47')*32));
input.fastener.smoothLength = 143.999;
assert.equal(G.compliance(input).fastenerClass,'short');
const twoWashers = makeInput('C'); twoWashers.washerB = {...twoWashers.washerA};
assert.ok(G.compliance(twoWashers).values.loadFactor < G.compliance(makeInput('C')).values.loadFactor);
twoWashers.extras.push({name:'Проставка',height:5,area:10000,modulusMPa:200000});
close(G.compliance(twoWashers).values.extras,5/(10000*200000));
twoWashers.extras[0].area = '';
assert.equal(G.compliance(twoWashers).values.loadFactor,null);
const missing = makeInput('C'); missing.sideA.modulusMPa = null;
assert.equal(G.compliance(missing).values.sideA,null);
assert.equal(G.compliance(missing).values.loadFactor,null);
missing.sideA.modulusMPa = 0;
assert.equal(G.compliance(missing).values.loadFactor,null);
assert.equal(G.compliance({...makeInput('C'),count:2.5}).values.loadFactor,null);
assert.equal(G.compliance({}).values.loadFactor,null);

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../standards.bundle.js'),'utf8'),context);
const catalog = context.FlangeStandardsDB;
const node = C.createNode('Перевірка E');
node.operating.normal.temperature = '45'; node.operating.hydro.temperature = '20';
node.gasket = {...node.gasket,outerDiameter:'1300',innerDiameter:'1150',thickness:'2',hasHoles:true,holeDiameter:'24'};
node.fastener.nominalDiameter = '24'; node.fastener.count = '32';
node.connection.sideA.height = '55'; node.connection.sideB.height = '36'; node.washers.placement = 'a';
const materials = [['Кріплення',215,212],['Кришка',110,110],['Корпус',200,197]].map(([name,cold,warm]) => ({name,grades:[{kp:'',description:name,data:{E:{20:cold,50:warm}}}]}));
node.fastener.material = C.materialRef(materials[0],materials[0].grades[0]);
node.washers.material = node.fastener.material;
node.connection.sideA.material = C.materialRef(materials[1],materials[1].grades[0]);
node.connection.sideB.material = C.materialRef(materials[2],materials[2].grades[0]);
let adapted = G.nodeCompliance(node,materials,catalog);
close(adapted.areas.sideA,cell('C89'));
close(adapted.states.normal.values.sideA,cell('I11'));
close(adapted.states.hydro.values.sideB,cell('J10'));
assert.equal(adapted.states.normal.sources.find(item=>item.name==='Кріплення').valueMPa,212000);
assert.equal(adapted.states.normal.sources.find(item=>item.name==='Кріплення').temperature,50);
assert.ok(adapted.states.normal.values.loadFactor > 0 && adapted.states.normal.values.loadFactor < 1);
const size = C.washerDimensions(catalog,node.washers.standardId,24,node.washers.accuracyClass,node.washers.execution);
close(adapted.states.normal.values.washerA,size.thicknessMm/(32*212000*3.1415*(size.outerDiameterMm**2-size.innerDiameterMm**2)/4));
node.connection.sideA.area = '1000';
close(G.nodeCompliance(node,materials,catalog).states.normal.values.sideA,55/(110000*1000));
node.connection.sideA.area = '0';
assert.equal(G.nodeCompliance(node,materials,catalog).states.normal.values.loadFactor,null,'Zero override must not revert to automatic area');
node.connection.sideA.area = '';
node.operating.hydro.temperature = '900';
adapted = G.nodeCompliance(node,materials,catalog);
assert.notEqual(adapted.states.normal.values.loadFactor,null);
assert.equal(adapted.states.hydro.values.loadFactor,null);
node.operating.hydro.temperature = '20'; node.gasket.mode = 'area'; node.gasket.effectiveArea = '1000'; node.gasket.pressureArea = '5000';
assert.equal(G.nodeCompliance(node,materials,catalog).states.normal.values.loadFactor,null,'Non-ring geometry needs explicit joined-part areas');
node.connection.sideA.area = '2000'; node.connection.sideB.area = '2000';
assert.notEqual(G.nodeCompliance(node,materials,catalog).states.normal.values.loadFactor,null);
node.operating.hydro.temperature = '-300';
assert.equal(G.nodeCompliance(node,materials,catalog).states.hydro.values.loadFactor,null);

// Task 3: Assembly connection variations
// 1. Stud + nut + 2 washers
const testNode = structuredClone(node);
testNode.operating.hydro.temperature = '20';
testNode.gasket.mode = 'ring';
testNode.connection.sideA.area = '';
testNode.connection.sideB.area = '';
testNode.fastener.type = 'stud';
testNode.washers.placement = 'both';
let geo = G.nodeGeometry(testNode, catalog);
assert.equal(geo.lengths.issues.length, 0);
let comp = G.nodeCompliance(testNode, materials, catalog);
assert.ok(comp.states.normal.values.loadFactor > 0);
assert.ok(comp.states.normal.values.washerA > 0 && comp.states.normal.values.washerB > 0);

// 2. Bolt + nut + 1 washer
testNode.fastener.type = 'bolt';
testNode.washers.placement = 'a';
geo = G.nodeGeometry(testNode, catalog);
assert.equal(geo.lengths.issues.length, 0);
comp = G.nodeCompliance(testNode, materials, catalog);
assert.ok(comp.states.normal.values.loadFactor > 0);
assert.ok(comp.states.normal.values.washerA > 0 && comp.states.normal.values.washerB === 0);

// 3. Without washers
testNode.washers.placement = 'none';
geo = G.nodeGeometry(testNode, catalog);
assert.equal(geo.lengths.issues.length, 0);
comp = G.nodeCompliance(testNode, materials, catalog);
assert.ok(comp.states.normal.values.loadFactor > 0);
assert.equal(comp.states.normal.values.washerA, 0);
assert.equal(comp.states.normal.values.washerB, 0);
assert.equal(C.sectionStatus(testNode, materials, catalog).washers, true);

// 4. Bolt in tapped hole (body-bolt, no nuts)
testNode.fastener.type = 'body-bolt';
testNode.fastener.engagement = '25';
geo = G.nodeGeometry(testNode, catalog);
assert.equal(geo.lengths.issues.length, 0);
comp = G.nodeCompliance(testNode, materials, catalog);
assert.ok(comp.states.normal.values.loadFactor > 0);
assert.equal(C.validateInputs(testNode, catalog).errors['fastener.engagement'], undefined);
const bodyBoltStatus = C.sectionStatus(testNode, materials, catalog);
assert.equal(bodyBoltStatus.nut, undefined);
const bodyBoltProgress = C.progress(testNode, materials, catalog);
assert.equal(bodyBoltProgress.total, 6);

console.log('OK: 20 величин I/J4–18, гілка L*=6d, активні/відсутні елементи, E ГПа→МПа, температури та площі.');
