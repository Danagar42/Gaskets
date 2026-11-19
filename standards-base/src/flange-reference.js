'use strict';
(function(root) {
  const drawing = typeof module === 'object' && module.exports ? require('../../flange-picker-drawing.js') : root.FlangePickerDrawing;
  const format = new Intl.NumberFormat('uk-UA',{useGrouping:false, maximumFractionDigits:12});
  const documents = {
    '12820': {title:'Фланці сталеві плоскі приварні', changes:'1–4', url:'https://files.stroyinf.ru/Data2/1/4294848/4294848681.pdf'},
    '12821': {title:'Фланці сталеві приварні встик (комірцеві)', changes:'1–4', url:'https://files.stroyinf.ru/Data/142/14272.pdf'},
    '12815': {title:'Приєднувальні розміри й ущільнювальні поверхні', changes:'1–5 і поправка', url:'https://files.stroyinf.ru/Data2/1/4294848/4294848686.pdf'},
    '12816': {title:'Загальні технічні вимоги до фланців', changes:'1–3', url:'https://files.stroyinf.ru/Data2/1/4294848/4294848685.pdf'}
  };
  const rule19 = 'Пункт 1.9 ГОСТ 12816-80 пояснює допустимість різної товщини фланців за однакових приєднувальних розмірів у випадках, передбачених стандартом.';
  const bodyStandards = ['12820','12821'];
  const code = number => `ГОСТ ${number}-80`;
  const column = (key,label,unit = '') => ({key,label,unit});
  const labelForDimension = key => ({D:'Зовнішній діаметр D', D1:'Коло отворів D₁', bore:'Отвір фланця',
    b:'Товщина диска b', d:'Діаметр отвору d', n:'Кількість отворів n'})[key] || drawing.dimensions[key] || key;

  function makeEntry(number, rows) {
    const dn = rows.map(row => row.dn);
    const pressure = rows.map(row => row.pressure);
    return {id:`gost-${number}-80`, categoryId:'flanges', document:code(number), title:documents[number].title,
      range:rows.length ? `DN ${Math.min(...dn)}–${Math.max(...dn)} · PN ${format.format(Math.min(...pressure))}–${format.format(Math.max(...pressure))} МПа` : null,
      aliases:[]};
  }

  function listEntries(catalog) {
    if (!catalog?.rows?.length) return [];
    return Object.keys(documents).sort((a,b) => Number(bodyStandards.includes(b)) - Number(bodyStandards.includes(a)))
      .map(number => makeEntry(number,catalog.rows.filter(row => row.standard === number)));
  }

  function source(catalog, number, section = '') {
    const {changes,url} = documents[number];
    return {label:code(number), edition:`Липень 2003, зміни № ${changes}`, url, section, documentId:catalog.sources?.[number]};
  }

  function location(reference) {
    return reference ? `Табл. ${reference[0]}, с. ${reference[1]} PDF` : '';
  }

  function formatConflict(reference) {
    const value = number => number == null ? '—' : format.format(number);
    return `${reference.column || 'Розмір'} · КОМПАС ${value(reference.kompas)}, ГОСТ ${value(reference.gost)}. ` +
      `${code(reference.standard)}, ${location([reference.table,reference.page])}.`;
  }

  function getCard(catalog, id, filters = {}, selectedId = null) {
    const number = /^gost-(1281[56]|1282[01])-80$/.exec(id)?.[1];
    if (!number || !catalog?.rows?.length) return null;
    let rows = catalog.rows.filter(row => row.standard === number);
    const card = {entry:makeEntry(number,rows), filters:[], tables:[], drawingKind:null, sources:[], notes:[],
      selectedRow:null, face:null, dimensionOrigins:{}, related:[]};
    if (!bodyStandards.includes(number)) {
      card.sources.push(source(catalog,number,number === '12816' ? 'Пункт 1.9' : 'Оцифровані приєднувальні розміри та виконання'));
      card.notes.push(number === '12816' ? rule19 :
        'У картках ГОСТ 12820-80 і ГОСТ 12821-80 наведені застосовні діаметри, кріплення та ущільнювальні поверхні з цього стандарту.');
      card.related = bodyStandards.map(item => makeEntry(item,[]));
      return card;
    }

    for (const [key,label,display] of [
      ['dn','Номінальний прохід DN', value => `DN ${value}`],
      ['pressure','Умовний тиск PN', value => `${format.format(value)} МПа`],
      ['series','Ряд', value => value],
      ['pipe','Варіант під трубу', value => value === '-' ? 'Без літерного варіанта' : value]
    ]) {
      const values = [...new Set(rows.map(row => row[key] ?? '-'))].sort((a,b) =>
        String(a).localeCompare(String(b),'uk',{numeric:true}));
      const value = values.find(item => String(item) === String(filters[key] ?? ''));
      const options = [{value:'', label:'Будь-який'}, ...values.map(item => ({value:String(item),label:String(display(item))}))];
      if (values.length && (key !== 'pipe' || values.some(item => item !== '-'))) {
        card.filters.push({key,label,value:String(value ?? ''),options});
      }
      if (value !== undefined) rows = rows.filter(row => (row[key] ?? '-') === value);
    }

    card.tables.push({id:'variants', title:'Типорозміри',
      columns:[column('dn','DN'), column('pressure','PN','МПа'), column('series','Ряд'), column('pipe','Під трубу'),
        column('D','D','мм'), column('D1','D₁','мм'), column('n','Отвори','шт.')],
      rows:rows.map(row => ({...row.dimensions, id:row.id, dn:row.dn, pressure:row.pressure, series:row.series, pipe:row.pipe}))});
    const row = rows.find(item => item.id === selectedId) || rows[0];
    card.sources.push(source(catalog,number,location(row?.refs?.body)),
      source(catalog,'12815',location(row?.refs?.connection)), source(catalog,'12816','Пункт 1.9'));
    card.related = ['12815','12816'].map(item => makeEntry(item,[]));
    if (!row) return card;

    const faces = Object.keys(row.faces || {});
    const face = faces.includes(String(filters.face)) ? String(filters.face) : faces[0] ?? null;
    if (face !== null) card.filters.push({key:'face',label:'Ущільнювальна поверхня',value:face,
      options:faces.map(value => ({value,label:`Виконання ${value}`}))});
    if (['8','9'].includes(face) && row.refs?.ptfe) {
      card.sources[1].section = [card.sources[1].section, location(row.refs.ptfe)].filter(Boolean).join(' · ');
    }
    card.selectedRow = row;
    card.face = face;
    card.drawingKind = 'flange';
    card.notes.push(rule19, ...(row.notes || []));
    for (const ref of Object.values(row.differences || {})) card.notes.push(formatConflict(ref));
    for (const [key,ref] of Object.entries(row.corrections || {})) {
      card.notes.push(`${labelForDimension(key)} · Поправка ${format.format(ref.original)} → ${format.format(ref.gost)}. С. ${ref.correctionPage} PDF.`);
    }

    const importedBody = row.notes?.some(note => note.startsWith('DN 15 і розміри тіла взято з КОМПАС'));
    const faceValues = row.faces?.[face] || {};
    const dimensions = Object.entries({...row.dimensions,...faceValues}).map(([key,value]) => {
      const connection = ['D','D1','n','d','bolt'].includes(key) || Object.hasOwn(faceValues,key);
      const ref = row.differences?.[key];
      const fromKompas = (ref && ref.kompas === value && ref.gost !== value) || (!connection && importedBody);
      const origin = fromKompas ? 'КОМПАС' : code(connection ? '12815' : number);
      card.dimensionOrigins[key] = {label:origin};
      return {id:key, label:labelForDimension(key), value:key === 'bolt' ? `М${format.format(value)}` : value,
        unit:key === 'n' ? 'шт.' : key === 'bolt' ? '' : 'мм', origin};
    });
    card.tables.push({id:'dimensions', title:'Розміри вибраного фланця',
      columns:[column('label','Параметр'),column('value','Значення'),column('unit','Одиниця'),column('origin','Джерело')], rows:dimensions});
    return card;
  }

  const api = {listEntries,getCard};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StandardsFlangeReference = api;
})(globalThis);
