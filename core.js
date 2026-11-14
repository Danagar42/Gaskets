(function (root) {
  'use strict';
  const sections = ['operating', 'gasket', 'fastener', 'connection', 'nut', 'washers', 'extras'];
  const DEFAULT_GASKET_REFERENCE_ID = 'graphite-annex-b1-b2-unidentified';
  const id = () => root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const timestamp = () => new Date().toISOString();
  function createEquipment(name, designation = '') {
    return { id: id(), name: name.trim(), designation: designation.trim(), createdAt: timestamp(), updatedAt: timestamp(), nodes: [] };
  }
  function createNode(name, kind = 'body-cover') {
    return {
      id: id(), name: name.trim(), createdAt: timestamp(), updatedAt: timestamp(),
      operating: { normal: { pressure: '', temperature: '', medium: '' }, hydro: { pressure: '', temperature: '', medium: '' } },
      gasket: { mode: 'ring', thickness: '', outerDiameter: '', innerDiameter: '', hasHoles: false, holeDiameter: '', effectiveArea: '', pressureArea: '', referenceId: DEFAULT_GASKET_REFERENCE_ID },
      fastener: { type: 'stud', nominalDiameter: '', count: '', lubricated: true, material: null, threadStandardId: 'gost-24705-2004', pitch: '', axialHoleDiameter:'0', torqueNm:'', targetTorqueMinNm:'', targetTorqueMaxNm:'' },
      connection: { kind, sideA: { name: kind === 'flange-flange' ? 'Фланець 1' : 'Кришка', material: null, height:'', area:'' }, sideB: { name: kind === 'flange-flange' ? 'Фланець 2' : 'Корпус', material: null, height:'', area:'' } },
      nut: { material: null, standardId: 'gost-5915-70', typeId: 'A' }, washers: { placement: 'none', material: null, standardId: 'gost-11371-78', accuracyClass: 'A', execution: '1' }, extras: [],
      flanges:{sideA:createFlange(),sideB:createFlange()}
    };
  }
  function createFlange() {
    return {mode:'pending',innerDiameter:'',boltCircle:'',outerDiameter:'',holeDiameter:'',height:'',coneHeight:'0',wallCylinder:'',wallCone:'',gasketDiameter:''};
  }
  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const text = String(value).trim().replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
    const result = Number(text);
    return Number.isFinite(result) ? result : null;
  }
  const positive = value => number(value) !== null && number(value) > 0;
  const canonical = value => {
    const twins = { A:'А', B:'В', C:'С', E:'Е', H:'Н', I:'І', K:'К', M:'М', O:'О', P:'Р', T:'Т', X:'Х', Y:'У', a:'а', c:'с', e:'е', i:'і', o:'о', p:'р', x:'х', y:'у' };
    const text = String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
    return (/[А-Яа-яІіЇїЄєҐґ]/u.test(text) ? text.replace(/[ABCEHIKMOPTXYaceiopxy]/g, ch => twins[ch] || ch) : text).toLocaleLowerCase('uk-UA');
  };
  function materialRef(material, grade) {
    return { name: material.name, kp: String(grade.kp ?? ''), description: grade.description ?? '' };
  }
  function resolveMaterial(materials, ref) {
    if (!ref) return null;
    const material = materials.find(item => item.name === ref.name);
    const grade = material?.grades.find(item => String(item.kp ?? '') === String(ref.kp ?? '') && (item.description ?? '') === ref.description);
    return grade ? { material, grade } : null;
  }
  function propertyAt(grade, property, temperature) {
    const requested = number(temperature);
    if (requested === null) return null;
    const map = grade?.data?.[property] || {};
    const source = Object.keys(map).map(Number).filter(t => Number.isFinite(t) && t >= requested && typeof map[t] === 'number' && Number.isFinite(map[t])).sort((a, b) => a - b)[0];
    return source === undefined ? null : { value: map[source], temperature: source, requested };
  }
  function missingProperties(materials, ref, operating, properties) {
    const found = resolveMaterial(materials, ref);
    if (!found) return [];
    return Object.entries(operating).flatMap(([mode, item]) => number(item.temperature) === null ? [] : properties.filter(property => !propertyAt(found.grade, property, item.temperature)).map(property => ({ mode, property })));
  }
  function cleanDescription(name, description) {
    let text = String(description || '').trim();
    if (text.toLocaleLowerCase('uk-UA').startsWith(name.toLocaleLowerCase('uk-UA'))) text = text.slice(name.length).replace(/^[.,\-;\s]+/, '');
    text = text.replace(/,?\s*\(\s*КП\s*\d+\s*\)\s*$/, '').trim();
    return text ? text[0].toLocaleUpperCase('uk-UA') + text.slice(1) : 'Опис виконання не зазначено';
  }
  function get(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
  }
  function set(object, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((part, key) => part[key], object);
    parent[last] = value;
  }

  function gasketMediumCoefficient(catalog, referenceId, medium) {
    const record = catalog?.gaskets?.[referenceId];
    if (!record || !medium) return null;
    const category = Object.keys(record.mediumGroups || {}).find(group => record.mediumGroups[group]?.includes(medium));
    const value = category ? record.mediumCoefficients?.[category] : null;
    if (!category || !positive(value)) return null;
    return { category, value };
  }
  function gasketExpansionAt(catalog, referenceId, temperature) {
    const record = catalog?.gaskets?.[referenceId];
    const t = number(temperature);
    if (!record || t === null || t < -273.15) return null;
    const table = record.expansionMicroPerCByTemperatureC || {};
    // User-approved rule: exact or nearest higher available table temperature.
    const source = Object.keys(table).map(Number).filter(key => Number.isFinite(key) && key >= t && typeof table[key] === 'number' && Number.isFinite(table[key])).sort((a,b) => a-b)[0];
    return source === undefined ? null : { temperatureC:source, requestedTemperatureC:t, value:table[source], unit:'10⁻⁶/°C' };
  }
  function threadPitch(catalog, standardId, nominalDiameter, selectedPitch = '') {
    const standard = catalog?.threads?.[standardId];
    const diameter = number(nominalDiameter);
    if (!standard || diameter === null || diameter <= 0) return null;
    const row = standard.sizes?.[String(diameter)];
    if (!row) return null;
    const explicit = String(selectedPitch ?? '').trim() !== '';
    const pitch = explicit ? number(selectedPitch) : row.coarsePitchMm;
    if (pitch === null || !row.pitchesMm?.includes(pitch)) return null;
    return {
      document: standard.document,
      pitchDocument: standard.pitchDocument,
      nominalDiameterMm: diameter,
      pitchMm: pitch,
      isCoarse: pitch === row.coarsePitchMm,
      automatic: !explicit,
      nonPreferred: (row.nonPreferredPitchesMm || []).includes(pitch)
    };
  }
  function nutDimensions(catalog, standardId, nominalDiameter, nutType = 'A') {
    const standard = catalog?.nuts?.[standardId];
    const diameter = number(nominalDiameter);
    if (!standard || diameter === null || diameter <= 0) return null;
    const row = standard.sizes?.[String(diameter)];
    if (!row) return null;
    const hasTypes = !!standard.types;
    const type = hasTypes ? standard.types[nutType] : null;
    if (hasTypes && !type) return null;
    const height = hasTypes ? row.heightsByTypeMm?.[nutType] : row.heightMm;
    if (!positive(height)) return null;
    return {
      document: standard.document,
      nominalDiameterMm: diameter,
      heightMm: height,
      heightSymbol: hasTypes ? type.heightSymbol : 'm',
      heightLabel: hasTypes ? type.heightLabel : 'Висота гайки',
      typeId: hasTypes ? nutType : null,
      nonPreferred: (standard.nonPreferredDiametersMm || []).includes(diameter)
    };
  }
  function washerDimensions(catalog, standardId, nominalDiameter, accuracyClass = 'A', execution = '1') {
    const standard = catalog?.washers?.[standardId];
    const diameter = number(nominalDiameter);
    if (!standard || diameter === null || !standard.executions?.[execution]?.includes(accuracyClass)) return null;
    if (diameter < (standard.minDiameterByExecutionMm?.[execution] ?? Infinity)) return null;
    const row = standard.sizes?.[String(diameter)];
    const inner = row?.innerDiameterByClassMm?.[accuracyClass];
    if (typeof inner !== 'number' || inner <= 0 || !positive(row?.outerDiameterMm) || !positive(row?.thicknessMm)) return null;
    return { document: standard.document, nominalDiameterMm: diameter, accuracyClass, execution, innerDiameterMm: inner, outerDiameterMm: row.outerDiameterMm, thicknessMm: row.thicknessMm };
  }
  function standardTorque(catalog, nominalDiameter, standardId = 'universal-table-1') {
    const table = catalog?.torques?.[standardId];
    const d = number(nominalDiameter);
    if (!table || d === null) return null;
    const row = table.sizes?.[String(d)];
    if (!row || !positive(row.minNm) || !positive(row.maxNm)) return null;
    return { tableId: standardId, title: table.title, nominalDiameterMm: d, minNm: row.minNm, maxNm: row.maxNm };
  }
  function effectiveTargetTorque(node, catalog) {
    const minRaw = node?.fastener?.targetTorqueMinNm, maxRaw = node?.fastener?.targetTorqueMaxNm;
    const customMin = positive(minRaw) ? number(minRaw) : null;
    const customMax = positive(maxRaw) ? number(maxRaw) : null;
    if (customMin !== null && customMax !== null && customMin <= customMax) {
      return { minNm: customMin, maxNm: customMax, source: 'custom', label: 'Паспорт / ТУ (задано)' };
    }
    const std = standardTorque(catalog, node?.fastener?.nominalDiameter);
    if (std) return { ...std, source: 'standard', label: `Стандарт (${std.title})` };
    return null;
  }
  function compareTorqueRanges({ calculatedMin, calculatedMax, targetMin, targetMax }) {
    const cMin = number(calculatedMin), cMax = number(calculatedMax);
    const tMin = number(targetMin), tMax = number(targetMax);
    if (cMin === null || cMax === null || cMin > cMax || tMin === null || tMax === null || tMin > tMax) {
      return { status: 'pending', overlapMin: null, overlapMax: null, reason: 'missing-data', label: 'Немає даних' };
    }
    const overlapMin = Math.max(cMin, tMin);
    const overlapMax = Math.min(cMax, tMax);
    if (overlapMin <= overlapMax) {
      if (cMin <= tMin && cMax >= tMax) {
        return {
          status: 'full',
          overlapMin,
          overlapMax,
          label: 'Повністю перекриває ТУ',
          description: `Розрахунковий діапазон [${cMin}–${cMax} Н·м] повністю покриває нормативні межі ТУ [${tMin}–${tMax} Н·м].`
        };
      }
      let reason = '';
      if (cMin > tMin && cMax < tMax) {
        reason = `Робочий коридор [${overlapMin}–${overlapMax} Н·м] звужений: мінімум вищий за ТУ (герметичність), а максимум обмежений міцністю.`;
      } else if (cMin > tMin) {
        reason = `Мінімальний розрахунковий затяг ${cMin} Н·м вищий за ТУ (${tMin} Н·м) для забезпечення герметичності.`;
      } else {
        reason = `Максимальний розрахунковий затяг ${cMax} Н·м нижчий за ТУ (${tMax} Н·м) через міцність вузла.`;
      }
      return {
        status: 'partial',
        overlapMin,
        overlapMax,
        label: `Частково: ${overlapMin}–${overlapMax} Н·м`,
        description: reason
      };
    }
    let reason = '';
    if (cMax < tMin) {
      reason = `Максимально допустимий затяг (${cMax} Н·м) нижчий за мінімальну вимогу ТУ (${tMin} Н·м).`;
    } else {
      reason = `Мінімальний момент для герметичності (${cMin} Н·м) перевищує максимум за ТУ (${tMax} Н·м).`;
    }
    return {
      status: 'none',
      overlapMin: null,
      overlapMax: null,
      label: 'Не перекриває ТУ',
      description: reason
    };
  }
  function validateInputs(node, catalog) {
    const errors = {}, missing = {};
    const fail = (path,message) => { errors[path] ||= message; };
    function numeric(path,{zero=false,min=0,optional=false,integer=false} = {}) {
      const raw = get(node,path);
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        if (!optional) missing[path] = 'Заповніть це поле.';
        return null;
      }
      const value = number(raw);
      if (value === null) fail(path,'Вкажіть число без одиниць вимірювання. Для дробової частини використовуйте кому або крапку.');
      else if (value < min || (!zero && value === 0)) fail(path,min < 0 ? `Температура має бути не нижчою за ${min} °C.` : zero ? 'Значення не може бути від’ємним.' : 'Значення має бути більшим за нуль.');
      else if (integer && !Number.isInteger(value)) fail(path,'Кількість має бути додатним цілим числом.');
      else if (integer && !Number.isSafeInteger(value)) fail(path,'Завелика кількість кріплень для точного розрахунку.');
      return errors[path] ? null : value;
    }
    for (const mode of ['normal','hydro']) {
      numeric(`operating.${mode}.pressure`,{zero:true});
      const temperature = numeric(`operating.${mode}.temperature`,{zero:true,min:-273.15});
      const mediumPath = `operating.${mode}.medium`;
      if (!get(node,mediumPath)) missing[mediumPath] = 'Оберіть робоче середовище.';
      else if (catalog?.gaskets && !gasketMediumCoefficient(catalog,node.gasket.referenceId || DEFAULT_GASKET_REFERENCE_ID,get(node,mediumPath))) fail(mediumPath,'Для цього середовища немає коефіцієнта m у вибраному наборі прокладки.');
      const record = catalog?.gaskets?.[node.gasket.referenceId || DEFAULT_GASKET_REFERENCE_ID];
      if (mode === 'normal' && temperature !== null && record && !gasketExpansionAt(catalog,record.id || node.gasket.referenceId,temperature)) fail(`operating.${mode}.temperature`,'Для цієї температури немає табличної α прокладки. Значення вище останньої точки не підставляється.');
    }
    numeric('gasket.thickness');
    const d = numeric('fastener.nominalDiameter'), count = numeric('fastener.count',{integer:true});
    numeric('fastener.torqueNm',{zero:true,optional:true});
    const targetMin = numeric('fastener.targetTorqueMinNm',{zero:true,optional:true});
    const targetMax = numeric('fastener.targetTorqueMaxNm',{zero:true,optional:true});
    if (targetMin !== null && targetMax !== null && targetMin > targetMax) {
      fail('fastener.targetTorqueMaxNm','Максимальний момент ТУ має бути не меншим за мінімальний.');
    }
    const axial = numeric('fastener.axialHoleDiameter',{zero:true});
    let pitch = null;
    if (d !== null && catalog?.threads) {
      const standard = catalog.threads[node.fastener.threadStandardId];
      if (!standard) fail('fastener.threadStandardId','Стандарт різьби відсутній у каталозі.');
      else if (!standard.sizes?.[String(d)]) fail('fastener.nominalDiameter','Цього номінального діаметра немає в обраному стандарті різьби.');
      else {
        pitch = threadPitch(catalog,node.fastener.threadStandardId,d,node.fastener.pitch);
        if (!pitch) {
          if (!String(node.fastener.pitch || '').trim()) missing['fastener.pitch'] = 'Для цього діаметра оберіть крок різьби.';
          else fail('fastener.pitch','Цей крок не передбачений для обраного діаметра.');
        }
      }
    }
    if (d !== null && axial !== null) {
      const rootDiameter = pitch ? d - 2*(17/24)*(0.5*pitch.pitchMm*Math.tan(Math.PI/3)) : d;
      if (axial >= rootDiameter) fail('fastener.axialHoleDiameter',pitch ? 'Поздовжній отвір має бути меншим за діаметр западин різьби d₃.' : 'Поздовжній отвір має бути меншим за номінальний діаметр кріплення.');
    }
    let mean = null;
    if (node.gasket.mode === 'area') {
      numeric('gasket.effectiveArea'); numeric('gasket.pressureArea');
    } else {
      const outer = numeric('gasket.outerDiameter'), inner = numeric('gasket.innerDiameter');
      const hole = node.gasket.hasHoles ? numeric('gasket.holeDiameter') : 0;
      if (outer !== null && inner !== null) {
        if (outer <= inner) {
          fail('gasket.outerDiameter','Зовнішній діаметр має бути більшим за внутрішній.');
          fail('gasket.innerDiameter','Внутрішній діаметр має бути меншим за зовнішній.');
        } else {
          const width = (outer-inner)/2; mean = (outer+inner)/2;
          if (hole !== null && hole >= width) fail('gasket.holeDiameter','Діаметр отвору має бути меншим за ширину кільцевого поля (Dзовн−Dвн)/2.');
          const effective = width > 15 ? 3.8*Math.sqrt(width) : width;
          const area = hole !== null && (!node.gasket.hasHoles || count !== null) ? Math.PI*(effective*mean-(node.gasket.hasHoles ? count*hole*hole/4 : 0)) : null;
          if (![mean,Math.PI*(mean/2)**2,Math.PI*width*mean].every(Number.isFinite)) fail('gasket.outerDiameter','Розміри виходять за числовий діапазон розрахунку.');
          else if (area !== null && !(area > 0)) {
            fail('gasket.holeDiameter','Після віднімання отворів ефективна площа має бути додатною.');
            fail('fastener.count','З цією кількістю отворів ефективна площа прокладки недодатна.');
          }
        }
      }
    }
    for (const side of ['sideA','sideB']) {
      numeric(`connection.${side}.height`);
      numeric(`connection.${side}.area`,{optional:node.gasket.mode === 'ring'});
      const flange = node.flanges?.[side];
      if (flange?.mode !== 'flange') continue;
      const path = `flanges.${side}.`;
      const inner = numeric(path+'innerDiameter'), circle = numeric(path+'boltCircle'), outer = numeric(path+'outerDiameter');
      const enteredHole = numeric(path+'holeDiameter',{optional:true});
      const hole = String(flange.holeDiameter || '').trim() === '' && d !== null ? d+(d >= 27 ? 3 : d > 10 ? 2 : 1) : enteredHole;
      for (const key of ['height','wallCylinder','wallCone']) numeric(path+key);
      numeric(path+'coneHeight',{zero:true});
      const dm = node.gasket.mode === 'ring' ? mean : numeric(path+'gasketDiameter');
      if (inner !== null && circle !== null && circle <= inner) fail(path+'boltCircle','Потрібно D < Dw: коло кріплень має бути більшим за внутрішній діаметр.');
      if (circle !== null && outer !== null && outer <= circle) fail(path+'outerDiameter','Потрібно Dw < Df: зовнішній діаметр має бути більшим за коло кріплень.');
      if (inner !== null && outer !== null && hole !== null && outer-inner-2*hole <= 0) fail(path+'holeDiameter','Перемичка Df−D−2d₀ має бути додатною. Перевірте отвір і діаметри фланця.');
      if (dm !== null && inner !== null && dm <= inner) fail(node.gasket.mode === 'area' ? path+'gasketDiameter' : path+'innerDiameter','Розрахунковий діаметр прокладки Dm має бути більшим за D.');
      if (dm !== null && outer !== null && dm >= outer) fail(node.gasket.mode === 'area' ? path+'gasketDiameter' : path+'outerDiameter','Розрахунковий діаметр прокладки Dm має бути меншим за Df.');
    }
    if (node.nut.typeId === 'B') {
      const height = numeric('nut.threadedHeight'), nut = nutDimensions(catalog,node.nut.standardId,d,node.nut.typeId);
      if (height !== null && nut && height > nut.heightMm) fail('nut.threadedHeight',`Різьбова частина не може бути вищою за гайку (${nut.heightMm} мм).`);
    }
    node.extras.forEach((item,index) => {
      numeric(`extras.${index}.thickness`); numeric(`extras.${index}.area`);
    });
    return {errors,missing};
  }
  function sectionStatus(node, materials, standardsDb) {
    const validMaterial = (ref, properties = ['RTm','RTp','E','Alpha']) => !!resolveMaterial(materials, ref) && !missingProperties(materials, ref, node.operating, properties).length;
    const result = {};
    const cases = Object.values(node.operating);
    result.operating = cases.every(item => number(item.pressure) !== null && number(item.pressure) >= 0 && number(item.temperature) !== null && number(item.temperature) >= -273.15 && !!item.medium);
    const gasket = node.gasket;
    result.gasket = positive(gasket.thickness) && (gasket.mode === 'area'
      ? positive(gasket.effectiveArea) && positive(gasket.pressureArea)
      : positive(gasket.outerDiameter) && positive(gasket.innerDiameter) && number(gasket.outerDiameter) > number(gasket.innerDiameter) && (!gasket.hasHoles || positive(gasket.holeDiameter))) && (!standardsDb || !!standardsDb.gaskets?.[gasket.referenceId || DEFAULT_GASKET_REFERENCE_ID]);
    result.fastener = positive(node.fastener.nominalDiameter) && positive(node.fastener.count) && Number.isInteger(number(node.fastener.count)) && validMaterial(node.fastener.material, ['RTm','RTp','E']) && (!standardsDb?.threads || !!threadPitch(standardsDb, node.fastener.threadStandardId || 'gost-24705-2004', node.fastener.nominalDiameter, node.fastener.pitch || ''));
    result.connection = !!node.connection.sideA.name.trim() && !!node.connection.sideB.name.trim() && positive(node.connection.sideA.height) && positive(node.connection.sideB.height) && validMaterial(node.connection.sideA.material) && validMaterial(node.connection.sideB.material);
    result.connection &&= ['sideA','sideB'].every(key => {
      const area = node.connection[key].area;
      return area === undefined || String(area).trim() === '' ? node.gasket.mode === 'ring' : positive(area);
    });
    result.connection &&= ['sideA','sideB'].every(key => {
      const part = node.flanges?.[key];
      if (part?.mode === 'none') return true;
      if (part?.mode !== 'flange') return false;
      return ['innerDiameter','boltCircle','outerDiameter','height','wallCylinder','wallCone'].every(field => positive(part[field]))
        && number(part.coneHeight) !== null && number(part.coneHeight) >= 0
        && (String(part.holeDiameter).trim() === '' || positive(part.holeDiameter))
        && (node.gasket.mode === 'ring' || positive(part.gasketDiameter));
    });
    const nutSize = standardsDb ? nutDimensions(standardsDb, node.nut.standardId || 'gost-5915-70', node.fastener.nominalDiameter, node.nut.typeId || 'A') : null;
    result.nut = validMaterial(node.nut.material, ['RTm','RTp']) && (!standardsDb || !!nutSize) && (nutSize?.typeId !== 'B' || (positive(node.nut.threadedHeight) && number(node.nut.threadedHeight) <= nutSize.heightMm));
    result.washers = node.washers.placement === 'none' || (validMaterial(node.washers.material, ['E','Alpha']) && (!standardsDb || !!washerDimensions(standardsDb, node.washers.standardId || 'gost-11371-78', node.fastener.nominalDiameter, node.washers.accuracyClass || 'A', node.washers.execution || '1')));
    result.extras = node.extras.every(item => !!item.name.trim() && positive(item.thickness) && positive(item.area) && validMaterial(item.material, ['E']));
    for (const path of Object.keys(validateInputs(node,standardsDb).errors)) result[path.startsWith('flanges.') ? 'connection' : path.split('.')[0]] = false;
    return result;
  }
  function progress(node, materials, standardsDb) {
    const statuses = sectionStatus(node, materials, standardsDb);
    const done = Object.values(statuses).filter(Boolean).length;
    return { done, total: sections.length, percent: Math.round(done / sections.length * 100), statuses };
  }
  function validateWorkspace(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.equipment)) return false;
    const isText = text => typeof text === 'string';
    const isRef = ref => ref === null || (ref && isText(ref.name) && isText(ref.kp) && isText(ref.description));
    const ids = new Set();
    const validId = item => isText(item?.id) && !ids.has(item.id) && !!ids.add(item.id);
    return value.equipment.every(equipment => validId(equipment) && isText(equipment.name) && isText(equipment.designation) && Array.isArray(equipment.nodes) && equipment.nodes.every(node => {
      if (!validId(node) || !isText(node.name) || !node.operating || !node.gasket || !node.fastener || !node.connection || !node.nut || !node.washers || !Array.isArray(node.extras)) return false;
      const template = createNode('');
      const scalarFields = ['gasket.mode','gasket.thickness','gasket.outerDiameter','gasket.innerDiameter','gasket.holeDiameter','gasket.effectiveArea','gasket.pressureArea','fastener.type','fastener.nominalDiameter','fastener.count','connection.kind','connection.sideA.name','connection.sideB.name','washers.placement'];
      if (!scalarFields.every(path => typeof get(node, path) === typeof get(template, path))) return false;
      if (!['ring','area'].includes(node.gasket.mode) || !['stud','bolt'].includes(node.fastener.type) || !['body-cover','flange-flange','custom'].includes(node.connection.kind) || !['none','a','b','both'].includes(node.washers.placement)) return false;
      if (node.flanges !== undefined && (!node.flanges || !['sideA','sideB'].every(key => {
        const flange = node.flanges[key];
        return flange && ['pending','flange','none'].includes(flange.mode) && Object.keys(createFlange()).filter(field => field !== 'mode').every(field => isText(flange[field]));
      }))) return false;
      return ['normal','hydro'].every(key => node.operating[key] && ['pressure','temperature','medium'].every(field => isText(node.operating[key][field]))) && typeof node.gasket.hasHoles === 'boolean' && typeof node.fastener.lubricated === 'boolean'
        && ['fastener.material','connection.sideA.material','connection.sideB.material','nut.material','washers.material'].every(path => isRef(get(node, path)))
        && ['sideA','sideB'].every(key => ['height','area'].every(field => node.connection[key][field] === undefined || isText(node.connection[key][field])))
        && (node.gasket.referenceId === undefined || isText(node.gasket.referenceId)) && ['threadStandardId','pitch','axialHoleDiameter','torqueNm','targetTorqueMinNm','targetTorqueMaxNm'].every(key => node.fastener[key] === undefined || isText(node.fastener[key])) && ['standardId','typeId','threadedHeight'].every(key => node.nut[key] === undefined || isText(node.nut[key])) && ['standardId','accuracyClass','execution'].every(key => node.washers[key] === undefined || isText(node.washers[key])) && node.extras.every(extra => validId(extra) && isText(extra.name) && isText(extra.thickness) && isText(extra.area) && isRef(extra.material));
    }));
  }
  const api = { DEFAULT_GASKET_REFERENCE_ID, id, timestamp, sections, createEquipment, createNode, createFlange, number, positive, canonical, materialRef, resolveMaterial, propertyAt, washerDimensions, nutDimensions, threadPitch, standardTorque, effectiveTargetTorque, compareTorqueRanges, gasketMediumCoefficient, gasketExpansionAt, missingProperties, cleanDescription, get, set, sectionStatus, progress, validateWorkspace, validateInputs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlangeCore = api;
})(globalThis);
