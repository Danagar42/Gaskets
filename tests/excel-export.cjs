'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../core.js'),G=require('../calculations.js'),X=require('../excel-export.js'),P=require('../project.js');
const fixture=require('./fixtures/workbook-comparison.json');
const {inflateRawSync,crc32}=require('node:zlib');
const path=require('node:path');
const materials=vm.runInNewContext(fs.readFileSync('data.js','utf8')+';materialsDB');
const context=vm.createContext({}); vm.runInContext(fs.readFileSync('standards.bundle.js','utf8'),context);
const catalog=context.FlangeStandardsDB;
require('../excel-template.bundle.js');
// Only the verification copy receives these user-approved Excel properties.
// The production database and exporter never fill missing material values.
const grade=C.resolveMaterial(materials,fixture.nodes[0].application.node.connection.sideB.material).grade;
grade.data.E={'20':200,'50':197}; grade.data.Alpha={'20':11.5,'50':11.5};
const nodes=fixture.nodes.map(item => structuredClone(item.application.node));
function variant(name,update) {const node=structuredClone(nodes[0]);node.id=C.id();node.name=name;update(node);nodes.push(node);}
variant('Дві шайби + 2 проставки',node => {
  node.washers.placement='both';
  node.extras=[2,3].map((height,i) => ({id:C.id(),name:'Проставка '+(i+1),thickness:String(height),area:String(100000+i*10000),material:node.fastener.material}));
});
variant('Ручні площі',node => {
  const values=G.gasketGeometry(node.gasket,node.fastener.count).values;
  node.gasket.mode='area';node.gasket.effectiveArea=String(values.effectiveArea);node.gasket.pressureArea=String(values.pressureArea);
  node.flanges.sideA.gasketDiameter=String(values.meanDiameter);
});
variant('Болт без шайб',node => {node.fastener.type='bolt';node.washers.placement='none';});
variant('Нульовий тиск ГВ',node => {node.operating.hydro.pressure='0';});
const torques=nodes.map(node => G.nodeLimits(node,materials,catalog).maximum.roundedTorqueNm);
nodes.forEach((node,index) => {node.fastener.torqueNm=String(torques[index]);});
for (const node of nodes) assert.deepEqual(X.inspect(node,materials,catalog).errors,[],node.name);
assert(X.inspect(C.createNode('Порожній'),materials,catalog).errors.length);
assert.equal(new Set(X.safeNames([{name:'A/B'},{name:'A:B'},{name:'Проставки'},{name:"'"}])).size,4);
for (const name of ["Кришка' ","' Кришка ' ",'А'.repeat(30)+"'закінчення"]) {
  const [safe]=X.safeNames([{name}]);
  assert(safe.length <= 31 && !safe.startsWith("'") && !safe.endsWith("'"),`Invalid Excel sheet name: ${safe}`);
}
const v=X.inputs(nodes[4],{name:'Тест',designation:''},materials,catalog,torques[4],[]);
assert(v.C38.formula.includes('C69+C108'));
assert(v.I32.formula.includes('+I12'));
assert.equal(v.J32.formula,'0');assert.equal(v.C49,0);assert.equal(v.D49,0);
assert(v.C27.formula.startsWith('IF(C5<=50,0.21'));
assert.equal(v.C98.formula,'C99');
const defaultAreas=structuredClone(nodes[0]);defaultAreas.connection.sideA.area='';
assert.equal(X.inputs(defaultAreas,{name:'Тест'},materials,catalog,100,[]).C89.formula,'PI()*(C16*F22-C40*F23^2/4)');
assert(X.inputs(nodes[2],{name:'Тест'},materials,catalog,100,[]).J8.formula.endsWith(',0)'));
const edited=structuredClone(nodes[0]);edited.fastener.count='33';
const editedLimits=G.nodeLimits(edited,materials,catalog);
assert.equal(editedLimits.minimum.roundedTorqueNm,121);
assert.equal(editedLimits.maximum.roundedTorqueNm,377);
let matrixCases=0;
for (const type of ['stud','bolt']) for (const placement of ['none','a','b','both']) for (const mode of ['ring','area']) for (const temperature of ['20','45','90']) {
  const node=structuredClone(nodes[0]);
  for (const part of [node.connection.sideA,node.connection.sideB]) part.material=node.fastener.material;
  node.fastener.type=type;node.washers.placement=placement;node.operating.normal.temperature=temperature;
  if (mode === 'area') {
    const area=G.nodeGeometry(node,catalog).gasket.values;
    Object.assign(node.gasket,{mode,effectiveArea:String(area.effectiveArea),pressureArea:String(area.pressureArea)});
    node.flanges.sideA.gasketDiameter=String(area.meanDiameter);
  }
  const before=JSON.stringify(node), report=X.inspect(node,materials,catalog);
  assert.deepEqual(report.errors,[],`${type}/${placement}/${mode}/${temperature}`);
  node.fastener.torqueNm='1';
  const other=G.nodeLimits(node,materials,catalog);
  assert.equal(report.limits.minimum.torqueNm,other.minimum.torqueNm);
  assert.equal(report.limits.maximum.torqueNm,other.maximum.torqueNm);
  node.fastener.torqueNm=JSON.parse(before).fastener.torqueNm;
  assert.equal(JSON.stringify(node),before);
  matrixCases++;
}
for (const [field,value] of [['fastener.count','0'],['fastener.count','1.5'],['fastener.pitch','99'],['fastener.axialHoleDiameter','24'],['gasket.thickness','0'],['gasket.innerDiameter','1400'],['operating.normal.pressure','-1'],['operating.hydro.pressure','-1'],['operating.normal.temperature','401'],['fastener.material',null],['nut.material',null],['connection.sideA.material',null]]) {
  const node=structuredClone(nodes[0]);C.set(node,field,value);
  assert(X.inspect(node,materials,catalog).errors.length,`Invalid ${field}=${value} must block export`);
}
const commaNode=structuredClone(nodes[0]);
function commaNumbers(object) {
  for (const [key,value] of Object.entries(object)) {
    if (value && typeof value === 'object') commaNumbers(value);
    else if (typeof value === 'string' && /^-?\d+\.\d+$/.test(value)) object[key]=value.replace('.',',');
  }
}
commaNumbers(commaNode);
const commaLimits=G.nodeLimits(commaNode,materials,catalog),dotLimits=G.nodeLimits(nodes[0],materials,catalog);
assert.equal(commaLimits.minimum.torqueNm,dotLimits.minimum.torqueNm);
assert.equal(commaLimits.maximum.torqueNm,dotLimits.maximum.torqueNm);
const noWasher=structuredClone(nodes[0]);noWasher.washers.placement='none';noWasher.washers.material=null;noWasher.washers.standardId='missing';
assert.deepEqual(X.inspect(noWasher,materials,catalog).errors,[],'An absent washer does not require a catalog or a material');
noWasher.washers.placement='b';assert(X.inspect(noWasher,materials,catalog).errors.length,'An active washer must have its dimensions and material');
const capNut=structuredClone(nodes[0]);Object.assign(capNut.nut,{standardId:'gost-9064-75',typeId:'B',threadedHeight:''});
assert(X.inspect(capNut,materials,catalog).errors.length,'A cap nut cannot use total height instead of missing thread height');
capNut.nut.threadedHeight=String(C.nutDimensions(catalog,capNut.nut.standardId,'24','B').heightMm+1);
assert(X.inspect(capNut,materials,catalog).errors.length,'Thread engagement cannot exceed the cap nut total height');
function packageParts(bytes) {
  const buffer=Buffer.from(bytes), parts=new Map();let offset=0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method=buffer.readUInt16LE(offset+8), expectedCrc=buffer.readUInt32LE(offset+14);
    const compressed=buffer.readUInt32LE(offset+18), size=buffer.readUInt32LE(offset+22);
    const nameLength=buffer.readUInt16LE(offset+26), extraLength=buffer.readUInt16LE(offset+28);
    const name=buffer.toString('utf8',offset+30,offset+30+nameLength), start=offset+30+nameLength+extraLength;
    const payload=buffer.subarray(start,start+compressed), data=method===8 ? inflateRawSync(payload) : payload;
    assert.equal(data.length,size,name);assert.equal(crc32(data),expectedCrc,name);
    assert(!parts.has(name),`Duplicate ZIP entry ${name}`);parts.set(name,data);
    offset=start+compressed;
  }
  assert.equal(buffer.readUInt32LE(offset),0x02014b50,'Central ZIP directory is present');
  for (const [name,data] of parts) {
    if (!name.endsWith('.rels')) continue;
    const owner=path.posix.join(path.posix.dirname(path.posix.dirname(name)),path.posix.basename(name,'.rels'));
    for (const match of data.toString('utf8').matchAll(/<Relationship\b[^>]*\/>/g)) {
      if (/TargetMode="External"/.test(match[0])) continue;
      const target=match[0].match(/Target="([^"]+)"/)[1];
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(owner),target));
      assert(parts.has(resolved),`${name}: missing relationship target ${resolved}`);
    }
  }
  for (const [name,data] of parts) if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
    const text=data.toString('utf8'), rows=[...text.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map(match=>+match[1]);
    assert(rows.every((row,index)=>!index || row>rows[index-1]),`${name}: rows are ordered and unique`);
    const cells=[...text.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"/g)].map(match=>match[1]);
    assert.equal(new Set(cells).size,cells.length,`${name}: duplicate cells`);
    assert(!/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/.test(text),`${name}: invalid XML characters`);
    assert(!/<v>(?:NaN|Infinity|-Infinity)<\/v>/.test(text));
  }
  return parts;
}
(async () => {
  const output=await X.create({equipment:{name:'Перевірка експорту',designation:'ТЕСТ'},nodes,materials,catalog,torques});
  assert.equal(new DataView(output.buffer).getUint32(0,true),0x04034b50);
  packageParts(output);
  const awkwardNames=["Кришка' ",'А'.repeat(30)+"'кінець",'Вузол','вузол','Проставки','="Тест" & <вузол>\u000b'];
  const namedNodes=awkwardNames.map(name=>({...structuredClone(nodes[0]),name}));
  const special=packageParts(await X.create({equipment:{name:'Тест\u0000 & <апарат>'},nodes:namedNodes,materials,catalog,torques:awkwardNames.map(()=>100)}));
  assert.equal(new Set(X.safeNames(namedNodes).map(name=>name.toLowerCase())).size,awkwardNames.length);
  assert(special.get('xl/worksheets/sheet1.xml').toString('utf8').includes('Тест &amp; &lt;апарат&gt;'));
  await assert.rejects(X.create({equipment:{name:'Тест'},nodes:[C.createNode('Порожній')],materials,catalog,torques:[1]}));
  await assert.rejects(X.create({equipment:{name:'Тест'},nodes,materials,catalog,torques:nodes.map(()=>-1)}));
  if (process.argv.includes('--write')) {
    const dir='inspection_scratch/verification';fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(dir+'/export-test.xlsx',output);
    fs.writeFileSync(dir+'/export-expected.json',JSON.stringify({nodes,torques,expected:nodes.map(node => ({
      geometry:G.nodeGeometry(node,catalog),compliance:G.nodeCompliance(node,materials,catalog),thermal:G.nodeThermal(node,materials,catalog),
      forces:G.nodeForces({...node,fastener:{...node.fastener,torqueNm:String(torques[nodes.indexOf(node)])}},materials,catalog),
      strength:G.nodeStrength({...node,fastener:{...node.fastener,torqueNm:String(torques[nodes.indexOf(node)])}},materials,catalog),limits:G.nodeLimits(node,materials,catalog)
    }))},null,2));
    const equipment=C.createEquipment('Перевірка імпорту — тимчасовий');equipment.nodes=nodes;
    // The JSON UI fixture uses available materials only; missing E/α 25Л is
    // deliberately visible. A complete СЧ25 body node can be exported in the UI.
    fs.writeFileSync(dir+'/project-test.json',P.serialize({version:1,equipment:[equipment],preferences:{}}));
    console.log('Saved disposable native-Excel verification workbook and JSON fixture.');
  }
  console.log(`Excel export: ${nodes.length} nodes, constructor variants and incomplete-input gate passed (${output.length} bytes).`);
  console.log(`Stress checks: ${matrixCases} constructor combinations, 12 invalid inputs, ZIP CRCs, relationships, rows and special names passed.`);
})().catch(error => {console.error(error);process.exitCode=1;});
