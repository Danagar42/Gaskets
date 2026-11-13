// Запуск: node test_core.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('./core.js');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8') + '\nglobalThis.database = materialsDB;', context);
const db = context.database;
assert.ok(db.length > 0, 'У проєкті має бути база матеріалів');

assert.equal(C.number('0,85'), 0.85);
assert.equal(C.number(''), null);
assert.equal(C.number('—'), null);
assert.equal(C.number('1e3'), null);
assert.equal(C.number('Infinity'), null);

// Межі температур: пропуск у таблиці, точне значення, нижча та вища за діапазон.
const grade = { data: { RTm: {20:400,50:'—',100:350}, RTp:{20:250,50:240,100:'—'} } };
assert.deepEqual(C.propertyAt(grade,'RTm','45'), {value:350,temperature:100,requested:45});
assert.deepEqual(C.propertyAt(grade,'RTp','45'), {value:240,temperature:50,requested:45});
assert.equal(C.propertyAt(grade,'RTm','101'), null);
assert.equal(C.propertyAt(grade,'E','20'), null);
assert.equal(C.propertyAt(grade,'RTm',''), null);
assert.equal(C.propertyAt(grade,'RTm','20').temperature, 20);
assert.equal(C.propertyAt(grade,'RTm','-10').temperature, 20);

// КП не є унікальним: збереження має втримувати конкретний вид заготовки.
let duplicate;
for (const material of db) {
  for (const a of material.grades) {
    const b = material.grades.find(other => other !== a && String(other.kp) === String(a.kp) && other.description !== a.description);
    if (b) { duplicate = {material,a,b}; break; }
  }
  if (duplicate) break;
}
assert.ok(duplicate, 'Перевірка має покривати реальні однакові КП з різними описами');
const reference = C.materialRef(duplicate.material,duplicate.b);
assert.equal(C.resolveMaterial(db,reference).grade, duplicate.b);
assert.equal(C.resolveMaterial(db,{...reference,description:'Відсутнє виконання'}), null);
assert.ok(!Object.hasOwn(reference,'data'), 'Характеристики не копіюються в анкету');
const reordered = [{...duplicate.material,grades:[...duplicate.material.grades].reverse()}];
assert.equal(C.resolveMaterial(reordered,reference).grade,duplicate.b);
const updated = JSON.parse(JSON.stringify(reordered));
updated[0].grades.find(item => item.description === reference.description).data.RTm = {20:999};
assert.equal(C.propertyAt(C.resolveMaterial(updated,reference).grade,'RTm','20').value,999);

const equipment = C.createEquipment('Насос','Н-101');
const node = C.createNode('Кришка — корпус');
equipment.nodes.push(node);
const state = {version:1,equipment:[equipment]};
assert.equal(C.validateWorkspace(JSON.parse(JSON.stringify(state))),true);
assert.equal(C.validateWorkspace({version:9,equipment:[]}),false);
assert.equal(C.validateWorkspace({version:1,equipment:[{...equipment,nodes:[{id:'broken'}]}]}),false);
assert.equal(C.validateWorkspace({version:1,equipment:[equipment,equipment]}),false);

