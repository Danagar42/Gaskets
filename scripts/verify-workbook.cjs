'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const checkOnly = process.argv.includes('--check');
const C = require('../core.js');
const G = require('../calculations.js');
const fixture = require('../tests/fixtures/workbook-verification.json');
const root = path.join(__dirname,'..');
const materialSource = fs.readFileSync(path.join(root,'data.js'),'utf8');
const materials = vm.runInNewContext(materialSource+';materialsDB');
const catalogContext = vm.createContext({});
const catalogSource = fs.readFileSync(path.join(root,'standards.bundle.js'),'utf8');
vm.runInContext(catalogSource,catalogContext);
const catalog = catalogContext.FlangeStandardsDB;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const nodes = [];
for (const [name,cells] of Object.entries(fixture.sheets)) {
  const value = address => cells[address]?.value;
  const num = address => number(value(address));
  const comparisons = [], differences = [], notes = [];
  function compare(address,actual,block) {
    const expected = num(address);
    if (expected === null) return;
    const tolerance = Math.max(1e-12,Math.abs(expected)*1e-10);
    const pass = actual !== null && Number.isFinite(actual) && Math.abs(actual-expected) <= tolerance;
    const item = {cell:address,block,expected,actual,pass};
    comparisons.push(item); if (!pass) differences.push(item);
  }
  const n = num('C40'), d = num('C34');
  const gasket = {mode:'ring',outerDiameter:value('F20'),innerDiameter:value('F21'),hasHoles:num('F23') > 0,holeDiameter:value('F23'),thickness:value('C15')};
  const geo = G.gasketGeometry(gasket,n).values;
  for (const [key,address] of [['width','C16'],['holeWidth','C17'],['effectiveWidth','C18'],['effectiveHoleWidth','C19'],['meanDiameter','F22'],['effectiveArea','C22'],['pressureArea','C23']]) compare(address,geo[key],'geometry');
  const thread = G.threadGeometry(d,num('C37'),num('C36')).values;
  for (const [key,address] of [['rootDiameter','C33'],['meanDiameter','C35'],['smoothArea','C47'],['threadArea','C48']]) compare(address,thread[key],'geometry');
  const stud = num('C98') !== null;
  const parts = [{name:'A',height:num('C87'),threaded:false},{name:'B',height:num('C99'),threaded:stud},{name:'Прокладка',height:num('C15'),threaded:false},{name:'Гайка',height:num('C80'),threaded:true}];
  if (num('C60') > 0) parts.push({name:'Шайба А',height:num('C60'),threaded:false});
  if (num('C69') > 0) parts.push({name:'Шайба Б',height:num('C69'),threaded:false});
  const lengths = G.packageLengths(parts).values;
  compare('C38',lengths.smoothLength,'lengths'); compare('C39',lengths.threadedLength,'lengths');
  const normalTemperature = num('C5');
  const oldAlpha = 0.2+1.5*(normalTemperature-20)/580;
  compare('C27',oldAlpha,'legacy-alpha');
  const expansion = (height,alpha) => G.linearExpansion(height,alpha,normalTemperature,20).value;
  const gasketExpansion = expansion(num('C15'),oldAlpha);
  compare('C28',gasketExpansion,'thermal');
  const coverExpansion = expansion(num('C87'),num('C86'));
  compare('C88',coverExpansion,'thermal');
  const bodyExpansion = expansion(num('C99'),num('C95'));
  compare('C100',bodyExpansion,'thermal');
  const washerAExpansion = num('C60') > 0 ? expansion(num('C60'),num('C65')) : 0;
  const washerBExpansion = num('C69') > 0 ? expansion(num('C69'),num('C74')) : 0;
  compare('C66',washerAExpansion,'thermal'); compare('C75',washerBExpansion,'thermal');
  const pack = gasketExpansion+coverExpansion+washerAExpansion+washerBExpansion+(stud ? 0 : bodyExpansion);
  compare('I23',pack,'thermal');
  const states = {}, strengths = {}, flanges = {}, lowerCandidates = [], flangeBounds = [];
  for (const [mode,col,inputs,out] of [['normal','I','C','N'],['hydro','J','D','O']]) {
    const modulus = row => num(inputs+row);
    const washer = (row,eRow) => ({height:num('C'+row),area:3.1415*num('C'+(row+1))*num('C'+(row+2)),modulusMPa:modulus(eRow)});
    const compliance = G.compliance({count:n,
      gasket:{height:num('C15'),area:geo.effectiveArea,modulusMPa:modulus(24)},
      sideA:{height:num('C87'),area:num('C89'),modulusMPa:modulus(85)},
      sideB:{height:num('C99'),area:num('C101'),modulusMPa:modulus(94)},
      washerA:num('C60') > 0 ? washer(60,64) : null,washerB:num('C69') > 0 ? washer(69,73) : null,
      fastener:{...thread,...lengths,nominalDiameter:d,pitch:num('C37'),modulusMPa:modulus(45)},extras:[]
    });
    for (const [key,row] of [['gasket',4],['washerA',8],['washerB',9],['sideB',10],['sideA',11],['extras',12],['threadJoint1',13],['threadJoint2',14],['smoothPart',15],['threadedPart',16],['fastener',17],['loadFactor',18]]) compare(col+row,compliance.values[key],'compliance');
    for (const row of [5,6,7]) compare(col+row,0,'inactive-components');
    const thermal = mode === 'normal' ? G.thermalForce(pack,0,compliance.values.totalCompliance).value : 0;
    compare(col+'22',0,'thermal'); compare(col+'32',thermal,'thermal');
    const forces = G.forces({gasketArea:geo.effectiveArea,pressureArea:geo.pressureArea,pressure:modulus(4),mediumCoefficient:modulus(21),seatingPressure:modulus(20),minimumPressure:modulus(25),maximumPressure:num('C26'),count:n,diameter:d,friction:num('C41'),torqueNm:num('C6')/1000,loadFactor:compliance.values.loadFactor,thermalForce:thermal});
    for (const [key,row] of [['initialSingle',27],['initialTotal',28],['sealing',29],['hydrostatic',30],['seating',31],['thermal',32],['fastener',33],['gasket',34],['sealingRequired',43],['contactPressure',44]]) compare(col+row,forces.values[key],'forces');
    const height = num(inputs+'80') ?? num('C80');
    const strength = G.strength({mode,...thread,...forces.values,diameter:d,axialHoleDiameter:num('C36'),count:n,loadFactor:compliance.values.loadFactor,thermalForce:thermal,torsionFactor:num('C42'),yieldMPa:modulus(51),nutYieldMPa:modulus(82),nutHeight:height,bodyThreadActive:stud,bodyHeight:num('C98'),bodyYieldMPa:modulus(103)});
    compare('C32',strength.values.torsionMoment,'strength');
    for (const [key,row] of [['axial',4],['allowable',5],['thermalAxial',7],['thermalAllowable',8],['equivalent',10],['equivalentAllowable',11],['torsion',13],['torsionAllowable',14]]) compare(out+row,strength.values[key],'strength');
    for (const [key,row] of [['axial',6],['thermalAxial',9],['equivalent',12],['torsion',15]]) compare(out+row,strength.checks[key].margin,'strength');
    for (const [key,row] of [['fastenerNut',23],['fastenerBody',30],['nut',37],['body',44]]) {
      compare(out+row,strength.threads[key].actual,'thread');compare(out+(row+1),strength.threads[key].allowable,'thread');compare(out+(row+2),strength.threads[key].margin,'thread');
    }
    states[mode] = {allowable:strength.values.allowable,threads:strength.threads,loadFactor:compliance.values.loadFactor,hydrostatic:forces.values.hydrostatic,thermalForce:thermal};
    strengths[mode] = strength;
    flanges[mode] = {};
    for (const [side,c,r1,r2,rName] of [['sideA','W',90,91,84],['sideB','R',102,103,93]]) {
      if (num(c+'4') === null) continue;
      const castIron = /сч/i.test(String(value('C'+rName)));
      const config = Object.fromEntries(['innerDiameter','boltCircle','outerDiameter','gasketDiameter','holeDiameter','height','coneHeight','wallCylinder','wallCone'].map((key,index)=>[key,num(c+(index+4))]));
      const flange = G.flange({...config,mode,castIron,castIronC:side === 'sideB',ultimateMPa:modulus(r1),yieldMPa:modulus(r2),pressure:modulus(4),hydrostatic:forces.values.hydrostatic,fastenerForce:forces.values.fastener,pressureLoad:compliance.values.loadFactor*forces.values.hydrostatic,thermalForce:thermal});
      const targetCol = mode === 'normal' ? c : c === 'W' ? 'X' : 'S';
      for (const [key,row] of [['s0',18],['allowable',19],['WA',23],['WB',24],['moment',27],...(mode === 'normal' ? [['e1',13],['e2',14],['e3',15],['y',22],['WC',25]] : [])]) compare(targetCol+row,flange.values[key],'flanges');
      for (const [key,row] of [['pressureA',31],['bendingA',34],['pressureB',38],['bendingB',41],['bendingC',45]]) {
        compare(targetCol+row,flange.checks[key].actual,'flanges');compare(targetCol+(row+1),flange.checks[key].allowable,'flanges');compare(targetCol+(row+2),flange.checks[key].margin,'flanges');
      }
      for (const bound of flange.bounds) flangeBounds.push({...bound,side,mode,cell:out+((side === 'sideA' ? 80 : 76)+['A','B','C'].indexOf(bound.section))});
      flanges[mode][side] = flange;
    }
    lowerCandidates.push({cell:out+'53',force:forces.values.sealingRequired},{cell:out+'55',force:forces.values.pressureRequired});
    if (mode === 'normal') lowerCandidates.push({cell:'N52',force:forces.values.seating});
  }
  for (const item of lowerCandidates) compare(item.cell,item.force,'minimum');
  const minForce = Math.max(...lowerCandidates.map(item=>item.force));
  const minTorque = minForce*num('C41')*d/(n*1000);
  compare('N57',minForce,'minimum'); compare('N58',minTorque,'minimum'); compare('P88',Math.ceil(minTorque),'minimum');
  const upper = G.maximum({states,smoothArea:thread.smoothArea,count:n,diameter:d,friction:num('C41'),flangeCandidates:flangeBounds,flangesConfigured:true});
  for (const candidate of upper.candidates) compare(candidate.cell,candidate.force,'maximum');
  const ignored = upper.candidates.filter(item=>item.active && item.force === null && num(item.cell) === null).map(item=>item.cell);
  // Compatibility audit only: Excel MIN ignores text errors. Production G.maximum blocks them.
  const excelNumericMaximum = Math.min(...upper.candidates.filter(item=>item.active && typeof item.force === 'number').map(item=>item.force));
  const maxTorque = excelNumericMaximum*num('C41')*d/(n*1000);
  compare('N83',excelNumericMaximum,'maximum');compare('N84',maxTorque,'maximum');compare('P89',Math.floor(maxTorque),'maximum');
  if (ignored.length) notes.push(`Excel MIN ignores active unknown criteria: ${ignored.join(', ')}; the untyped strict helper returns null; the cast-iron application profile uses the user-approved explicit omission.`);
  const node = C.createNode(name,stud ? 'body-cover' : 'flange-flange');
  node.operating = {normal:{pressure:String(num('C4')),temperature:String(num('C5')),medium:value('C7')},hydro:{pressure:String(num('D4')),temperature:String(num('D5')),medium:value('D7')}};
  node.gasket = {...node.gasket,...Object.fromEntries(Object.entries(gasket).map(([key,v])=>[key,typeof v === 'number' ? String(v) : v]))};
  Object.assign(node.fastener,{type:stud ? 'stud' : 'bolt',nominalDiameter:String(d),count:String(n),pitch:String(num('C37')),axialHoleDiameter:String(num('C36')),torqueNm:String(num('C6')/1000),lubricated:num('C41') === 0.26});
  const verificationMaterials = JSON.parse(JSON.stringify(materials));
  const findMaterial = (pattern,kp,index = 0) => {
    const material = verificationMaterials.find(item=>pattern.test(C.canonical(item.name)));
    assert.ok(material,`Missing control material ${pattern}`);
    const grades = material.grades.filter(grade=>kp === undefined || String(grade.kp) === kp);
    assert.ok(grades[index],`Missing control grade ${material.name} ${kp}`);
    return {material,grade:grades[index],ref:C.materialRef(material,grades[index])};
  };
  const steel35 = findMaterial(/35х$/u,'590');
  const stainless = findMaterial(/08х18н10т/u,'196');
  const casting = findMaterial(/25л$/u,'235');
  const iron = findMaterial(/сч25$/u);
  // User authorized source E/Alpha for this verification only; never write data.js.
  const virtualProperties = [];
  if (!C.propertyAt(casting.grade,'E',45)) { casting.grade.data.E = {20:200,50:197}; virtualProperties.push('25Л: E20=200, E50=197 ГПа із Excel'); }
  if (!C.propertyAt(casting.grade,'Alpha',45)) { casting.grade.data.Alpha = {20:11.5,50:11.5}; virtualProperties.push('25Л: α20/50=11,5 ×10⁻⁶/К із Excel'); }
  const selectPart = label => /сч/i.test(label) ? iron : /25л/i.test(label) ? casting : /08х18н10т/i.test(label) ? stainless : steel35;
  const a = selectPart(String(value('C84'))), b = selectPart(String(value('C93')));
  if (a !== casting && b !== casting) virtualProperties.length = 0;
  node.fastener.material = steel35.ref; node.nut.material = steel35.ref;
  Object.assign(node.connection.sideA,{material:a.ref,height:String(num('C87')),area:String(num('C89'))});
  Object.assign(node.connection.sideB,{material:b.ref,height:String(num('C99')),area:String(num('C101'))});
  node.washers.placement = num('C60') > 0 ? 'a' : 'none';
  if (node.washers.placement !== 'none') node.washers.material = steel35.ref;
  for (const [side,col] of [['sideA','W'],['sideB','R']]) {
    if (num(col+'4') === null) node.flanges[side].mode = 'none';
    else {
      node.flanges[side].mode = 'flange';
      for (const [key,row] of [['innerDiameter',4],['boltCircle',5],['outerDiameter',6],['holeDiameter',8],['height',9],['coneHeight',10],['wallCylinder',11],['wallCone',12]]) node.flanges[side][key] = String(num(col+row));
    }
  }
  const live = G.nodeLimits(node,verificationMaterials,catalog);
  const liveCompliance = G.nodeCompliance(node,verificationMaterials,catalog);
  const liveThermal = G.nodeThermal(node,verificationMaterials,catalog);
  const parameters = [];
  function changed(parameter,source,current) { if (source !== current) parameters.push({parameter,source,current}); }
  for (const [mode,col] of [['normal','C'],['hydro','D']]) {
    const modeName = mode === 'normal' ? 'НУЕ' : 'ГВ';
    changed(`E прокладки ${modeName}, МПа`,num(col+'24'),catalog.gaskets[node.gasket.referenceId].elasticModulusMPa);
    changed(`qmin ${modeName}, МПа`,num(col+'25'),catalog.gaskets[node.gasket.referenceId].minimumPressureMPa);
    const nut = C.nutDimensions(catalog,node.nut.standardId,d,node.nut.typeId);
    changed(`Різьбова висота гайки ${modeName}, мм`,num(col+'80'),nut.heightMm);
    for (const [selected,row,label] of [[steel35,82,'гайки'],[a,91,'деталі А'],[b,103,'деталі Б']]) changed(`Rp ${label} (${selected.material.name}), ${modeName}, МПа`,num(col+row),C.propertyAt(selected.grade,'RTp',num(col+'5'))?.value ?? null);
  }
  changed('α прокладки НУЕ, ×10⁻⁶/К',num('C27'),C.gasketExpansionAt(catalog,node.gasket.referenceId,num('C5')).value);
  if (node.washers.placement !== 'none') {
    const washer = C.washerDimensions(catalog,node.washers.standardId,d,node.washers.accuracyClass,node.washers.execution);
    changed('Середній діаметр шайби, мм',num('C61'),(washer.innerDiameterMm+washer.outerDiameterMm)/2);
    changed('Ширина кільцевого перерізу шайби, мм',num('C62'),(washer.outerDiameterMm-washer.innerDiameterMm)/2);
  }
  nodes.push({name,comparisons,failures:differences,ignoredSourceCriteria:ignored,sourceMinimum:Math.ceil(minTorque),sourceMaximum:Math.floor(maxTorque),strictPureMaximum:upper.roundedTorqueNm,notes,
    application:{node,virtualProperties,parameterDifferences:parameters,minimum:live.minimum.roundedTorqueNm,maximum:live.maximum.roundedTorqueNm,complete:live.complete,rangePassed:live.rangePassed,
      governingMinimum:live.minimum.governing,governingMaximum:live.maximum.governing,
      pendingUpper:live.maximum.candidates.filter(item=>item.active && item.force === null).map(item=>item.cell),omittedUpper:live.maximum.omitted.map(item=>item.cell),
      verification:live.verification,chi:{normal:liveCompliance.states.normal.values.loadFactor,hydro:liveCompliance.states.hydro.values.loadFactor},thermalNUE:liveThermal.normal.values.force}});
}
const hash = text => crypto.createHash('sha256').update(text,'utf8').digest('hex');
const output = {source:fixture.source,recalculation:fixture.recalculation,dataSha256:hash(materialSource),catalogSha256:hash(catalogSource),nodes,total:nodes.reduce((sum,node)=>sum+node.comparisons.length,0),failures:nodes.flatMap(node=>node.failures.map(item=>({sheet:node.name,...item})))};
if (!checkOnly) fs.writeFileSync(path.join(root,'tests/fixtures/workbook-comparison.json'),JSON.stringify(output,null,2)+'\n');
const md = `# Наскрізна звірка з Excel — 14.11.2026

## Результат

Виконано ${output.total} числові зіставлення перенесених функцій із заново перерахованою книгою Microsoft Excel. Розбіжностей арифметики: **${output.failures.length}**. Ланцюг включає геометрію, довжини, податливості, χ, температурні зусилля, зусилля, міцність кріплення/різьби/фланців і межі моменту. Це кількість зіставлень, а не унікальних формул; деякі контрольні величини перевіряються в кількох режимах.

Окремо перевірено конструктор із поточними матеріалами, нормативними розмірами та погодженими температурними правилами. Для 25Л E/α підставлено **лише в контрольний набір** із дозволу користувача: 200/197 ГПа при 20/50 °C, α=11,5×10⁻⁶/К. Файл data.js не змінювався цим процесом.

| Вузол | Числові зіставлення | Розбіжності | Excel після перерахунку, Н·м | Застосунок, Н·м | Контроль застосунку |
| --- | ---: | ---: | --- | --- | --- |
${nodes.map(n=>`| ${n.name} | ${n.comparisons.length} | ${n.failures.length} | ${n.sourceMinimum}–${n.sourceMaximum} | ${n.application.minimum}–${n.application.maximum ?? 'не визначено'} | ${n.application.rangePassed ? 'Усі активні перевірки округлених меж виконані' : n.application.omittedUpper.length ? 'За Excel: пропущена внутрішня різьба чавунного корпусу без Rp' : 'Неповні або невиконані умови'} |`).join('\n')}

**Вузли №1–3:** округлені моменти збігаються, обидві межі проходять усі активні перевірки застосунку. Проміжні значення з новими характеристиками/каталогами можуть відрізнятися — нижче наведено змінені входи.

**Вузол №4 — рішення користувача «зроби як в Excel»:** за повної відсутності Rp чавунного корпусу обмеження N74/O74 пропускаються при визначенні максимуму, як це робить Excel із текстом «-». Застосунок показує 112–248 Н·м за поточними параметрами каталогів, а пропущені перевірки позначає явно. Вони не зараховуються як виконані; повна міцність різьби корпусу не підтверджена. Інші невідомі входи, відсутній Rp сталі або Rp, недоступний лише для заданої температури, не пропускаються.

## Виправлення входу вузла №4

Користувач підтвердив товщину прокладки **1 мм** замість порожнього C15. Виправлено тільки контрольну копію. Перерахунок змінив P88/P89 з 121–360 на **110–334 Н·м**. Для контролю однакової арифметики використано решту чисел саме з цієї копії.

Книга містить інші відмінності від поточного каталогу: Eпр ГВ=1000 МПа проти 100 МПа в застосунку; qmin=0,96/1,36 МПа (m·p) проти 3,5 МПа за каталогом; D80=21,5 мм для гайки M20 проти 18 мм за ГОСТ. Ці джерельні значення не переносилися в загальний каталог. Тому нижня межа застосунку 112 Н·м не повинна автоматично прирівнюватися до 110 Н·м старої методики.

## Відмінності вихідних параметрів

У першому проході функції отримують ті самі числа, що й Excel, включно з історичною формулою α та фактичними площами/висотами джерела. У другому — збережену геометрію вузла, актуальну базу й каталоги; α прокладки береться з найближчої вищої точки, розширення кріплення/ГВ нульові. Відмінності не маскуються під помилку формул.

${nodes.map(n=>`### ${n.name}\n\n${n.application.parameterDifferences.map(p=>`- ${p.parameter}: Excel ${p.source ?? 'немає'} → поточний набір ${p.current ?? 'немає'}.`).join('\n')}\n\n${n.application.virtualProperties.length ? 'Для 25Л використано дозволений контрольний набір E/α, оскільки ці поля в data.js ще порожні.' : 'Характеристики цього вузла взято з поточної бази без підстановки E/α 25Л.'}`).join('\n\n')}

