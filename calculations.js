(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.FlangeCore;

  function gasketGeometry(gasket, fastenerCount) {
    const values = { width:null, holeWidth:null, effectiveWidth:null, effectiveHoleWidth:null, meanDiameter:null, effectiveArea:null, pressureArea:null, physicalArea:null };
    const issues = [];
    if (gasket.mode === 'area') {
      for (const key of ['effectiveArea','pressureArea']) {
        if (C.positive(gasket[key])) values[key] = C.number(gasket[key]);
        else issues.push(key === 'effectiveArea' ? 'Вкажіть ефективну площу прокладки.' : 'Вкажіть площу дії гідростатичного зусилля.');
      }
      return { values, issues };
    }
    const outer = C.number(gasket.outerDiameter), inner = C.number(gasket.innerDiameter);
    if (!(outer > 0 && inner > 0 && outer > inner)) return { values, issues:['Задайте діаметри прокладки: зовнішній має бути більшим за внутрішній.'] };
    const width = (outer - inner) / 2;
    const mean = (outer + inner) / 2;
    const effective = width > 15 ? 3.8 * Math.sqrt(width) : width;
    const pressureArea = Math.PI * (mean / 2) ** 2;
    if (![width,mean,effective,pressureArea].every(value => Number.isFinite(value) && value > 0)) return {values,issues:['Розміри прокладки виходять за числовий діапазон розрахунку.']};
    Object.assign(values, { width, meanDiameter:mean, effectiveWidth:effective, pressureArea });
    let hole = 0, count = 0;
    if (gasket.hasHoles) {
      hole = C.number(gasket.holeDiameter); count = C.number(fastenerCount);
      if (!(hole > 0 && hole < width && count > 0 && Number.isInteger(count))) return { values, issues:['Для отворів потрібні додатний діаметр, менший за ширину прокладки, та ціла кількість кріплень.'] };
    }
    const area = Math.PI * (effective * mean - count * hole ** 2 / 4);
    if (!(area > 0 && Number.isFinite(area))) issues.push('Після врахування отворів ефективна площа має бути додатною та скінченною.');
    else values.effectiveArea = area;
    const physicalArea = Math.PI * (width * mean - count * hole ** 2 / 4);
    if (physicalArea > 0 && Number.isFinite(physicalArea)) values.physicalArea = physicalArea;
    else if (!Number.isFinite(physicalArea)) issues.push('Фізична площа прокладки виходить за числовий діапазон розрахунку.');
    values.holeWidth = width - hole;
    // C19 source branch uses the original width, not the width reduced by a hole.
    values.effectiveHoleWidth = width > 15 ? 3.8 * Math.sqrt(width - hole) : width - hole;
    return { values, issues };
  }

  function threadGeometry(diameter, pitch, axialHoleDiameter = '0') {
    const d = C.number(diameter), p = C.number(pitch), hole = C.number(axialHoleDiameter);
    const values = { rootDiameter:null, meanDiameter:null, smoothArea:null, threadArea:null };
    if (!(d > 0 && p > 0 && hole !== null && hole >= 0)) return { values, issues:['Задайте діаметр і допустимий крок різьби; діаметр поздовжнього отвору не може бути від’ємним.'] };
    const height = 0.5 * p * Math.tan(Math.PI / 3);
    const rootDiameter = d - 2 * (17 / 24) * height;
    if (!(rootDiameter > 0 && hole < rootDiameter)) return { values, issues:['Поздовжній отвір має бути меншим за діаметр d₃.'] };
    // Preserve the source coefficient 0.785 rather than silently replacing with pi/4.
    const meanDiameter = d - 2 * (3 / 8) * height;
    const smoothArea = 0.785 * (d ** 2 - hole ** 2), threadArea = 0.785 * (rootDiameter ** 2 - hole ** 2);
    if (![rootDiameter,meanDiameter,smoothArea,threadArea].every(value => Number.isFinite(value) && value > 0)) return {values,issues:['Розміри кріплення виходять за числовий діапазон розрахунку.']};
    Object.assign(values, { rootDiameter, meanDiameter, smoothArea, threadArea });
    return { values, issues:[] };
  }

  function packageLengths(parts) {
    const issues = parts.filter(part => !C.positive(part.height)).map(part => `Потрібна висота: ${part.name}.`);
    if (!parts.length) issues.push('Не задано елементи пакета.');
    if (issues.length) return { values:{smoothLength:null,threadedLength:null,totalLength:null}, issues, parts };
    const threadedLength = parts.filter(part => part.threaded).reduce((sum,part) => sum + C.number(part.height),0);
    const smoothLength = parts.filter(part => !part.threaded).reduce((sum,part) => sum + C.number(part.height),0);
    if (![smoothLength,threadedLength,smoothLength+threadedLength].every(Number.isFinite)) return {values:{smoothLength:null,threadedLength:null,totalLength:null},issues:['Сума висот пакета виходить за числовий діапазон розрахунку.'],parts};
    return { values:{smoothLength,threadedLength,totalLength:smoothLength + threadedLength}, issues:[], parts };
  }

  function engagementHeight(node,mount) {
    if (!mount.body) return null;
    const height = C.number(mount.engagement), available = C.number(node.connection[mount.body].height);
    return height > 0 && !(available !== null && height > available) ? height : null;
  }
  function nodeGeometry(node, catalog) {
    const pitch = C.threadPitch(catalog,node.fastener.threadStandardId,node.fastener.nominalDiameter,node.fastener.pitch);
    const mount = C.mounting(node);
    const washer = C.washerDimensions(catalog,node.washers.standardId,node.fastener.nominalDiameter,node.washers.accuracyClass,node.washers.execution);
    const nuts = mount.nuts.map(key=>{
      const nut = C.nutAt(node,key), size = C.nutDimensions(catalog,nut.standardId,node.fastener.nominalDiameter,nut.typeId);
      return {name:size?.typeId === 'B' ? 'Різьбова частина ковпачкової гайки' : 'Гайка',height:size?.typeId === 'B' ? C.number(nut.threadedHeight) : size?.heightMm,max:size?.heightMm,threaded:true};
    });
    const parts = [
      {name:node.connection.sideA.name || 'Деталь А', height:mount.body === 'sideA' ? engagementHeight(node,mount) : node.connection.sideA.height, threaded:mount.body === 'sideA'},
      {name:'Прокладка',height:node.gasket.thickness,threaded:false},
      {name:node.connection.sideB.name || 'Деталь Б',height:mount.body === 'sideB' ? engagementHeight(node,mount) : node.connection.sideB.height,threaded:mount.body === 'sideB'},
      ...nuts,
      ...node.extras.map(part => ({name:part.name || 'Додатковий елемент',height:part.thickness,threaded:false}))
    ];
    for (const side of ['a','b']) if ([side,'both'].includes(node.washers.placement)) parts.push({name:`Шайба, бік ${side === 'a' ? 'А' : 'Б'}`,height:washer?.thicknessMm,threaded:false});
    const lengths = packageLengths(parts);
    if (nuts.some(nut=>nut.height > nut.max)) {
      lengths.issues.push('Висота різьбової частини не може перевищувати загальну висоту ковпачкової гайки.');
      Object.keys(lengths.values).forEach(key => { lengths.values[key] = null; });
    }
    return { gasket:gasketGeometry(node.gasket,node.fastener.count), thread:threadGeometry(node.fastener.nominalDiameter,pitch?.pitchMm,node.fastener.axialHoleDiameter ?? '0'), lengths };
  }
  function compliance(input = {}) {
    const values = {};
    const issues = [];
    const n = C.number(input.count);
    const countValid = n > 0 && Number.isInteger(n);
    function checked(value, label) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        issues.push(`Недостатні або некоректні дані: ${label}.`);
        return null;
      }
      return value;
    }
    function prismatic(part, label, divisor = 1) {
      if (!part || !C.positive(part.height) || !C.positive(part.modulusMPa) || !C.positive(part.area) || !C.positive(divisor)) return checked(null,label);
      return checked(C.number(part.height) / (C.number(part.modulusMPa) * C.number(part.area) * divisor),label);
    }
    const sum = list => {
      if (!list.every(value => value !== null && Number.isFinite(value))) return null;
      const total = list.reduce((result,value) => result + value,0);
      return Number.isFinite(total) ? total : null;
    };
    values.gasket = prismatic(input.gasket,'прокладка — товщина, Eпр та ефективна площа');
    values.sideA = prismatic(input.sideA,'деталь А — висота, E та площа перерізу');
    values.sideB = prismatic(input.sideB,'деталь Б — висота, E та площа перерізу');
    values.washerA = input.washerA ? prismatic(input.washerA,'шайба А — висота, E, площа та кількість',countValid ? n : null) : 0;
    values.washerB = input.washerB ? prismatic(input.washerB,'шайба Б — висота, E, площа та кількість',countValid ? n : null) : 0;
    values.extras = sum((input.extras || []).map(part => prismatic(part,`${part.name || 'додатковий елемент'} — висота, E та площа`)));
    const f = input.fastener || {};
    const e = C.number(f.modulusMPa), d = C.number(f.nominalDiameter), pitch = C.number(f.pitch);
    const d3 = C.number(f.rootDiameter), d2 = C.number(f.meanDiameter);
    values.smoothPart = prismatic({height:f.smoothLength,modulusMPa:e,area:f.smoothArea},'нерізьбова частина кріплення — довжина, E та площа');
    values.threadedPart = prismatic({height:f.threadedLength,modulusMPa:e,area:f.threadArea},'різьбова частина кріплення — довжина, E та площа');
    const joint = e > 0 && pitch > 0 && d3 > 0 && d2 > 0 ? 0.49 * Math.sqrt(1.44 + 9.28 * pitch / d3) / (d2 * e) : null;
    values.threadJoint1 = checked(joint,'перша поправка різьбової частини — крок, d₃, d₂ та E');
    values.threadJoint2 = values.threadJoint1;
    const smoothLength = C.number(f.smoothLength);
    const knownClass = d > 0 && smoothLength > 0;
    const short = knownClass && smoothLength < 6 * d;
    const single = knownClass ? (short ? sum([values.smoothPart,values.threadedPart,values.threadJoint1,values.threadJoint2]) : values.smoothPart) : null;
    values.fastener = checked(countValid && single !== null ? single / n : null,'кріплення — складові податливості та ціла додатна кількість');
    values.joinedParts = sum([values.sideA,values.sideB]);
    values.washers = sum([values.washerA,values.washerB]);
    const total = sum([values.gasket,values.sideA,values.sideB,values.washerA,values.washerB,values.extras,values.fastener]);
    values.totalCompliance = total;
    values.loadFactor = total !== null && total > 0 && values.gasket !== null ? checked(values.gasket / total,'коефіцієнт навантаження χ') : null;
    return {values,issues:[...new Set(issues)],fastenerClass:knownClass ? (short ? 'short' : 'long') : null};
  }

  function nodeCompliance(node, materials, catalog) {
    const geometry = nodeGeometry(node,catalog);
    const pitch = C.threadPitch(catalog,node.fastener.threadStandardId,node.fastener.nominalDiameter,node.fastener.pitch);
    const washer = C.washerDimensions(catalog,node.washers.standardId,node.fastener.nominalDiameter,node.washers.accuracyClass,node.washers.execution);
    const gasket = catalog.gaskets?.[node.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID];
    const areas = {};
    for (const side of ['sideA','sideB']) {
      const entered = node.connection[side].area;
      areas[side] = entered === undefined || String(entered).trim() === '' ? geometry.gasket.values.physicalArea : C.number(entered);
    }
    const states = {};
    for (const mode of ['normal','hydro']) {
      const temperature = node.operating[mode].temperature;
      const sources = [];
      const sourceIssues = [];
      function modulus(ref,label) {
        const resolved = C.resolveMaterial(materials,ref);
        const t = C.number(temperature);
        const property = t !== null && t >= -273.15 ? C.propertyAt(resolved?.grade,'E',temperature) : null;
        if (!property || !(property.value > 0)) {
          sourceIssues.push(`${label}: виберіть матеріал і температуру з доступним модулем E.`);
          return null;
        }
        sources.push({name:label,temperature:property.temperature,valueMPa:property.value * 1000});
        return property.value * 1000;
      }
      const fastenerE = modulus(node.fastener.material,'Кріплення');
      const sideA = {height:node.connection.sideA.height,area:areas.sideA,modulusMPa:modulus(node.connection.sideA.material,'Деталь А')};
      const sideB = {height:node.connection.sideB.height,area:areas.sideB,modulusMPa:modulus(node.connection.sideB.material,'Деталь Б')};
      let washerA = null, washerB = null;
      if (node.washers.placement !== 'none') {
        // Same 3.1415 * mean diameter * width expression as I8/J8 of the source.
        const washerPart = {height:washer?.thicknessMm,area:washer ? 3.1415 * ((washer.outerDiameterMm + washer.innerDiameterMm) / 2) * ((washer.outerDiameterMm - washer.innerDiameterMm) / 2) : null,modulusMPa:modulus(node.washers.material,'Шайби')};
        if (['a','both'].includes(node.washers.placement)) washerA = washerPart;
        if (['b','both'].includes(node.washers.placement)) washerB = washerPart;
      }
      const result = compliance({
        count:node.fastener.count,
        gasket:{height:node.gasket.thickness,area:geometry.gasket.values.effectiveArea,modulusMPa:gasket?.elasticModulusMPa},
        sideA,sideB,washerA,washerB,
        extras:node.extras.map((part,index) => ({name:part.name || `Елемент ${index + 1}`,height:part.thickness,area:part.area,modulusMPa:modulus(part.material,part.name || `Елемент ${index + 1}`)})),
        fastener:{...geometry.thread.values,...geometry.lengths.values,nominalDiameter:node.fastener.nominalDiameter,pitch:pitch?.pitchMm,modulusMPa:fastenerE}
      });
      states[mode] = {...result,issues:[...new Set([...sourceIssues,...result.issues])],sources};
    }
    return {states,areas};
  }
  function linearExpansion(height, alphaMicroPerK, temperature, referenceTemperature) {
    const h = C.number(height), alpha = C.number(alphaMicroPerK), t = C.number(temperature), t0 = C.number(referenceTemperature);
    if (h === null || h < 0 || alpha === null || alpha < 0 || t === null || t < -273.15 || t0 === null || t0 < -273.15) {
      return {value:null,issues:['Потрібні довжина, коефіцієнт α та обидві температури у визначених одиницях.']};
    }
    const value = h * alpha * (t - t0) * 1e-6;
    return Number.isFinite(value) ? {value,issues:[]} : {value:null,issues:['Лінійне розширення виходить за числовий діапазон.']};
  }

  function thermalForce(packExpansion, fastenerExpansion, totalCompliance) {
    const pack = C.number(packExpansion), fastener = C.number(fastenerExpansion), compliance = C.number(totalCompliance);
    if (pack === null || fastener === null || !(compliance > 0)) return {value:null,issues:['Для температурного зусилля потрібні обидва розширення та додатна сумарна податливість.']};
    const value = (pack - fastener) / compliance;
    return Number.isFinite(value) ? {value,issues:[]} : {value:null,issues:['Температурне зусилля виходить за числовий діапазон.']};
  }
  function nodeThermal(node, materials, catalog) {
    const referenceTemperature = 20;
    const mount = C.mounting(node);
    const values = {fastener:0,gasket:null,sideA:0,sideB:0,washerA:0,washerB:0,extras:0,pack:null,force:null};
    const issues = [];
    const sources = [];
    const t = C.number(node.operating.normal.temperature);
    const stiffness = nodeCompliance(node,materials,catalog).states.normal;
    function metalExpansion(ref,height,label) {
      const selected = C.resolveMaterial(materials,ref);
      const alpha = t !== null && t >= -273.15 ? C.propertyAt(selected?.grade,'Alpha',t) : null;
      if (!alpha) { issues.push(`${label}: немає α для заданої температури НУЕ.`); return null; }
      sources.push({name:label,temperature:alpha.temperature,value:alpha.value});
      const result = linearExpansion(height,alpha.value,t,referenceTemperature);
      if (result.value === null) issues.push(`${label}: перевірте висоту та температуру.`);
      return result.value;
    }
    const gasketAlpha = C.gasketExpansionAt(catalog,node.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID,t);
    if (!gasketAlpha || t === null) issues.push('Прокладка: немає табличної α для заданої температури НУЕ.');
    else {
      sources.push({name:'Прокладка',temperature:gasketAlpha.temperatureC,value:gasketAlpha.value});
      values.gasket = linearExpansion(node.gasket.thickness,gasketAlpha.value,t,referenceTemperature).value;
      if (values.gasket === null) issues.push('Прокладка: задайте товщину та коректну температуру.');
    }
    if (mount.body !== 'sideA') values.sideA = metalExpansion(node.connection.sideA.material,node.connection.sideA.height,'Деталь А');
    if (mount.body !== 'sideB') values.sideB = metalExpansion(node.connection.sideB.material,node.connection.sideB.height,'Деталь Б');
    if (node.washers.placement !== 'none') {
      const washer = C.washerDimensions(catalog,node.washers.standardId,node.fastener.nominalDiameter,node.washers.accuracyClass,node.washers.execution);
      const expansion = metalExpansion(node.washers.material,washer?.thicknessMm,'Шайби');
      if (['a','both'].includes(node.washers.placement)) values.washerA = expansion;
      if (['b','both'].includes(node.washers.placement)) values.washerB = expansion;
    }
    // Per the constructor agreement, added spacers influence compliance only.
    const parts = [values.gasket,values.sideA,values.sideB,values.washerA,values.washerB];
    if (parts.every(value => value !== null && Number.isFinite(value))) {
      const sum = parts.reduce((total,value) => total + value,0);
      if (Number.isFinite(sum)) values.pack = sum;
      else issues.push('Сума розширень виходить за числовий діапазон.');
    }
    const force = thermalForce(values.pack,0,stiffness.values.totalCompliance);
    values.force = force.value;
    if (force.value === null) issues.push(...stiffness.issues,...force.issues);
    const hydroValues = Object.fromEntries(Object.keys(values).map(key => [key,0]));
    return {
      referenceTemperature,
      normal:{values,issues:[...new Set(issues)],sources,totalCompliance:stiffness.values.totalCompliance},
      hydro:{values:hydroValues,issues:[],sources:[],conservative:true}
    };
  }
  function forces(input = {}) {
    const issues = [];
    const read = (key,label,valid) => {
      const value = C.number(input[key]);
      if (value !== null && valid(value)) return value;
      issues.push(`Потрібні коректні дані: ${label}.`);
      return null;
    };
    const positive = value => value > 0;
    const nonnegative = value => value >= 0;
    const area = read('gasketArea','ефективна площа прокладки',positive);
    const pressureArea = read('pressureArea','площа дії тиску',positive);
    const pressure = read('pressure','тиск режиму',nonnegative);
    const m = read('mediumCoefficient','коефіцієнт середовища m',positive);
    const seating = read('seatingPressure','тиск обтиснення q₀',positive);
    const qmin = read('minimumPressure','мінімальний тиск qmin',positive);
    const qmax = read('maximumPressure','максимальний тиск qmax',positive);
    const count = read('count','ціла кількість кріплень',value => value > 0 && Number.isInteger(value));
    const diameter = read('diameter','діаметр кріплення',positive);
    const friction = read('friction','коефіцієнт ζ₁',positive);
    const torque = read('torqueNm','заданий момент у Н·м',nonnegative);
    const chi = read('loadFactor','коефіцієнт χ',value => value >= 0 && value <= 1);
    const thermal = read('thermalForce','температурне зусилля',() => true);
    const calc = (args,formula) => {
      if (args.some(value => value === null)) return null;
      const value = formula(...args);
      if (Number.isFinite(value)) return value;
      issues.push('Результат зусиль виходить за числовий діапазон.');
      return null;
    };
    const values = {};
    values.initialSingle = calc([torque,friction,diameter],(t,f,d) => t * 1000 / (f * d));
    values.initialTotal = calc([values.initialSingle,count],(f,n) => f * n);
    values.sealing = calc([area,m,pressure],(a,m,p) => a * m * p);
    values.hydrostatic = calc([pressureArea,pressure],(a,p) => a * p);
    values.seating = calc([area,seating],(a,q) => a * q);
    values.thermal = thermal;
    values.fastener = calc([values.initialTotal,chi,values.hydrostatic,thermal],(f,c,p,t) => f + c * p + t);
    values.gasket = calc([values.initialTotal,chi,values.hydrostatic,thermal],(f,c,p,t) => f - (1-c) * p + t);
    // Preserve the +Ft sign in I43, even though solving I34 for F0 would give -Ft.
    values.sealingRequired = calc([values.sealing,chi,values.hydrostatic,thermal],(f,c,p,t) => f + (1-c) * p + t);
    values.contactPressure = calc([values.gasket,area],(f,a) => f / a);
    values.minimumPressure = qmin;
    values.maximumPressure = qmax;
    values.pressureRequired = calc([qmin,area,chi,values.hydrostatic,thermal],(q,a,c,p,t) => q * a + (1-c) * p - t);
    const check = (actual,required,upper = false) => ({actual,required,passed:actual === null || required === null ? null : upper ? actual <= required : actual >= required});
    const checks = {
      seating:check(values.initialTotal,values.seating),
      sealing:check(values.initialTotal,values.sealingRequired),
      minimumPressure:check(values.contactPressure,qmin),
      maximumPressure:check(values.contactPressure,qmax,true)
    };
    return {values,checks,issues:[...new Set(issues)]};
  }

  function nodeForces(node,materials,catalog) {
    const geometry = nodeGeometry(node,catalog).gasket.values;
    const compliance = nodeCompliance(node,materials,catalog);
    const thermal = nodeThermal(node,materials,catalog);
    const reference = catalog.gaskets?.[node.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID];
    const friction = node.fastener.lubricated === true ? 0.26 : node.fastener.lubricated === false ? 0.37 : null;
    const states = {};
    for (const mode of ['normal','hydro']) {
      const coefficient = C.gasketMediumCoefficient(catalog,node.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID,node.operating[mode].medium);
      states[mode] = forces({
        gasketArea:geometry.effectiveArea,pressureArea:geometry.pressureArea,
        pressure:node.operating[mode].pressure,mediumCoefficient:coefficient?.value,
        seatingPressure:reference?.seatingPressureMPa,minimumPressure:reference?.minimumPressureMPa,maximumPressure:reference?.maximumPressureMPa,
        count:node.fastener.count,diameter:node.fastener.nominalDiameter,friction,torqueNm:node.fastener.torqueNm,
        loadFactor:compliance.states[mode].values.loadFactor,thermalForce:thermal[mode].values.force
      });
      states[mode].mediumCoefficient = coefficient?.value ?? null;
    }
    const candidates = [{mode:'normal',key:'seating',force:states.normal.values.seating}];
    for (const mode of ['normal','hydro']) for (const key of ['sealingRequired','pressureRequired']) candidates.push({mode,key,force:states[mode].values[key]});
    const complete = candidates.every(item => item.force !== null);
    const force = complete ? Math.max(...candidates.map(item => item.force)) : null;
    const count = C.number(node.fastener.count), diameter = C.number(node.fastener.nominalDiameter);
    const torque = force !== null && count > 0 && Number.isInteger(count) && diameter > 0 && friction !== null ? force * friction * diameter / (count * 1000) : null;
    const minimum = {force,torqueNm:Number.isFinite(torque) ? torque : null,roundedTorqueNm:Number.isFinite(torque) ? Math.ceil(torque) : null,candidates,governing:complete ? candidates.filter(item => item.force === force) : []};
    return {states,friction,minimum};
  }
  function strength(input = {}) {
    const issues = [];
    const read = (value,label,valid = value => value > 0) => {
      const number = C.number(value);
      if (number !== null && valid(number)) return number;
      issues.push(`Потрібні дані міцності: ${label}.`);
      return null;
    };
    const calc = (args,formula) => {
      if (args.some(value => value === null)) return null;
      const value = formula(...args);
      if (Number.isFinite(value)) return value;
      issues.push('Результат міцності виходить за числовий діапазон.');
      return null;
    };
    const hydro = input.mode === 'hydro';
    const validMode = hydro || input.mode === 'normal';
    if (!validMode) issues.push('Не визначено режим перевірки міцності.');
    const rp = read(input.yieldMPa,'Rp кріплення');
    const n = read(input.count,'ціла додатна кількість',value => value > 0 && Number.isInteger(value));
    const area = read(input.smoothArea,'площа гладкого перерізу');
    const diameter = read(input.diameter,'номінальний діаметр');
    const rootDiameter = read(input.rootDiameter,'діаметр d₃',value => value > 0 && diameter !== null && value < diameter);
    const hole = read(input.axialHoleDiameter,'поздовжній отвір',value => value >= 0 && rootDiameter !== null && value < rootDiameter);
    const initial = read(input.initialTotal,'початкове сумарне зусилля',value => value >= 0);
    const single = read(input.initialSingle,'початкове зусилля одного кріплення',value => value >= 0);
    const pressure = read(input.hydrostatic,'гідростатичне зусилля',value => value >= 0);
    const chi = read(input.loadFactor,'коефіцієнт χ',value => value >= 0 && value <= 1);
    const thermal = read(input.thermalForce,'температурне зусилля',() => true);
    const torsionFactor = read(input.torsionFactor,'коефіцієнт ζ');
    const values = {};
    values.allowable = validMode ? calc([rp],value => hydro ? 0.7 * value : value / 2) : null;
    values.axial = calc([initial,chi,pressure,area,n],(f,c,p,a,z) => (f+c*p)/(a*z));
    values.thermalAxial = hydro ? null : calc([initial,chi,pressure,thermal,area,n],(f,c,p,t,a,z) => (f+c*p+t)/(a*z));
    values.thermalAllowable = hydro ? null : calc([values.allowable],value => value * 1.3);
    values.torsionMoment = calc([single,torsionFactor,rootDiameter],(f,k,d) => f*k*d);
    values.torsionModulus = calc([diameter,hole],(d,h) => 0.196*(d**4-h**4)/d);
    values.torsion = calc([values.torsionMoment,values.torsionModulus],(m,w) => m/w);
    values.torsionAllowable = validMode ? calc([rp],value => value / 4) : null;
    values.equivalent = hydro ? null : calc([values.thermalAxial,values.torsion],(s,t) => Math.sqrt(s*s+4*t*t));
    values.equivalentAllowable = hydro ? null : calc([values.allowable],value => value * 1.7);
    function check(actual,allowable,active = true) {
      return {active,actual:active ? actual : null,allowable:active ? allowable : null,
        margin:active && actual > 0 && allowable !== null ? allowable/actual : null,
        passed:!active || actual === null || allowable === null ? null : actual >= 0 && actual <= allowable};
    }
    const checks = {
      axial:check(values.axial,values.allowable),
      thermalAxial:check(values.thermalAxial,values.thermalAllowable,!hydro),
      equivalent:check(values.equivalent,values.equivalentAllowable,!hydro),
      torsion:check(values.torsion,values.torsionAllowable)
    };
    const totalForce = calc([initial,chi,pressure,thermal],(f,c,p,t) => f+c*p+t);
    function thread(d,height,k1,km,yieldStrength,body = false,active = true) {
      if (!active) return {height:null,k1:null,km:null,area:null,...check(null,null,false)};
      const h = read(height,'висота робочої частини різьби');
      const a = calc([d,h,n],(d,h,z) => Math.PI*d*h*z*k1*km);
      const materialYield = body ? read(yieldStrength,'Rp корпусу') : yieldStrength;
      const allowable = validMode ? calc([materialYield],value => body || !hydro ? (value/2)*0.64 : value*0.25) : null;
      return {height:h,k1,km,area:a,...check(calc([totalForce,a],(f,a) => f/a),allowable)};
    }
    // C43/C44, C78/C79 and C96/C97: fixed source-workbook coefficients.
    const hasNut = input.nutActive !== false;
    const nutYield = hasNut ? read(input.nutYieldMPa,'Rp гайки') : null;
    const threads = {
      fastenerNut:thread(rootDiameter,input.nutHeight,0.75,0.55,rp,false,hasNut),
      fastenerBody:thread(rootDiameter,input.bodyHeight,0.75,0.65,rp,false,input.bodyThreadActive === true),
      nut:thread(diameter,input.nutHeight,0.87,0.55,nutYield,false,hasNut),
      body:thread(diameter,input.bodyHeight,0.87,0.65,input.bodyYieldMPa,true,input.bodyThreadActive === true)
    };
    if (input.secondNut) {
      threads.fastenerNutB = thread(rootDiameter,input.secondNut.height,0.75,0.55,rp);
      threads.nutB = thread(diameter,input.secondNut.height,0.87,0.55,read(input.secondNut.yield,'Rp другої гайки'));
    }
    return {values,checks,threads,issues:[...new Set(issues)]};
  }

  function nodeStrength(node,materials,catalog) {
    const geometry = nodeGeometry(node,catalog).thread.values;
    const forces = nodeForces(node,materials,catalog);
    const compliance = nodeCompliance(node,materials,catalog);
    const mount = C.mounting(node);
    function heightOf(nut) {
      const size = C.nutDimensions(catalog,nut.standardId,node.fastener.nominalDiameter,nut.typeId);
      if (size?.typeId !== 'B') return size?.heightMm;
      const h = C.number(nut.threadedHeight);
      return h > 0 && h <= size.heightMm ? h : null;
    }
    const second = mount.nuts.length === 2 && C.nutAt(node,'nutB');
    const torsionFactor = node.fastener.lubricated === true ? 0.13 : node.fastener.lubricated === false ? 0.18 : null;
    const bodyMaterial = C.resolveMaterial(materials,node.connection[mount.body]?.material);
    const bodyIsCastIron = /чавун|сч\s*\d/u.test(C.canonical(bodyMaterial?.material.name || ''));
    const bodyHasYieldEntry = Object.values(bodyMaterial?.grade.data?.RTp || {}).some(value => value !== null && value !== undefined && !['','—','-'].includes(String(value).trim()));
    const states = {};
    for (const mode of ['normal','hydro']) {
      const sources = [], issues = [];
      const t = C.number(node.operating[mode].temperature);
      function yieldStrength(ref,label) {
        const resolved = C.resolveMaterial(materials,ref);
        const property = t !== null && t >= -273.15 ? C.propertyAt(resolved?.grade,'RTp',t) : null;
        if (!property || !(property.value > 0)) {
          issues.push(`${label}: виберіть матеріал із Rp для температури ${mode === 'normal' ? 'НУЕ' : 'ГВ'}.`);
          return null;
        }
        sources.push({name:label,temperature:property.temperature,valueMPa:property.value});
        return property.value;
      }
      const result = strength({mode,...geometry,...forces.states[mode].values,
        diameter:node.fastener.nominalDiameter,axialHoleDiameter:node.fastener.axialHoleDiameter ?? '0',count:node.fastener.count,
        loadFactor:compliance.states[mode].values.loadFactor,thermalForce:forces.states[mode].values.thermal,
        torsionFactor,yieldMPa:yieldStrength(node.fastener.material,'Кріплення'),nutActive:!!mount.nuts.length,
        nutYieldMPa:mount.nuts.length ? yieldStrength(node.nut.material,'Гайка') : null,nutHeight:heightOf(node.nut),
        secondNut:second && {height:heightOf(second),yield:yieldStrength(second.material,'Друга гайка')},
        bodyThreadActive:!!mount.body,bodyHeight:engagementHeight(node,mount),
        bodyYieldMPa:mount.body ? yieldStrength(node.connection[mount.body].material,'Корпус') : null
      });
      // User chose Excel's omission for the cast-iron body with no Rp table.
      // A material with Rp at other temperatures is still pending, never skipped.
      const omitted = result.threads.body.active && bodyIsCastIron && !bodyHasYieldEntry && result.threads.body.allowable === null;
      if (omitted) result.threads.body.omittedFromMaximum = 'excel-missing-cast-iron-rp';
      states[mode] = {...result,sources,issues:[...new Set([...issues,...result.issues])].filter(issue => !(omitted && (issue.includes('Rp корпусу') || issue.startsWith('Корпус:')))),
        warnings:omitted ? ['Внутрішню різьбу чавунного корпусу без Rp пропущено при визначенні максимуму, як у вихідному Excel. Міцність цієї різьби не підтверджена.'] : []};
    }
    return {states,torsionFactor};
  }
  function flange(input = {}) {
    const issues = [];
    const read = (key,label,zero = false) => {
      const value = C.number(input[key]);
      if (value !== null && (zero ? value >= 0 : value > 0)) return value;
      issues.push(`Фланець: задайте ${label}.`); return null;
    };
    const calc = (args,formula) => {
      if (args.some(value => value === null)) return null;
      const value = formula(...args);
      return Number.isFinite(value) ? value : null;
    };
    const d = read('innerDiameter','внутрішній діаметр D'), dw = read('boltCircle','діаметр кола кріплень Dw');
    const df = read('outerDiameter','зовнішній діаметр Df'), hole = read('holeDiameter','діаметр отвору d₀');
    const h = read('height','висоту hf'), h2 = read('coneHeight','висоту конічної частини h₂',true);
    const s1 = read('wallCylinder','товщину s₁'), s2 = read('wallCone','товщину s₂'), dm = read('gasketDiameter','розрахунковий діаметр прокладки Dm');
    const known = [d,dw,df,hole,h,h2,s1,s2,dm].every(value => value !== null);
    const validGeometry = known && d < dw && dw < df && dm > d && dm < df && df-d-2*hole > 0;
    if (known && !validGeometry) issues.push('Фланець: потрібні D < Dw < Df, D < Dm < Df та додатна перемичка Df−D−2d₀.');
    const normal = input.mode === 'normal', hydro = input.mode === 'hydro';
    const rm = C.positive(input.ultimateMPa) ? C.number(input.ultimateMPa) : null;
    const rp = C.positive(input.yieldMPa) ? C.number(input.yieldMPa) : null;
    const values = {e1:null,e2:null,e3:null,y:null,s0:null,WA:null,WB:null,WC:null,allowable:null,moment:null};
    // Preserve Excel's explicit IFERROR fallback when only one strength is known.
    const baseCandidates = [rm === null ? null : rm/2.6,rp === null ? null : rp/1.5].filter(value => value !== null);
    values.allowable = normal && input.castIron ? (rm === null ? null : rm/2.2) : baseCandidates.length ? Math.min(...baseCandidates) : null;
    if (!normal && !hydro) values.allowable = null;
    if (!(values.allowable > 0)) { values.allowable = null; issues.push('Фланець: немає характеристик для допустимого напруження.'); }
    const pressure = read('pressure','тиск режиму',true);
    const force = C.number(input.fastenerForce), hydrostatic = C.number(input.hydrostatic);
    const load = C.number(input.pressureLoad), thermal = C.number(input.thermalForce);
    if (validGeometry) {
      values.e1 = (dw-d-s1)/2; values.e2 = Math.abs(dw-dm)/2; values.e3 = (dw-(dm+d)/2)/2;
      values.y = ((s1+s2)*h*h2+0.33*h2*h2*(s2+2*s1)+0.5*h*h*(df-d-2*hole))/((s1+s2)*h2+(df-d-2*hole)*h);
      values.s0 = calc([pressure,values.allowable],(p,s) => p*d/(2*s));
      values.WA = calc([values.s0],s0 => Math.PI/4*((df-d-2*hole)*h*h+(d+s2)*(s2*s2-s0*s0/4)));
      values.WB = calc([values.s0],s0 => values.y > h
        ? 2*Math.PI*((s2-s0)*(h+h2-values.y)**3/(3*h2)+s1*(h+h2-values.y)**2+0.125*(d+s1)*(s1*s1-s0*s0/4))
        : Math.PI*((df-d-2*hole)*values.y**2+0.25*(d+s1)*(s1*s1-s0*s0/4)));
      if (h <= s2) values.WC = Math.PI*(df-2*hole)*h*h/4;
      for (const key of ['WA','WB','WC']) if (values[key] !== null && !(values[key] > 0)) { values[key] = null; issues.push(`Фланець: момент опору ${key} має бути додатним.`); }
      values.moment = calc([force],f => f*values.e2/1000);
    }
    const cExempt = validGeometry && h > s2;
    const allowablePressure = normal && input.castIron ? values.allowable : calc([values.allowable],s => s*(hydro ? 1.7 : 1.3));
    const steelBending = rp === null ? null : rm === null ? 2*rp : Math.min((2.5-rp/rm)*rp,2*rp);
    const allowableBending = normal ? (input.castIron ? values.allowable : steelBending) : null;
    const check = (actual,allowable,active = true,reason = '') => ({active,reason,actual:active ? actual : null,allowable:active ? allowable : null,
      margin:active && actual > 0 && allowable !== null ? allowable/actual : null,
      passed:!active || actual === null || allowable === null ? null : actual >= 0 && allowable > 0 && actual <= allowable});
    const pressureStress = thickness => validGeometry && thickness !== null && hydrostatic !== null && hydrostatic >= 0 ? 4*hydrostatic/(Math.PI*((d+2*thickness)**2-d*d)) : null;
    const checks = {
      pressureA:check(pressureStress(s2),allowablePressure),pressureB:check(pressureStress(s1),allowablePressure)
    };
    const bounds = [];
    for (const [section,key] of [['A','WA'],['B','WB'],['C','WC']]) {
      const active = !hydro && !(section === 'C' && cExempt);
      const reason = hydro ? 'hydro-not-in-source' : section === 'C' && cExempt ? 'hf-above-s2' : '';
      // W46 keeps the Rp/Rm expression even for cast iron; R46 has the cast-iron branch.
      const sectionAllowable = section === 'C' && input.castIron && !input.castIronC ? steelBending : allowableBending;
      const actual = validGeometry && values[key] !== null ? calc([force],f => f*values.e2/values[key]) : null;
      checks['bending'+section] = check(actual,sectionAllowable,active,reason);
      if (active && sectionAllowable === null) issues.push(`Фланець: недостатні характеристики для перерізу ${section}–${section}.`);
      const unbounded = active && validGeometry && values.e2 === 0 && values[key] !== null && sectionAllowable > 0;
      const upperForce = active && !unbounded && validGeometry && values.e2 > 0 && values[key] !== null
        ? calc([sectionAllowable,load,thermal],(s,p,t) => s*values[key]/values.e2-p-t) : null;
      bounds.push({key:'bending'+section,section,active:active && !unbounded,unbounded,reason:unbounded ? 'zero-lever' : reason,force:upperForce});
    }
    if (!normal && !hydro) issues.push('Фланець: не визначено режим.');
    if (normal && allowableBending === null) issues.push('Фланець: немає Rp для приведених напружень (або Rm для чавуну).');
    return {values,checks,bounds,issues:[...new Set(issues)],validGeometry,cExempt,castIron:!!input.castIron};
  }

  function automaticHoleDiameter(nominalDiameter) {
    if (C.automaticHoleDiameter) return C.automaticHoleDiameter(nominalDiameter);
    const d = C.number(nominalDiameter);
    if (!d || d <= 0) return null;
    return d + (d >= 27 ? 3 : d > 10 ? 2 : 1);
  }

  function flangeGeometryAdvisories({boltCircle, count, holeDiameter, outerDiameter, innerDiameter} = {}) {
    const Dw = C.number(boltCircle);
    const z = C.number(count);
    const d0 = C.number(holeDiameter);
    const Df = C.number(outerDiameter);
    const D = C.number(innerDiameter);

    const pitch = (Dw > 0 && z > 0) ? (Math.PI * Dw) / z : null;
    const pitchRatio = (pitch !== null && d0 > 0) ? pitch / d0 : null;
    const edgeOuter = (Df > 0 && Dw > 0) ? (Df - Dw) / 2 : null;
    const edgeInner = (Dw > 0 && D > 0) ? (Dw - D) / 2 : null;

    const warnings = [];
    if (pitchRatio !== null) {
      if (pitchRatio < 2.5) {
        warnings.push(`Крок кріплень малий (t_b = ${pitch.toFixed(1).replace('.', ',')} мм, ${pitchRatio.toFixed(2).replace('.', ',')} d₀ < 2,5 d₀): ускладнений монтаж ключем.`);
      } else if (pitchRatio > 6) {
        warnings.push(`Крок кріплень великий (t_b = ${pitch.toFixed(1).replace('.', ',')} мм, ${pitchRatio.toFixed(2).replace('.', ',')} d₀ > 6 d₀): ризик нерівномірного обтиснення прокладки.`);
      }
    }
    if (d0 > 0) {
      if (edgeOuter !== null && edgeOuter > 0 && edgeOuter < d0) {
        warnings.push(`Зовнішня кромка фланця мала (${edgeOuter.toFixed(1).replace('.', ',')} мм < d₀ = ${C.formatNumber(d0)} мм).`);
      }
      if (edgeInner !== null && edgeInner > 0 && edgeInner < d0) {
        warnings.push(`Внутрішня кромка фланця мала (${edgeInner.toFixed(1).replace('.', ',')} мм < d₀ = ${C.formatNumber(d0)} мм).`);
      }
    }

    return {
      boltPitch: pitch,
      pitchRatio,
      edgeOuter,
      edgeInner,
      warnings
    };
  }

  function nodeFlanges(node,materials,catalog,calculatedForces) {
    const forces = calculatedForces || nodeForces(node,materials,catalog);
    const compliance = nodeCompliance(node,materials,catalog);
    const mean = nodeGeometry(node,catalog).gasket.values.meanDiameter;
    const sides = {}, candidates = [];
    for (const side of ['sideA','sideB']) {
      const config = node.flanges?.[side] || C.createFlange();
      const part = node.connection[side];
      const result = {mode:config.mode,name:part.name || (side === 'sideA' ? 'Деталь А' : 'Деталь Б'),states:{}};
      sides[side] = result;
      if (config.mode !== 'flange') continue;
      const resolved = C.resolveMaterial(materials,part.material);
      const castIron = /чавун|сч\s*\d/u.test(C.canonical(resolved?.material.name || ''));
      for (const mode of ['normal','hydro']) {
        const sources = [];
        const t = C.number(node.operating[mode].temperature);
        const property = key => {
          const value = t !== null && t >= -273.15 ? C.propertyAt(resolved?.grade,key,t) : null;
          if (value && value.value > 0) { sources.push({key,temperature:value.temperature,valueMPa:value.value}); return value.value; }
          return null;
        };
        const automaticHole = automaticHoleDiameter(node.fastener.nominalDiameter);
        const forceValues = forces.states[mode].values;
        const chi = compliance.states[mode].values.loadFactor;
        const calculation = flange({...config,mode,castIron,castIronC:side === 'sideB',
          holeDiameter:String(config.holeDiameter ?? '').trim() === '' ? automaticHole : config.holeDiameter,
          gasketDiameter:node.gasket.mode === 'ring' ? mean : config.gasketDiameter,
          pressure:node.operating[mode].pressure,ultimateMPa:property('RTm'),yieldMPa:property('RTp'),
          hydrostatic:forceValues.hydrostatic,fastenerForce:forceValues.fastener,
          pressureLoad:chi !== null && forceValues.hydrostatic !== null ? chi*forceValues.hydrostatic : null,thermalForce:forceValues.thermal
        });
        result.states[mode] = {...calculation,sources};
        for (const bound of calculation.bounds) candidates.push({...bound,mode,side,cell:(mode === 'normal' ? 'N' : 'O')+((side === 'sideB' ? 76 : 80)+['A','B','C'].indexOf(bound.section))});
      }
    }
    return {sides,candidates,configured:Object.values(sides).every(side => ['flange','none'].includes(side.mode))};
  }

  function maximum(input = {}) {
    const candidates = [], issues = [];
    const calculate = (args,formula) => {
      if (!args.every(value => typeof value === 'number' && Number.isFinite(value))) return null;
      const value = formula(...args);
      return Number.isFinite(value) ? value : null;
    };
    for (const mode of ['normal','hydro']) {
      const state = input.states?.[mode] || {};
      const c = mode === 'normal' ? 'N' : 'O';
      const allowance = C.positive(state.allowable) ? C.number(state.allowable) : null;
      const area = C.positive(input.smoothArea) ? C.number(input.smoothArea) : null;
      const n = C.number(input.count);
      const count = n > 0 && Number.isInteger(n) ? n : null;
      const chi = C.number(state.loadFactor), pressure = C.number(state.hydrostatic);
      const pressureLoad = chi !== null && chi >= 0 && chi <= 1 && pressure !== null && pressure >= 0 ? calculate([chi,pressure],(c,p) => c*p) : null;
      const thermal = C.number(state.thermalForce);
      const base = calculate([allowance,area,count,pressureLoad],(s,a,z,p) => s*a*z-p);
      candidates.push({mode,key:'axial',cell:c+'66',active:true,force:base});
      // Literal N67/O67: N5/O5 (not 1.3*N5), +Ft for NUE and -Ft for HV.
      candidates.push({mode,key:'thermalAxial',cell:c+'67',active:true,force:calculate([base,thermal],(f,t) => mode === 'normal' ? f+t : f-t)});
      for (const [key,row] of [['fastenerNut',71],[state.threads?.fastenerNutB ? 'fastenerNutB' : 'fastenerBody',72],['nut',73],[state.threads?.nutB ? 'nutB' : 'body',74]]) {
        const thread = state.threads?.[key];
        const omittedFromMaximum = key === 'body' && thread?.omittedFromMaximum === 'excel-missing-cast-iron-rp';
        const active = !omittedFromMaximum && thread?.active !== false;
        const threadArea = C.positive(thread?.area) ? C.number(thread.area) : null;
        const allowable = C.positive(thread?.allowable) ? C.number(thread.allowable) : null;
        const force = active ? calculate([threadArea,allowable,pressureLoad,thermal],(a,s,p,t) => a*s-p-t) : null;
        candidates.push({mode,key,cell:c+row,active,force,omittedFromMaximum});
      }
    }
    candidates.push(...(input.flangeCandidates || []));
    const active = candidates.filter(item => item.active);
    for (const item of active) if (typeof item.force !== 'number' || !Number.isFinite(item.force)) issues.push(`Недостатні дані для верхнього обмеження ${item.cell}.`);
    const force = active.every(item => typeof item.force === 'number' && Number.isFinite(item.force)) ? Math.min(...active.map(item => item.force)) : null;
    const d = C.number(input.diameter), n = C.number(input.count), friction = C.number(input.friction);
    const torque = d > 0 && n > 0 && Number.isInteger(n) && friction > 0 ? calculate([force,d,friction,n],(f,d,k,z) => f*d*k/(z*1000)) : null;
    if (torque === null && force !== null) issues.push('Для моменту потрібні діаметр, кількість кріплень та коефіцієнт ζ₁.');
    const omitted = candidates.filter(item => item.omittedFromMaximum);
    return {force,torqueNm:torque,roundedTorqueNm:torque === null ? null : Math.floor(torque),omitted,
      candidates,governing:force === null ? [] : active.filter(item => item.force === force),issues,
      scope:input.flangesConfigured ? 'all-configured-parts' : candidates.some(item => item.side) ? 'configured-flanges-only' : 'fastener-thread-only',complete:!!input.flangesConfigured && torque !== null && !omitted.length};
  }

  function nodeLimits(node,materials,catalog) {
    const inputValidation = C.validateInputs(node,catalog);
    const forces = nodeForces(node,materials,catalog);
    const strength = nodeStrength(node,materials,catalog);
    const compliance = nodeCompliance(node,materials,catalog);
    const geometry = nodeGeometry(node,catalog).thread.values;
    const states = {};
    for (const mode of ['normal','hydro']) states[mode] = {
      allowable:strength.states[mode].values.allowable,threads:strength.states[mode].threads,
      loadFactor:compliance.states[mode].values.loadFactor,hydrostatic:forces.states[mode].values.hydrostatic,
      thermalForce:forces.states[mode].values.thermal
    };
    const flanges = nodeFlanges(node,materials,catalog,forces);
    const upper = maximum({states,smoothArea:geometry.smoothArea,count:node.fastener.count,diameter:node.fastener.nominalDiameter,friction:forces.friction,flangeCandidates:flanges.candidates,flangesConfigured:flanges.configured});
    const lower = forces.minimum;
    const rawOverlap = lower.torqueNm === null || upper.torqueNm === null ? null : lower.torqueNm <= upper.torqueNm;
    const roundedOverlap = lower.roundedTorqueNm === null || upper.roundedTorqueNm === null ? null : lower.roundedTorqueNm <= upper.roundedTorqueNm;
    function verify(torqueNm) {
      if (torqueNm === null || torqueNm < 0) return null;
      const trial = {...node,fastener:{...node.fastener,torqueNm:String(torqueNm)}};
      const f = nodeForces(trial,materials,catalog), s = nodeStrength(trial,materials,catalog);
      const trialFlanges = nodeFlanges(trial,materials,catalog,f);
      const checks = [];
      for (const mode of ['normal','hydro']) {
        for (const [key,check] of Object.entries(f.states[mode].checks)) checks.push({mode,group:'gasket',key,passed:check.passed});
        for (const group of ['checks','threads']) for (const [key,check] of Object.entries(s.states[mode][group])) if (check.active) checks.push({mode,group,key,passed:check.passed,omitted:!!check.omittedFromMaximum});
      }
      for (const [side,part] of Object.entries(trialFlanges.sides)) if (part.mode === 'flange') for (const mode of ['normal','hydro']) for (const [key,check] of Object.entries(part.states[mode].checks)) if (check.active) checks.push({mode,group:'flanges',side,key,passed:check.passed});
      return {torqueNm,checks,failed:checks.filter(check => check.passed === false),pending:checks.filter(check => check.passed === null && !check.omitted),omitted:checks.filter(check => check.omitted)};
    }
    const verification = {minimum:verify(lower.roundedTorqueNm),maximum:verify(upper.roundedTorqueNm)};
    const complete = !Object.keys(inputValidation.errors).length && flanges.configured && lower.torqueNm !== null && upper.torqueNm !== null && Object.values(verification).every(result => result && !result.pending.length && !result.omitted.length);
    return {minimum:lower,maximum:upper,rawOverlap,roundedOverlap,verification,flanges,complete,inputErrors:inputValidation.errors,
      rangePassed:complete && roundedOverlap && Object.values(verification).every(result => !result.failed.length)};
  }
  const api = { automaticHoleDiameter, flangeGeometryAdvisories, gasketGeometry, threadGeometry, packageLengths, nodeGeometry, compliance, nodeCompliance, linearExpansion, thermalForce, nodeThermal, forces, nodeForces, strength, nodeStrength, flange, nodeFlanges, maximum, nodeLimits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlangeCalculations = api;
})(globalThis);
