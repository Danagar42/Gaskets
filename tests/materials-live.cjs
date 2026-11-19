'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../core.js'),G=require('../calculations.js'),X=require('../excel-export.js');
const root=path.join(__dirname,'..'),context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'standards.bundle.js'),'utf8'),context);
const catalog=JSON.parse(JSON.stringify(context.FlangeStandardsDB));
const materials=vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8')+';materialsDB');
const node=structuredClone(require('./fixtures/workbook-comparison.json').nodes[1].application.node);
const ref=node.fastener.material;
for(const part of [node.nut,node.connection.sideA,node.connection.sideB,node.washers])part.material=ref;
const grade=C.resolveMaterial(materials,ref).grade,original=structuredClone(grade.data);
const baseline=G.nodeLimits(node,materials,catalog);
assert(baseline.rangePassed,'The live-material control case must have a verified range');
const cast = materials.find(material=>material.name === 'Чавун СЧ25');
const castNode = structuredClone(node);
castNode.connection.sideA.material = C.materialRef(cast,cast.grades[0]);
assert(G.nodeLimits(castNode,materials,catalog).rangePassed);
assert.equal(C.sectionStatus(castNode,materials,catalog).connection,true,'A verified cast-iron flange must not require unused Rp');
assert.deepEqual(C.missingMaterialProperties(castNode,materials,'connection.sideA.material'),[]);
const castWithSectionC = structuredClone(castNode);
castWithSectionC.flanges.sideA.height = '10';
assert(C.missingMaterialProperties(castWithSectionC,materials,'connection.sideA.material').some(item=>item.mode === 'normal' && item.property === 'RTp'),'The active source-workbook section C still needs Rp on side A');
const partitionNode = structuredClone(node);
Object.assign(partitionNode.gasket,{partitionPattern:'cross',partitionWidth:'10'});
assert(X.inspect(partitionNode,materials,catalog).warnings.some(note=>/перегород/i.test(note)),'Ring-only calculations must disclose the partition scope');
assert(/перегород/i.test(X.inputs(partitionNode,{name:'Контроль'},materials,catalog,100,[]).M2),'The standalone workbook must contain the partition note');
partitionNode.gasket.mode = 'area';
assert.equal(C.gasketCalculationNote(partitionNode),'','Manually supplied areas have their own scope');
for(const [temperature,value]of Object.entries(grade.data.RTp))if(typeof value==='number')grade.data.RTp[temperature]=value*0.8;
let changed=G.nodeLimits(node,materials,catalog);
assert(changed.maximum.torqueNm<baseline.maximum.torqueNm,'Updated yield strength must immediately lower the upper bound');
assert.equal(changed.minimum.torqueNm,baseline.minimum.torqueNm);
grade.data=structuredClone(original);
const chiBefore=G.nodeCompliance(node,materials,catalog).states.normal.values.loadFactor;
for(const [temperature,value]of Object.entries(grade.data.E))if(typeof value==='number')grade.data.E[temperature]=value*0.5;
assert(G.nodeCompliance(node,materials,catalog).states.normal.values.loadFactor<chiBefore,'Updated E must immediately change compliance and load factor');
grade.data=structuredClone(original);
const before=G.nodeThermal(node,materials,catalog).normal;
for(const [temperature,value]of Object.entries(grade.data.Alpha))if(typeof value==='number')grade.data.Alpha[temperature]=value*2;
const expectedForce=(2*before.values.pack-before.values.gasket)/before.totalCompliance;
assert(Math.abs(G.nodeThermal(node,materials,catalog).normal.values.force-expectedForce)<Math.max(1e-9,Math.abs(expectedForce)*1e-10));
assert.equal(G.nodeThermal(node,materials,catalog).hydro.values.force,0);
grade.data=structuredClone(original);grade.data.E={};
assert.equal(G.nodeLimits(node,materials,catalog).minimum.torqueNm,null);
assert.equal(G.nodeLimits(node,materials,catalog).rangePassed,false);
grade.data=structuredClone(original);grade.data.RTp={};
changed=G.nodeLimits(node,materials,catalog);
assert.equal(changed.maximum.torqueNm,null);assert.notEqual(changed.minimum.torqueNm,null);
assert.equal(changed.maximum.omitted.length,0,'Missing steel Rp is never the cast-iron exception');
grade.data=structuredClone(original);

// Fastener expansion and spacer expansion are explicitly excluded. Their
// missing Alpha must not prevent completing otherwise valid settings.
const fastenerOnly={name:'Кріплення без α',grades:[{kp:'',description:'Контроль',data:{...structuredClone(original),Alpha:{}}}]};
materials.push(fastenerOnly);node.fastener.material=C.materialRef(fastenerOnly,fastenerOnly.grades[0]);
assert.deepEqual(X.inspect(node,materials,catalog).errors,[]);
assert.equal(C.sectionStatus(node,materials,catalog).fastener,true,'A zero fastener expansion does not require Alpha');
const spacer={name:'Проставка без α',grades:[{kp:'',description:'Контроль',data:{E:structuredClone(original.E)}}]};
materials.push(spacer);node.extras=[{id:C.id(),name:'Проставка',thickness:'2',area:'100000',material:C.materialRef(spacer,spacer.grades[0])}];
assert.deepEqual(X.inspect(node,materials,catalog).errors,[]);
assert.equal(C.sectionStatus(node,materials,catalog).extras,true,'Compliance-only spacers do not require Alpha');
node.fastener.material=ref;node.extras=[];

let checked=0;
for(const type of ['stud','bolt'])for(const lubricated of [true,false])for(const temperature of ['20','45','90'])for(const pressure of ['0','0.6','1.2']) {
  const trial=structuredClone(node);trial.fastener.type=type;trial.fastener.lubricated=lubricated;
  trial.operating.normal.temperature=temperature;trial.operating.normal.pressure=pressure;
  const limits=G.nodeLimits(trial,materials,catalog);
  if(!limits.rangePassed)continue;
  trial.fastener.torqueNm=String((limits.minimum.roundedTorqueNm+limits.maximum.roundedTorqueNm)/2);
  const forces=G.nodeForces(trial,materials,catalog),strength=G.nodeStrength(trial,materials,catalog),flanges=G.nodeFlanges(trial,materials,catalog,forces);
  for(const mode of ['normal','hydro']) {
    for(const check of Object.values(forces.states[mode].checks))assert.equal(check.passed,true);
    for(const group of ['checks','threads'])for(const check of Object.values(strength.states[mode][group]))if(check.active)assert.equal(check.passed,true);
    for(const side of Object.values(flanges.sides))if(side.mode==='flange')for(const check of Object.values(side.states[mode].checks))if(check.active)assert.equal(check.passed,true);
  }
  checked++;
}
assert(checked>=12,'Interior checks must cover multiple verified ranges');
console.log(`Live material updates, missing properties and ${checked} verified-range midpoint checks passed.`);