Вузол №1: Rp=300 МПа у старій книзі для СЧ25 не перенесено в матеріали. У даній геометрії він не потрібний активним перевіркам кришки (C–C виключений через hf>s₂), тому його відсутність не заважає числовому контролю меж.

## Походження та відтворення

- Вихідний файл: ${fixture.source.file}; SHA-256 ${fixture.source.sha256}.
- Перерахунок: Microsoft Excel desktop, окрема копія ${fixture.recalculation.file}; SHA-256 ${fixture.recalculation.sha256}.
- База data.js: SHA-256 ${output.dataSha256}; каталог standards.bundle.js: SHA-256 ${output.catalogSha256}.
- Перевірений діапазон A2:X110 усіх 4 вузлів: одна погоджена зміна входу C15=1 мм; змін формул — ${fixture.formulaChanges.length}; клітинок із помилками — ${fixture.errors.length}. Зміни кешів після перерахунку: ${fixture.cachedValueChanges.length}.
- scripts/extract-verification.py читає обидві книги, перевіряє зміни та формує tests/fixtures/workbook-verification.json. Жодну книгу не редагує.
- node scripts/verify-workbook.cjs повторює арифметичну й модельну звірку та формує цей звіт і tests/fixtures/workbook-comparison.json.
- У режимі сумісності зі старим Excel звірка показує пропущені текстові обмеження N74/O74. Після рішення користувача такий самий явний пропуск застосований у конструкторі для чавунного корпусу з повністю відсутнім Rp. Сирий допоміжний розрахунок без ознаки матеріалу залишається строгим.

