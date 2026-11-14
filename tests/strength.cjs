const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');
const G = require('../calculations.js');
const fixture = require('./fixtures/control-node-1.json');
const cell = address => fixture.cells[address].value;
const close = (a,b) => assert.ok(a !== null && Math.abs(a-b) <= Math.max(1e-10,Math.abs(b)*1e-10),`${a} != ${b}`);
function sourceInput(mode) {
  const f = mode === 'normal' ? 'I' : 'J', c = mode === 'normal' ? 'C' : 'D';
  return {mode,yieldMPa:cell(c+'51'),count:cell('C40'),smoothArea:cell('C47'),diameter:cell('C34'),rootDiameter:cell('C33'),axialHoleDiameter:cell('C36'),
    initialTotal:cell(f+'28'),initialSingle:cell(f+'27'),hydrostatic:cell(f+'30'),loadFactor:cell(f+'18'),thermalForce:cell(f+'32'),torsionFactor:cell('C42'),
    nutYieldMPa:cell(c+'82'),nutHeight:cell('C80'),bodyYieldMPa:cell(c+'103'),bodyHeight:cell('C98'),bodyThreadActive:true};
}
for (const mode of ['normal','hydro']) {
  const result = G.strength(sourceInput(mode)), col = mode === 'normal' ? 'N' : 'O';
  close(result.values.torsionMoment,cell('C32'));
  for (const [key,row] of [['axial',4],['allowable',5],['torsion',13],['torsionAllowable',14],...(mode === 'normal' ? [['thermalAxial',7],['thermalAllowable',8],['equivalent',10],['equivalentAllowable',11]] : [])]) close(result.values[key],cell(col+row));
  for (const [key,row] of [['axial',6],['torsion',15],...(mode === 'normal' ? [['thermalAxial',9],['equivalent',12]] : [])]) close(result.checks[key].margin,cell(col+row));
  for (const [key,row] of [['fastenerNut',23],['fastenerBody',30],['nut',37],['body',44]]) {
    close(result.threads[key].actual,cell(col+row)); close(result.threads[key].allowable,cell(col+(row+1))); close(result.threads[key].margin,cell(col+(row+2)));
  }
  assert.ok(Object.values(result.checks).filter(check=>check.active).every(check=>check.passed));
  assert.ok(Object.values(result.threads).every(check=>check.passed));
  if (mode === 'hydro') for (const key of ['thermalAxial','equivalent']) {
    assert.equal(result.checks[key].active,false); assert.equal(result.checks[key].passed,null);
  }
}
const base = sourceInput('normal');
let result = G.strength({...base,yieldMPa:null});
assert.equal(result.checks.axial.passed,null);
assert.equal(result.threads.fastenerNut.passed,null);
assert.equal(result.threads.nut.passed,true,'Missing fastener Rp does not hide a computable nut check');
assert.equal(G.strength({...base,nutHeight:null}).threads.nut.passed,null);
assert.equal(G.strength({...base,bodyYieldMPa:null}).threads.body.passed,null);
result = G.strength({...base,bodyThreadActive:false,bodyHeight:null,bodyYieldMPa:null});
assert.equal(result.threads.body.active,false); assert.equal(result.threads.fastenerBody.active,false);
assert.equal(result.threads.nut.passed,true);
assert.ok(!result.issues.some(issue=>issue.includes('Rp корпусу')));
assert.equal(G.strength({...base,initialTotal:null}).checks.axial.passed,null);
assert.equal(G.strength({...base,initialTotal:1e8,initialSingle:1e8/base.count}).checks.axial.passed,false);
assert.equal(G.strength({...base,axialHoleDiameter:base.rootDiameter}).values.torsion,null);
assert.equal(G.strength({...base,count:0}).values.axial,null);
const unloaded = G.strength({...base,initialTotal:0,initialSingle:0,hydrostatic:0,thermalForce:0});
assert.equal(unloaded.checks.torsion.actual,0); assert.equal(unloaded.checks.torsion.passed,true); assert.equal(unloaded.checks.torsion.margin,null);
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../standards.bundle.js'),'utf8'),context);
const catalog = context.FlangeStandardsDB;
const material = {name:'Тестова сталь',grades:[{kp:'',description:'Тест',data:{E:{20:215,50:212},Alpha:{20:11.5,50:11.5},RTp:{20:590,50:579}}}]};
const node = C.createNode('Тест міцності');
node.operating = {normal:{pressure:'0.6',temperature:'45',medium:'Рідина'},hydro:{pressure:'0.85',temperature:'20',medium:'Вода'}};
Object.assign(node.gasket,{thickness:'2',outerDiameter:'1300',innerDiameter:'1150',hasHoles:true,holeDiameter:'24'});
Object.assign(node.fastener,{nominalDiameter:'24',count:'32',torqueNm:'200'});
for (const part of [node.fastener,node.nut,node.connection.sideA,node.connection.sideB]) part.material = C.materialRef(material,material.grades[0]);
node.connection.sideA.height = '55'; node.connection.sideB.height = '36';
result = G.nodeStrength(node,[material],catalog);
assert.equal(result.states.normal.sources.find(item=>item.name === 'Кріплення').temperature,50);
close(result.states.normal.values.allowable,579/2);
close(result.states.hydro.values.allowable,590*0.7);
assert.equal(result.torsionFactor,0.13);
node.fastener.lubricated = false;
assert.equal(G.nodeStrength(node,[material],catalog).torsionFactor,0.18);
node.fastener.type = 'bolt';
assert.equal(G.nodeStrength(node,[material],catalog).states.normal.threads.body.active,false);
node.nut.standardId = 'gost-9064-75'; node.nut.typeId = 'B'; node.nut.threadedHeight = '';
assert.equal(G.nodeStrength(node,[material],catalog).states.normal.threads.nut.actual,null);
node.nut.threadedHeight = '20';
assert.notEqual(G.nodeStrength(node,[material],catalog).states.normal.threads.nut.actual,null);
node.nut.threadedHeight = '1000';
assert.equal(G.nodeStrength(node,[material],catalog).states.normal.threads.nut.actual,null);
node.nut.threadedHeight = '20';
material.grades[0].data.RTp[50] = 100;
close(G.nodeStrength(node,[material],catalog).states.normal.values.allowable,50,'Live material properties');
delete material.grades[0].data.RTp[50];
assert.equal(G.nodeStrength(node,[material],catalog).states.normal.checks.axial.passed,null);
assert.notEqual(G.nodeStrength(node,[material],catalog).states.hydro.checks.axial.passed,null);
console.log('OK: 43 величини міцності Excel, НУЕ/ГВ, різьба шпильки/болта, актуальні Rp, кручення та неповні дані.');
