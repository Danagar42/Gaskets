(function (root) {
  'use strict';
  const sections = ['operating', 'gasket', 'fastener', 'connection', 'nut', 'washers', 'extras'];
  const id = () => root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const timestamp = () => new Date().toISOString();
  function createEquipment(name, designation = '') {
    return { id: id(), name: name.trim(), designation: designation.trim(), createdAt: timestamp(), updatedAt: timestamp(), nodes: [] };
  }
  function createNode(name, kind = 'body-cover') {
    return {
      id: id(), name: name.trim(), createdAt: timestamp(), updatedAt: timestamp(),
      operating: { normal: { pressure: '', temperature: '', medium: '' }, hydro: { pressure: '', temperature: '', medium: '' } },
      gasket: { mode: 'ring', thickness: '', outerDiameter: '', innerDiameter: '', hasHoles: false, holeDiameter: '', effectiveArea: '', pressureArea: '' },
      fastener: { type: 'stud', nominalDiameter: '', count: '', lubricated: true, material: null, threadStandardId: 'gost-24705-2004', pitch: '' },
      connection: { kind, sideA: { name: kind === 'flange-flange' ? 'Фланець 1' : 'Кришка', material: null }, sideB: { name: kind === 'flange-flange' ? 'Фланець 2' : 'Корпус', material: null } },
      nut: { material: null, standardId: 'gost-5915-70' }, washers: { placement: 'none', material: null, standardId: 'gost-11371-78', accuracyClass: 'A', execution: '1' }, extras: []
    };
  }
  function number(value) {
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
  function nutDimensions(catalog, standardId, nominalDiameter) {
    const standard = catalog?.nuts?.[standardId];
    const diameter = number(nominalDiameter);
    if (!standard || diameter === null || diameter <= 0) return null;
    const row = standard.sizes?.[String(diameter)];
    if (!positive(row?.heightMm)) return null;
    return {
      document: standard.document,
      nominalDiameterMm: diameter,
      heightMm: row.heightMm,
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
  function sectionStatus(node, materials, standardsDb) {
    const validMaterial = (ref, properties = ['RTm','RTp','E','Alpha']) => !!resolveMaterial(materials, ref) && !missingProperties(materials, ref, node.operating, properties).length;
    const result = {};
    const cases = Object.values(node.operating);
    result.operating = cases.every(item => number(item.pressure) !== null && number(item.pressure) >= 0 && number(item.temperature) !== null && number(item.temperature) >= -273.15 && !!item.medium);
    const gasket = node.gasket;
    result.gasket = positive(gasket.thickness) && (gasket.mode === 'area'
      ? positive(gasket.effectiveArea) && positive(gasket.pressureArea)
      : positive(gasket.outerDiameter) && positive(gasket.innerDiameter) && number(gasket.outerDiameter) > number(gasket.innerDiameter) && (!gasket.hasHoles || positive(gasket.holeDiameter)));
    result.fastener = positive(node.fastener.nominalDiameter) && positive(node.fastener.count) && Number.isInteger(number(node.fastener.count)) && validMaterial(node.fastener.material) && (!standardsDb?.threads || !!threadPitch(standardsDb, node.fastener.threadStandardId || 'gost-24705-2004', node.fastener.nominalDiameter, node.fastener.pitch || ''));
    result.connection = !!node.connection.sideA.name.trim() && !!node.connection.sideB.name.trim() && validMaterial(node.connection.sideA.material) && validMaterial(node.connection.sideB.material);
    result.nut = validMaterial(node.nut.material, ['RTm','RTp']) && (!standardsDb || !!nutDimensions(standardsDb, node.nut.standardId || 'gost-5915-70', node.fastener.nominalDiameter));
    result.washers = node.washers.placement === 'none' || (validMaterial(node.washers.material, ['E','Alpha']) && (!standardsDb || !!washerDimensions(standardsDb, node.washers.standardId || 'gost-11371-78', node.fastener.nominalDiameter, node.washers.accuracyClass || 'A', node.washers.execution || '1')));
    result.extras = node.extras.every(item => !!item.name.trim() && positive(item.thickness) && positive(item.area) && validMaterial(item.material, ['E','Alpha']));
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
      return ['normal','hydro'].every(key => node.operating[key] && ['pressure','temperature','medium'].every(field => isText(node.operating[key][field]))) && typeof node.gasket.hasHoles === 'boolean' && typeof node.fastener.lubricated === 'boolean'
        && ['fastener.material','connection.sideA.material','connection.sideB.material','nut.material','washers.material'].every(path => isRef(get(node, path)))
        && ['threadStandardId','pitch'].every(key => node.fastener[key] === undefined || isText(node.fastener[key])) && (node.nut.standardId === undefined || isText(node.nut.standardId)) && ['standardId','accuracyClass','execution'].every(key => node.washers[key] === undefined || isText(node.washers[key])) && node.extras.every(extra => validId(extra) && isText(extra.name) && isText(extra.thickness) && isText(extra.area) && isRef(extra.material));
    }));
  }
  const api = { id, timestamp, sections, createEquipment, createNode, number, positive, canonical, materialRef, resolveMaterial, propertyAt, washerDimensions, nutDimensions, threadPitch, missingProperties, cleanDescription, get, set, sectionStatus, progress, validateWorkspace };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlangeCore = api;
})(globalThis);
