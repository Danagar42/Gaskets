(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.FlangeCore;
  const FORMAT = 'flange-workspace';
  const MAX_BYTES = 10 * 1024 * 1024;
  const fitsFile = text => text.length <= MAX_BYTES && new TextEncoder().encode(text).byteLength <= MAX_BYTES;
  function normalize(value) {
    if (!C.validateWorkspace(value)) throw new Error('Файл не є проєктом «Прокладки» підтримуваної версії.');
    const result = JSON.parse(JSON.stringify(value));
    result.folders ??= [];
    result.preferences = Object.fromEntries(['recent','favorites'].map(key => [key,
      Array.isArray(value.preferences?.[key]) ? value.preferences[key].filter(item => typeof item === 'string') : []]));
    for (const equipment of result.equipment) {
      for (const item of [equipment,...equipment.nodes,...equipment.nodes.flatMap(node => node.extras)]) {
        if (!/^[\w-]{1,100}$/.test(item.id)) throw new Error('Файл містить некоректний ідентифікатор.');
        for (const key of ['createdAt','updatedAt']) if (item[key] !== undefined && typeof item[key] !== 'string') throw new Error('Файл містить некоректну дату створення або зміни.');
      }
      for (const node of equipment.nodes) {
        node.fastener = {...C.createNode('').fastener,...node.fastener};
        node.flanges ??= {sideA:C.createFlange(),sideB:C.createFlange()};
        for (const side of ['sideA','sideB']) {
          node.connection[side].height ??= '';
          node.connection[side].area ??= '';
        }
        node.gasket.referenceId ||= C.DEFAULT_GASKET_REFERENCE_ID;
        node.gasket.partitionPattern ??= 'none';
        node.gasket.partitionWidth ??= '';
        node.nut = {...C.createNode('').nut,...node.nut};
        node.washers = {...C.createNode('').washers,...node.washers};
      }
    }
    return result;
  }
  function parse(text) {
    if (!fitsFile(text)) throw new Error('Розмір проєкту перевищує 10 МБ.');
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/,'')); }
    catch { throw new Error('Не вдалося прочитати JSON. Файл пошкоджений або має інший формат.'); }
    if (data?.format !== undefined && data.format !== FORMAT) throw new Error('Невідомий формат проєкту.');
    return normalize(data);
  }
  function serialize(workspace) {
    const data = {...normalize(workspace),format:FORMAT,exportedAt:C.timestamp()};
    const readable = JSON.stringify(data,null,2);
    if (fitsFile(readable)) return readable;
    const compact = JSON.stringify(data);
    if (!fitsFile(compact)) throw new Error('Розмір проєкту перевищує 10 МБ навіть без відступів. Резервний файл не сформовано.');
    return compact;
  }
  function combine(current, incoming, mode) {
    const imported = normalize(incoming);
    if (mode === 'replace') return imported;
    if (mode !== 'add') throw new Error('Невідомий спосіб імпорту.');
    const target = normalize(current);
    const folderIds = new Map(imported.folders.map(folder => [folder.id,C.id()]));
    for (const folder of imported.folders) {
      target.folders.push({...folder,id:folderIds.get(folder.id),parentId:folderIds.get(folder.parentId) ?? null});
    }
    for (const equipment of imported.equipment) {
      equipment.id = C.id();
      if (equipment.folderId != null) equipment.folderId = folderIds.get(equipment.folderId);
      for (const node of equipment.nodes) {
        node.id = C.id();
        node.extras.forEach(extra => { extra.id = C.id(); });
      }
      target.equipment.push(equipment);
    }
    return target;
  }
  const api = {MAX_BYTES,normalize,parse,serialize,combine};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlangeProject = api;
})(typeof window !== 'undefined' ? window : globalThis);
