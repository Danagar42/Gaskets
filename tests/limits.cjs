const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../core.js');
const G = require('../calculations.js');
const fixture = require('./fixtures/control-node-1.json');
const cell = address => fixture.cells[address].value;
const close = (a,b) => assert.ok(a !== null && Math.abs(a-b) <= Math.max(1e-9,Math.abs(b)*1e-10),`${a} != ${b}`);
const input = {smoothArea:cell('C47'),count:cell('C40'),diameter:cell('C34'),friction:cell('C41'),states:{}};
for (const [mode,c,f] of [['normal','N','I'],['hydro','O','J']]) {
  const threads = {};
  for (const [key,row,diameter] of [['fastenerNut',23,cell('C33')],['fastenerBody',30,cell('C33')],['nut',37,cell('C34')],['body',44,cell('C34')]]) {
    threads[key] = {active:true,allowable:cell(c+(row+1)),area:Math.PI*diameter*cell(c+(row-3))*cell('C40')*cell(c+(row-2))*cell(c+(row-1))};
  }
  input.states[mode] = {allowable:cell(c+'5'),loadFactor:cell(f+'18'),hydrostatic:cell(f+'30'),thermalForce:cell(f+'32'),threads};
}
let result = G.maximum(input);
for (const candidate of result.candidates) close(candidate.force,cell(candidate.cell));
close(result.force,cell('N83')); close(result.torqueNm,cell('N84'));
assert.equal(result.roundedTorqueNm,cell('P89'));
assert.deepEqual(result.governing.map(item=>item.cell),['O71']);
assert.equal(result.complete,false,'Flange constraints are still missing');
const changed = structuredClone(input);
changed.states.normal.thermalForce = 100000;
const normal = G.maximum(changed).candidates;
close(normal.find(item=>item.cell === 'N67').force,cell('N66')+100000,'Literal +Ft sign');
changed.states.hydro.thermalForce = 100000;
close(G.maximum(changed).candidates.find(item=>item.cell === 'O67').force,cell('O66')-100000);
changed.states.normal.threads.nut.allowable = null;
assert.equal(G.maximum(changed).force,null,'An unknown active constraint must not disappear from MIN');
for (const mode of ['normal','hydro']) for (const key of ['fastenerBody','body']) changed.states[mode].threads[key] = {active:false};
changed.states.normal.threads.nut.allowable = input.states.normal.threads.nut.allowable;
assert.notEqual(G.maximum(changed).force,null,'Explicitly inactive body threads are excluded');
assert.equal(G.maximum({...input,count:1.5}).force,null);
assert.equal(G.maximum({...input,friction:0}).torqueNm,null);
const tied = {diameter:1,count:1,friction:1000,smoothArea:10,states:{}};
for (const mode of ['normal','hydro']) tied.states[mode] = {allowable:1,loadFactor:0,hydrostatic:0,thermalForce:0,threads:Object.fromEntries(['fastenerNut','fastenerBody','nut','body'].map(key=>[key,{active:true,area:100,allowable:1}]))};
assert.equal(G.maximum(tied).roundedTorqueNm,10,'An integer bound stays inclusive');
assert.deepEqual(G.maximum(tied).governing.map(item=>item.cell),['N66','N67','O66','O67'],'Report all tied governing constraints');
changed.states.normal.thermalForce = 1e9;
assert.ok(G.maximum(changed).force < 0,'Do not clamp a negative bound to zero');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../standards.bundle.js'),'utf8'),context);
const catalog = JSON.parse(JSON.stringify(context.FlangeStandardsDB));
const material = {name:'Тестова сталь',grades:[{kp:'',description:'Тест',data:{E:{20:215,50:212},Alpha:{20:11.5,50:11.5},RTp:{20:590,50:579}}}]};
const node = C.createNode('Межі');
node.operating = {normal:{pressure:'0.6',temperature:'45',medium:'Рідина'},hydro:{pressure:'0.85',temperature:'20',medium:'Вода'}};
Object.assign(node.gasket,{thickness:'2',outerDiameter:'1300',innerDiameter:'1150',hasHoles:true,holeDiameter:'24'});
Object.assign(node.fastener,{nominalDiameter:'24',count:'32'});
for (const part of [node.fastener,node.nut,node.connection.sideA,node.connection.sideB]) part.material = C.materialRef(material,material.grades[0]);
node.connection.sideA.height = '55'; node.connection.sideB.height = '36';
const before = JSON.stringify(node);
result = G.nodeLimits(node,[material],catalog);
assert.equal(JSON.stringify(node),before,'Endpoint trials never write a torque into the questionnaire');
assert.equal(result.rawOverlap,true); assert.equal(result.roundedOverlap,true);
assert.ok(result.verification.maximum.checks.length > 0);
assert.equal(result.verification.maximum.pending.length,0);
assert.equal(result.complete,false);
const upper = result.maximum;
node.fastener.torqueNm = '100';
close(G.nodeLimits(node,[material],catalog).maximum.torqueNm,upper.torqueNm,'Maximum is independent of the selected torque');
const gasket = catalog.gaskets[node.gasket.referenceId];
gasket.maximumPressureMPa = 5;
result = G.nodeLimits(node,[material],catalog);
close(result.maximum.torqueNm,upper.torqueNm,'Do not add a qmax bound absent from Excel');
assert.ok(result.verification.maximum.failed.some(item=>item.group === 'gasket' && item.key === 'maximumPressure'),'But endpoint verification must expose qmax failure');
gasket.maximumPressureMPa = 200;
const narrowMinimum = (Math.floor(upper.torqueNm)+upper.torqueNm)/2;
gasket.seatingPressureMPa = narrowMinimum*32*1000/(0.26*24*G.nodeGeometry(node,catalog).gasket.values.effectiveArea);
result = G.nodeLimits(node,[material],catalog);
assert.equal(result.rawOverlap,true); assert.equal(result.roundedOverlap,false,'Rounding can leave no whole-Nm setting');