Новий висновок не підтверджує застосовність методики до будь-якого обладнання й не змінює погоджену математику. Для вузла №4 відтворено погоджений пропуск за Excel. Результат містить пропущену перевірку міцності; для її реального виконання надалі потрібен критерій для чавуну.
`;
if (!checkOnly) fs.writeFileSync(path.join(root,'docs/VERIFICATION_2026-11-14.md'),md);
for (const node of nodes) console.log(`${node.name}: ${node.comparisons.length} comparisons, ${node.failures.length} differences; Excel ${node.sourceMinimum}–${node.sourceMaximum} Nm; skipped ${node.ignoredSourceCriteria.join(',') || 'none'}`);
for (const node of nodes) console.log(`${node.name}: application ${node.application.minimum}–${node.application.maximum} Nm; complete=${node.application.complete}; passed=${node.application.rangePassed}; pending=${node.application.pendingUpper.join(',') || 'none'}`);
for (const difference of output.failures) console.log(JSON.stringify(difference));
assert.equal(output.failures.length,0,'Arithmetic differences must be investigated before accepting the transfer');
for (const node of nodes.slice(0,3)) {
  assert.equal(node.application.complete,true,`${node.name}: all active calculations must be available`);
  assert.equal(node.application.rangePassed,true,`${node.name}: both rounded endpoints must pass`);
  assert.equal(node.application.minimum,node.sourceMinimum,`${node.name}: rounded lower bound changed; inspect inputs`);
  assert.equal(node.application.maximum,node.sourceMaximum,`${node.name}: rounded upper bound changed; inspect inputs`);
}
assert.equal(nodes[3].application.node.gasket.thickness,'1');
assert.equal(nodes[3].application.maximum,248,'Current catalog/material control profile, with Excel omission');
assert.equal(nodes[3].application.complete,false,'Excel omission must not be reported as a completed strength check');
assert.deepEqual(nodes[3].application.pendingUpper,[]);
assert.deepEqual(nodes[3].application.omittedUpper,['N74','O74']);
assert.equal(nodes[3].application.verification.maximum.omitted.length,2);
