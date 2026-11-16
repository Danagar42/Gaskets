'use strict';
const assert = require('node:assert/strict');
const C = require('../core.js'), P = require('../project.js');
const equipment = C.createEquipment('Насос','Н-101'), node = C.createNode('Кришка');
equipment.nodes.push(node);
node.fastener.material = {name:'Сталь',kp:'590',description:'Виконання'};
Object.assign(node.gasket,{partitionPattern:'tee',partitionWidth:'8,5'});
node.extras.push({id:C.id(),name:'Проставка',thickness:'2',area:'100',material:null});
const original = {version:1,equipment:[equipment],preferences:{recent:['Сталь'],favorites:[]}};
const serialized = P.serialize(original), restored = P.parse('\uFEFF'+serialized);
assert.deepEqual(restored.equipment,original.equipment);
assert.deepEqual(restored.preferences,original.preferences);
const before = JSON.stringify(original);
const combined = P.combine(original,restored,'add');
assert.equal(combined.equipment.length,2);
assert.notEqual(combined.equipment[0].id,combined.equipment[1].id);
assert.notEqual(combined.equipment[0].nodes[0].id,combined.equipment[1].nodes[0].id);
assert.notEqual(combined.equipment[0].nodes[0].extras[0].id,combined.equipment[1].nodes[0].extras[0].id);
assert.equal(JSON.stringify(original),before);
assert.equal(P.combine(original,restored,'replace').equipment.length,1);
assert.deepEqual(restored.folders,[]);
const nested={...original,folders:[
  {id:'pumps',name:'Насоси',parentId:'unit'},
  {id:'station',name:'ХАЕС',parentId:null},
  {id:'unit',name:'4 Блок',parentId:'station'},
],equipment:[{...equipment,folderId:'pumps'}]};
const backup=P.parse(P.serialize(nested));
assert.deepEqual(backup.folders,nested.folders);
const copied=P.combine(nested,backup,'add');
assert(C.validateWorkspace(copied));
assert.deepEqual(copied.equipment[1].nodes[0].fastener,node.fastener);
let parent=copied.equipment[1].folderId;
for (const id of ['pumps','unit','station']) {
  const folder=nested.folders.find(item=>item.id===id);
  const copy=copied.folders.find(item=>item.id===parent);
  assert.notEqual(copy.id,folder.id);
  assert.equal(copy.name,folder.name);
  parent=copy.parentId;
}
assert.equal(parent,null);
for (const parentId of ['pumps','unit','missing']) {
  const invalid=structuredClone(nested);
  invalid.folders[1].parentId=parentId;
  assert.throws(()=>P.normalize(invalid));
}
assert.throws(()=>P.normalize({...nested,equipment:[{...equipment,folderId:'missing'}]}));
for (const text of ['{','{}','null',JSON.stringify({...original,version:2}),JSON.stringify({...original,format:'other'})]) assert.throws(() => P.parse(text));
const duplicate=JSON.parse(serialized); duplicate.equipment.push(duplicate.equipment[0]);
assert.throws(() => P.parse(JSON.stringify(duplicate)));
const injected=JSON.parse(serialized); injected.equipment[0].id='" onclick="alert(1)';
assert.throws(() => P.parse(JSON.stringify(injected)));
const legacy=JSON.parse(serialized);
delete legacy.equipment[0].nodes[0].flanges;
delete legacy.equipment[0].nodes[0].fastener.threadStandardId;
delete legacy.equipment[0].nodes[0].gasket.partitionPattern;
delete legacy.equipment[0].nodes[0].gasket.partitionWidth;
legacy.preferences={favorites:'bad',recent:[12,'Сталь']};
const migrated=P.parse(JSON.stringify(legacy));
assert.equal(migrated.equipment[0].nodes[0].flanges.sideA.mode,'pending');
assert.equal(migrated.equipment[0].nodes[0].fastener.threadStandardId,'gost-24705-2004');
assert.equal(migrated.equipment[0].nodes[0].gasket.partitionPattern,'none');
assert.equal(migrated.equipment[0].nodes[0].gasket.partitionWidth,'');
for (const change of [{partitionPattern:'hex'}, {partitionWidth:[]}]) {
  const damaged = structuredClone(restored);
  Object.assign(damaged.equipment[0].nodes[0].gasket,change);
  assert.throws(() => P.normalize(damaged));
}
assert.deepEqual(migrated.preferences,{recent:['Сталь'],favorites:[]});
assert.equal(JSON.stringify(original),before);
for (const entity of ['equipment','node','extra']) for (const field of ['createdAt','updatedAt']) {
  const damaged=JSON.parse(serialized);
  const target=entity === 'equipment' ? damaged.equipment[0] : entity === 'node' ? damaged.equipment[0].nodes[0] : damaged.equipment[0].nodes[0].extras[0];
  target[field]={toString:null};
  assert.throws(() => P.parse(JSON.stringify(damaged)),`${entity}.${field}: malformed dates must not reach the UI`);
}
let merged=original;
for (let i=0;i<5;i++) merged=P.combine(merged,restored,'add');
assert.equal(merged.equipment.length,6);
assert(C.validateWorkspace(merged),'Repeated import keeps all equipment, node and spacer IDs unique');
const largeEquipment=C.createEquipment('Великий проєкт'),template=C.createNode('Кришка');
largeEquipment.nodes=Array.from({length:4000},(_,index)=>({...template,id:`large-node-${index}`}));
const large={version:1,equipment:[largeEquipment]};
assert(Buffer.byteLength(JSON.stringify(large,null,2))>P.MAX_BYTES,'Fixture must exercise compact backup fallback');
const compactBackup=P.serialize(large);
assert(Buffer.byteLength(compactBackup)<=P.MAX_BYTES);
assert.equal(P.parse(compactBackup).equipment[0].nodes.length,4000,'Every exported backup must pass its own import limit');
const oversized=C.createEquipment('я'.repeat(P.MAX_BYTES/2));
const oversizedJson=JSON.stringify({version:1,equipment:[oversized]});
assert(oversizedJson.length<P.MAX_BYTES && Buffer.byteLength(oversizedJson)>P.MAX_BYTES);
assert.throws(()=>P.parse(oversizedJson),/10 МБ/,'Size limit counts UTF-8 bytes, not characters');
assert.throws(()=>P.serialize({version:1,equipment:[oversized]}),/10 МБ/,'Do not create an unrestorable backup');
console.log('Project JSON: round trip, merge IDs, replacement, legacy migration and invalid input passed.');