// AUD-012: Diagnostic on rounding conflict
const diagRounding = G.tighteningLimitsDiagnostic(result, node, catalog);
assert.equal(diagRounding.status, 'rounding_conflict');
assert.equal(diagRounding.bottleneck, 'rounding');
assert.ok(diagRounding.recommendations.length >= 2);

gasket.seatingPressureMPa *= 2;
result = G.nodeLimits(node,[material],catalog);
assert.equal(result.rawOverlap,false);
assert.ok(result.forces, 'nodeLimits must include forces (AUD-007 optimization)');
assert.ok(result.strength, 'nodeLimits must include strength (AUD-007 optimization)');

// AUD-012: Diagnostic on limits conflict (M_min > M_max)
const diagConflict = G.tighteningLimitsDiagnostic(result, node, catalog);
assert.equal(diagConflict.status, 'conflict');
assert.ok(diagConflict.bottleneck, 'Diagnostic must identify bottleneck component');
assert.ok(diagConflict.recommendations.length > 0, 'Diagnostic must produce actionable recommendations');
assert.ok(diagConflict.recommendations.some(r => r.includes('прокладки')), 'Should recommend gasket adjustments');

gasket.seatingPressureMPa = 5;
const okLimits = G.nodeLimits(node,[material],catalog);
const diagOk = G.tighteningLimitsDiagnostic(okLimits, node, catalog);
assert.equal(diagOk.status, 'ok');
assert.equal(diagOk.bottleneck, null);
assert.deepEqual(diagOk.recommendations, []);
const diagNull = G.tighteningLimitsDiagnostic(null, node, catalog);
assert.equal(diagNull.status, 'incomplete');

// AUD-012 edge cases hardening:
// Defect A: malformed/null items in governing arrays must not throw
const diagMalformedGov = G.tighteningLimitsDiagnostic({
  minimum: { torqueNm: 200, governing: [null, undefined, { key: null }] },
  maximum: { torqueNm: 100, governing: [null, { side: null }, { key: 'axial' }] },
  rawOverlap: false,
  roundedOverlap: false
}, node, catalog);
assert.equal(diagMalformedGov.status, 'conflict');
assert.equal(diagMalformedGov.bottleneck, 'stud tensile strength');

