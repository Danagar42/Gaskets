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
console.log('OK: температури, ідентичність матеріалів, оновлення бази, збереження та перевірка анкет.');