const ref = C.materialRef(db[0],db[0].grades[0]);
node.operating = {normal:{pressure:'0,6',temperature:'45',medium:'Вода'},hydro:{pressure:'0.85',temperature:'20',medium:'Вода'}};
node.gasket = {...node.gasket,mode:'area',thickness:'2',effectiveArea:'1000',pressureArea:'5000'};
node.fastener = {...node.fastener,nominalDiameter:'24',count:'32',material:ref};
node.connection.sideA.material = ref;
node.connection.sideB.material = ref;
node.nut.material = ref;
assert.equal(C.progress(node,db).done,7);
node.washers.placement = 'both';
assert.equal(C.sectionStatus(node,db).washers,false);
node.washers.material = ref;
assert.equal(C.sectionStatus(node,db).washers,true);
node.fastener.count = '2.5';
assert.equal(C.sectionStatus(node,db).fastener,false);
node.fastener.count = '32';
node.gasket.mode = 'ring'; node.gasket.outerDiameter = '100'; node.gasket.innerDiameter = '120';
assert.equal(C.sectionStatus(node,db).gasket,false);
node.gasket.innerDiameter = '80';
assert.equal(C.sectionStatus(node,db).gasket,true);
node.gasket.hasHoles = true;
assert.equal(C.sectionStatus(node,db).gasket,false);
node.gasket.holeDiameter = '26';
assert.equal(C.sectionStatus(node,db).gasket,true);
node.extras.push({id:C.id(),name:'Проставка',thickness:'5',area:'2000',material:ref});
assert.equal(C.sectionStatus(node,db).extras,true);
assert.equal(C.validateWorkspace(JSON.parse(JSON.stringify(state))),true);
node.operating.hydro.temperature = '-300';
assert.equal(C.sectionStatus(node,db).operating,false);
node.operating.hydro.temperature = '900';
assert.equal(C.sectionStatus(node,db).fastener,false);
assert.ok(C.missingProperties(db,ref,node.operating,['RTm','E']).some(item => item.mode === 'hydro' && item.property === 'RTm'));
assert.equal(C.canonical('Cталь 35X'),C.canonical('Сталь 35Х'));
// ГОСТ 11371-78: verify precision classes, executions, missing sizes and offline bundle.
const standardsContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'standards.bundle.js'), 'utf8'), standardsContext);
const catalog = standardsContext.FlangeStandardsDB;
const washers = catalog.washers['gost-11371-78'];
assert.equal(Object.keys(washers.sizes).length, 27);
assert.equal(washers.sizes['2.5'].outerDiameterMm, 6, 'Use normative value, not typo in screenshot');
assert.equal(washers.sizes['33'].innerDiameterByClassMm.C, null);
assert.equal(washers.sizes['39'].innerDiameterByClassMm.C, null);
const washerA = C.washerDimensions(catalog,'gost-11371-78','24','A','1');
assert.equal(washerA.innerDiameterMm,25);
assert.equal(washerA.outerDiameterMm,44);
assert.equal(washerA.thicknessMm,4);
assert.equal(C.washerDimensions(catalog,'gost-11371-78','24','C','1').innerDiameterMm,26);
assert.equal(C.washerDimensions(catalog,'gost-11371-78','33','C','1'),null);
assert.equal(C.washerDimensions(catalog,'gost-11371-78','24','C','2'),null);
assert.equal(C.washerDimensions(catalog,'gost-11371-78','4','A','2'),null);
assert.equal(C.washerDimensions(catalog,'gost-11371-78','26','A','1'),null);
node.operating.hydro.temperature = '20';
node.washers.placement = 'both';
node.washers.standardId = 'gost-11371-78';
node.washers.accuracyClass = 'A';
node.washers.execution = '1';
node.fastener.nominalDiameter = '24';
assert.equal(C.sectionStatus(node,db,catalog).washers,true);
node.washers.accuracyClass = 'C'; node.fastener.nominalDiameter = '33';
assert.equal(C.sectionStatus(node,db,catalog).washers,false);

// ГОСТ 5915-70: 22 hex nut nominal heights, with non-preferred sizes preserved.
const nuts = catalog.nuts['gost-5915-70'];
assert.equal(Object.keys(nuts.sizes).length, 22);
assert.equal(nuts.sizes['5'].heightMm, 4.7);
assert.equal(nuts.sizes['24'].heightMm, 21.5);
assert.equal(nuts.sizes['48'].heightMm, 38);
assert.deepEqual(Array.from(nuts.nonPreferredDiametersMm), [3.5,14,18,22,27]);
const nut24 = C.nutDimensions(catalog, 'gost-5915-70', '24');
assert.equal(nut24.heightMm, 21.5);
assert.equal(nut24.nonPreferred, false);
assert.equal(C.nutDimensions(catalog, 'gost-5915-70', '14').nonPreferred, true);
assert.equal(C.nutDimensions(catalog, 'gost-5915-70', '26'), null);
assert.equal(C.nutDimensions(catalog, 'gost-5915-70', ''), null);
assert.equal(Object.hasOwn(nut24, 'threadEngagementMm'), false, 'Nut height is not thread engagement length');
node.nut.standardId = 'gost-5915-70';
node.fastener.nominalDiameter = '24';
assert.equal(C.sectionStatus(node, db, catalog).nut, true);
node.fastener.nominalDiameter = '26';
assert.equal(C.sectionStatus(node, db, catalog).nut, false);
assert.equal(C.validateWorkspace(JSON.parse(JSON.stringify(state))), true);

// ГОСТ 24705-2004 / 8724-2002: thread pitch lookup through M60.
const threads = catalog.threads['gost-24705-2004'];
assert.equal(Object.keys(threads.sizes).length,36);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','8').pitchMm,1.25);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','24').pitchMm,3);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','24','2').pitchMm,2);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','30','3').nonPreferred,true);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','60').pitchMm,5.5);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','50'),null,'M50 has no coarse pitch');
assert.equal(C.threadPitch(catalog,'gost-24705-2004','50','3').pitchMm,3);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','55'),null);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','58'),null);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','24','0.5'),null);
assert.equal(C.threadPitch(catalog,'gost-24705-2004','61'),null);
node.fastener.nominalDiameter = '24';
node.fastener.threadStandardId = 'gost-24705-2004';
node.fastener.pitch = '';
assert.equal(C.sectionStatus(node,db,catalog).fastener,true);
node.fastener.pitch = '0.5';
assert.equal(C.sectionStatus(node,db,catalog).fastener,false);
node.fastener.pitch = '2';
assert.equal(C.sectionStatus(node,db,catalog).fastener,true);
node.fastener.nominalDiameter = '50';
node.fastener.pitch = '';
assert.equal(C.sectionStatus(node,db,catalog).fastener,false);
node.fastener.pitch = '3';
assert.equal(C.sectionStatus(node,db,catalog).fastener,true);
assert.equal(C.validateWorkspace(JSON.parse(JSON.stringify(state))),true);
console.log('OK: матеріали, анкети, шайби, гайки та кроки метричної різьби до М60.');