// Defect B: undefined / NaN torque values must return incomplete status
const diagUndefinedTorque = G.tighteningLimitsDiagnostic({
  minimum: { torqueNm: undefined },
  maximum: { torqueNm: undefined }
}, node, catalog);
assert.equal(diagUndefinedTorque.status, 'incomplete');
assert.equal(diagUndefinedTorque.bottleneck, 'none');

const diagNaNTorque = G.tighteningLimitsDiagnostic({
  minimum: { torqueNm: NaN },
  maximum: { torqueNm: 100 }
}, node, catalog);
assert.equal(diagNaNTorque.status, 'incomplete');

// Defect C: missing rawOverlap/roundedOverlap fallback calculation
const diagOmittedOverlapOk = G.tighteningLimitsDiagnostic({
  minimum: { torqueNm: 100 },
  maximum: { torqueNm: 200 }
}, node, catalog);
assert.equal(diagOmittedOverlapOk.status, 'ok');

const diagOmittedOverlapConflict = G.tighteningLimitsDiagnostic({
  minimum: { torqueNm: 250 },
  maximum: { torqueNm: 150 }
}, node, catalog);
assert.equal(diagOmittedOverlapConflict.status, 'conflict');

const diagOmittedOverlapRounding = G.tighteningLimitsDiagnostic({
  minimum: { torqueNm: 100.4 },
  maximum: { torqueNm: 100.6 }
}, node, catalog);
assert.equal(diagOmittedOverlapRounding.status, 'rounding_conflict');
material.grades[0].data.RTp = {};
result = G.nodeLimits(node,[material],catalog);
assert.equal(result.maximum.torqueNm,null); assert.equal(result.roundedOverlap,null);
assert.notEqual(result.minimum.torqueNm,null,'Missing Rp does not erase the independent lower bound');
material.grades[0].data.RTp = {20:590,50:579};
const cast = {name:'Чавун СЧ25',grades:[{kp:'',description:'Контроль',data:{E:{20:110,50:110},Alpha:{20:10,50:10},RTm:{20:250,50:250},RTp:{20:'—',50:'—'}}}]};
const withCast = [material,cast];
node.connection.sideB.material = C.materialRef(cast,cast.grades[0]);
result = G.nodeLimits(node,withCast,catalog);
assert.notEqual(result.maximum.torqueNm,null,'User-approved Excel omission allows a numeric maximum');
assert.deepEqual(result.maximum.omitted.map(item=>item.cell),['N74','O74']);
assert.equal(result.maximum.candidates.find(item=>item.cell === 'N72').active,true,'The fastener thread at the body must still be checked');
assert.equal(result.verification.maximum.pending.length,0);
assert.equal(result.verification.maximum.omitted.length,2);
assert.equal(result.verification.maximum.checks.find(check=>check.group === 'threads' && check.key === 'body').passed,null,'Omission is not a pass');
assert.equal(result.complete,false); assert.equal(result.rangePassed,false);
node.nut.material = null;
assert.equal(G.nodeLimits(node,withCast,catalog).maximum.torqueNm,null,'The exception cannot hide other missing material data');
node.nut.material = node.fastener.material;
cast.grades[0].data.RTp = {20:235};
result = G.nodeLimits(node,withCast,catalog);
assert.equal(result.maximum.torqueNm,null,'Missing requested-temperature Rp is pending when a material has a yield table');
assert.equal(result.maximum.omitted.length,0);
cast.grades[0].data.RTp = {20:0};
assert.equal(G.nodeLimits(node,withCast,catalog).maximum.omitted.length,0,'Invalid numeric Rp must not be reclassified as absent');
cast.grades[0].data.RTp = {};
cast.name = 'Сталь без Rp'; node.connection.sideB.material = C.materialRef(cast,cast.grades[0]);
assert.equal(G.nodeLimits(node,withCast,catalog).maximum.torqueNm,null,'Non-cast-iron unknown Rp is not skipped');
node.fastener.type = 'bolt';
assert.equal(G.nodeLimits(node,withCast,catalog).maximum.omitted.length,0,'An absent body thread is inapplicable, not an omission');
console.log('OK: 12 обмежень Excel, максимум/P89, неповні дані, незалежність від моменту, перевірка меж та несумісність після округлення.');
