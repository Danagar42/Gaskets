/**
 * StandardsCatalogAdapter
 *
 * Нормалізація та адаптер доступу до бази нормативних стандартів FlangeStandardsDB.
 * Працює як у браузері (window.StandardsCatalogAdapter), так і в Node.js (CommonJS).
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const adapter = factory();
    module.exports = { StandardsCatalogAdapter: adapter };
    module.exports.StandardsCatalogAdapter = adapter;
    module.exports.default = adapter;
  } else {
    const adapter = factory();
    root.StandardsCatalogAdapter = adapter;
    if (typeof globalThis !== 'undefined') {
      globalThis.StandardsCatalogAdapter = adapter;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Метадані та конфігурація нормалізованих стандартів кріплення
  const FASTENER_STANDARDS_META = [
    {
      id: 'gost-5915-70',
      group: 'nuts',
      groupName: 'Гайки шестигранні',
      category: 'nuts',
      type: 'hex_nut',
      defaultAccuracyClass: 'B',
      accuracyClasses: ['B']
    },
    {
      id: 'gost-5927-70',
      group: 'nuts',
      groupName: 'Гайки шестигранні',
      category: 'nuts',
      type: 'hex_nut',
      defaultAccuracyClass: 'A',
      accuracyClasses: ['A']
    },
    {
      id: 'gost-10605-94',
      group: 'nuts',
      groupName: 'Гайки шестигранні',
      category: 'nuts',
      type: 'hex_nut',
      defaultAccuracyClass: 'B',
      accuracyClasses: ['B']
    },
    {
      id: 'gost-9064-75',
      group: 'nuts',
      groupName: 'Гайки для фланцевих з’єднань',
      category: 'nuts',
      type: 'hex_nut',
      defaultAccuracyClass: null,
      accuracyClasses: []
    },
    {
      id: 'gost-iso-4032-2014',
      group: 'nuts',
      groupName: 'Гайки шестигранні (ISO)',
      category: 'nuts',
      type: 'hex_nut',
      defaultAccuracyClass: 'A/B',
      accuracyClasses: ['A', 'B']
    },
    {
      id: 'gost-11371-78',
      group: 'washers',
      groupName: 'Шайби плоскі',
      category: 'washers',
      type: 'washer',
      defaultAccuracyClass: 'A',
      accuracyClasses: ['A', 'C'],
      executions: ['1', '2']
    },
    {
      id: 'gost-6402-70',
      group: 'washers',
      groupName: 'Шайби пружинні (гровери)',
      category: 'washers',
      type: 'spring_washer',
      defaultAccuracyClass: 'A',
      accuracyClasses: ['A'],
      executions: ['1']
    },
    {
      id: 'gost-9065-75',
      group: 'washers',
      groupName: 'Шайби для фланцевих з’єднань',
      category: 'washers',
      type: 'washer',
      defaultAccuracyClass: 'A',
      accuracyClasses: ['A'],
      executions: ['1']
    },
    {
      id: 'gost-24705-2004',
      group: 'threads',
      groupName: 'Метричні різьби',
      category: 'threads',
      type: 'thread',
      defaultAccuracyClass: null,
      accuracyClasses: []
    },
    {
      id: 'universal-table-1',
      group: 'torques',
      groupName: 'Моменти затягування',
      category: 'torques',
      type: 'torque',
      defaultAccuracyClass: null,
      accuracyClasses: []
    }
  ];

  /**
   * Допоміжна функція для резолвінгу бази даних
   */
  function resolveDb(db) {
    if (db && typeof db === 'object') return db;
    if (typeof globalThis !== 'undefined' && globalThis.FlangeStandardsDB) {
      return globalThis.FlangeStandardsDB;
    }
    if (typeof window !== 'undefined' && window.FlangeStandardsDB) {
      return window.FlangeStandardsDB;
    }
    return null;
  }

  /**
   * Пошук стандарту у базі даних
   */
  function findStandard(db, standardId) {
    const resolvedDb = resolveDb(db);
    if (!resolvedDb || !standardId) return null;
    const categories = ['nuts', 'washers', 'threads', 'torques', 'gaskets', 'flanges'];
    for (const cat of categories) {
      if (resolvedDb[cat] && resolvedDb[cat][standardId]) {
        return {
          raw: resolvedDb[cat][standardId],
          category: cat,
          meta: FASTENER_STANDARDS_META.find(m => m.id === standardId) || null
        };
      }
    }
    return null;
  }

  const referenceCategories = [
    {id:'nuts', title:'Гайки'},
    {id:'washers', title:'Шайби'},
    {id:'threads', title:'Різьби'},
    {id:'flanges', title:'Фланці'},
    {id:'gaskets', title:'Прокладки'},
    {id:'torques', title:'Моменти затягування'}
  ];
  const column = (key, label, unit = '') => ({key, label, unit});
  const limit = new Intl.NumberFormat('uk-UA', {useGrouping:false, maximumFractionDigits:12});

  function referenceEntry(raw, categoryId) {
    const diameters = Object.keys(raw.sizes || {}).map(Number).filter(Number.isFinite);
    const min = Math.min(...diameters), max = Math.max(...diameters);
    const temperatures = Object.keys(raw.expansionMicroPerCByTemperatureC || {}).map(Number);
    let range = null;
    if (diameters.length) range = min === max ? `М${limit.format(min)}` : `М${limit.format(min)}–М${limit.format(max)}`;
    else if (temperatures.length) range = `${Math.min(...temperatures)}–${Math.max(...temperatures)} °C`;
    return {id:raw.id, categoryId, document:raw.document || 'Таблиці Б.1–Б.2',
      title:raw.title || raw.name, range, aliases:[]};
  }

  function normalizeQuery(value) {
    return String(value ?? '').toLocaleLowerCase('uk-UA').trim()
      .replace(/[‐‑‒–—−]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
  }

  function gasketTables(raw) {
    return [
      {id:'properties', title:'Таблиця Б.1. Властивості прокладки',
        columns:[column('label','Параметр'), column('value','Значення'), column('unit','Одиниця')],
        rows:[
          {id:'elasticity', label:'Модуль пружності', value:raw.elasticModulusMPa, unit:'МПа'},
          {id:'width', label:'Розрахункова ширина b', value:raw.effectiveWidth?.description},
          {id:'seating', label:'Тиск первинного обтиску', value:raw.seatingPressureMPa, unit:'МПа'},
          {id:'minimum', label:'Мінімальний питомий тиск', value:raw.minimumPressureMPa, unit:'МПа'},
          {id:'maximum', label:'Максимальний питомий тиск', value:raw.maximumPressureMPa, unit:'МПа'}
        ]},
      {id:'media', title:'Прокладковий коефіцієнт m',
        columns:[column('media','Група середовищ'), column('value','Коефіцієнт m')],
        rows:Object.entries(raw.mediumCoefficients).map(([id, value]) => ({id, value, media:raw.mediumGroups[id]}))},
      {id:'expansion', title:'Таблиця Б.2. Температурне розширення',
        columns:[column('temperature','Температура','°C'), column('value','Коефіцієнт α','10⁻⁶/°C')],
        rows:Object.entries(raw.expansionMicroPerCByTemperatureC).map(([id,value]) => ({id, temperature:Number(id), value}))}
    ];
  }

  const StandardsCatalogAdapter = {
    listReferenceCategories() {
      return referenceCategories;
    },

    listReferenceEntries(db, flangeEntries = []) {
      const resolved = resolveDb(db);
      return referenceCategories.flatMap(({id}) => id === 'flanges' ? flangeEntries :
        Object.values(resolved?.[id] || {}).map(raw => referenceEntry(raw,id)));
    },

    searchReferenceEntries(entries, query) {
      const words = normalizeQuery(query).replace(/^гост\s+(?=.)/u, '').split(' ');
      return entries.filter(entry => {
        const text = normalizeQuery([entry.document, entry.title, ...entry.aliases].join(' '));
        return words.every(word => text.includes(word));
      });
    },

    getReferenceCard(db, id, filters = {}) {
      const found = findStandard(db,id);
      if (!found) return null;
      const {raw, category, meta} = found;
      const details = this.getStandardDetails(db,id);
      const entry = referenceEntry(raw,category);
      const source = raw.source;
      const sources = source ? [{...source, url:details.url, label:({
        user_supplied_table:'Таблиця, надана користувачем',
        user_supplied_screenshot:'Фрагмент, наданий користувачем. Номер ТУ й редакція невстановлені'
      })[source.kind] || entry.document}] : [];
      if (source?.pitchUrl) sources.push({label:'ГОСТ 8724-2002. Кроки різьби', url:source.pitchUrl});
      const notes = [details.scope, details.coverage?.note, source?.notes, source?.note, source?.verification,
        raw.expansionSelectionNote].filter(value => typeof value === 'string' && value);
      const card = {entry, filters:[], tables:[], sources, notes, drawingKind:null};
      if (category === 'gaskets') {
        card.tables = gasketTables(raw);
        return card;
      }

      const diameter = String(filters.diameter ?? '');
      card.filters.push({key:'diameter', label:'Діаметр різьби', value:diameter, options:null});
      const choices = {};
      function addChoice(key, label, options) {
        if (!options.length) return;
        const value = options.find(option => option.value === String(filters[key]))?.value ?? options[0].value;
        card.filters.push({key,label,value,options});
        choices[key] = value;
      }
      if (raw.types) addChoice('type','Тип',Object.entries(raw.types).map(([value, type]) => ({value,label:type.label})));
      if (raw.executions) {
        addChoice('execution','Виконання',Object.keys(raw.executions).map(value => ({value,label:value})));
        const classes = raw.executions[choices.execution] || [];
        addChoice('accuracyClass','Клас точності',classes.map(value => ({value,label:value})));
      }
      const data = this.getTableData(db,id,choices);
      let columns = data.columns;
      const capped = choices.type === 'B';
      if (capped) {
        columns = [...columns, column('bodyDiameterMm','Діаметр корпусу D₁','мм'),
          column('headHeightMm','Висота головки l₀','мм'), column('boreDepthMm','Глибина глухого отвору l','мм')];
        if (source?.capProfile) notes.push(source.capProfile);
      }
      if (category === 'torques') columns = columns.filter(col => !col.key.startsWith('torqueRange'));
      const rows = this.filterRows(data.rows,diameter.replace(',', '.')).map(row => {
        const profile = capped ? raw.sizes[row.diameter]?.capProfile : null;
        return {...row, ...profile, capProfile:profile, id:String(row.diameter)};
      });
      if (category === 'threads') {
        columns = columns.map(col => col.key === 'pitchesDisplay' ? {...col,key:'finePitchesMm',label:'Дрібні кроки'} : col);
      }
      card.tables.push({id:'sizes', title:category === 'torques' ? 'Допустимі моменти' : 'Розміри', columns, rows});
      card.drawingKind = category === 'torques' ? null : capped ? 'capped_nut' : meta?.type || null;
      return card;
    },

    /**
     * Повертає список категорій каталогу
     * @param {Object} [db]
     * @returns {Array<{ id: string, name: string, count: number, active?: boolean, status?: string }>}
     */
    getCategories(db) {
      const resolvedDb = resolveDb(db);
      const fasteners = this.getStandards(resolvedDb, 'fasteners');
      const fastenersCount = fasteners ? fasteners.length : 10;

      return [
        {
          id: 'fasteners',
          name: 'Кріпильні елементи',
          count: fastenersCount,
          active: true
        },
        {
          id: 'flanges',
          name: 'Фланці',
          count: 0,
          status: 'upcoming'
        },
        {
          id: 'gaskets',
          name: 'Прокладки',
          count: 0,
          status: 'upcoming'
        }
      ];
    },

    /**
     * Повертає перелік стандартів для обраної категорії
     * @param {Object} [db]
     * @param {string} categoryId
     * @returns {Array<{ id: string, group: string, document: string, title: string, type: string, accuracyClass: ?string }>}
     */
    getStandards(db, categoryId) {
      // Підтримка виклику getStandards(categoryId) без явної передачі db
      if (typeof db === 'string') {
        categoryId = db;
        db = null;
      }
      const resolvedDb = resolveDb(db);

      if (categoryId !== 'fasteners') {
        return [];
      }

      return FASTENER_STANDARDS_META.map(meta => {
        let raw = null;
        if (resolvedDb && resolvedDb[meta.category] && resolvedDb[meta.category][meta.id]) {
          raw = resolvedDb[meta.category][meta.id];
        }

        const document = (raw && raw.document) || meta.id.toUpperCase();
        const title = (raw && raw.title) || meta.groupName;
        const accuracyClass = (raw && raw.accuracyClass) || meta.defaultAccuracyClass || null;

        return {
          id: meta.id,
          group: meta.group,
          groupName: meta.groupName,
          document,
          title,
          type: meta.type,
          accuracyClass
        };
      });
    },

    /**
     * Повертає детальний паспорт стандарту
     * @param {Object} [db]
     * @param {string} standardId
     * @returns {Object|null}
     */
    getStandardDetails(db, standardId) {
      // Підтримка виклику getStandardDetails(standardId)
      if (typeof db === 'string') {
        standardId = db;
        db = null;
      }
      const found = findStandard(db, standardId);
      if (!found) return null;

      const raw = found.raw;
      const meta = found.meta || FASTENER_STANDARDS_META.find(m => m.id === standardId);

      const source = raw.source || null;
      const notes = (source && source.notes) || (raw.coverage && raw.coverage.note) || null;
      const verification = (source && source.verification) || null;
      const url = (source && (source.url || source.dimensionsUrl)) || null;
      const section = (source && source.section) || null;

      const accuracyClasses = raw.accuracyClasses ||
        (meta && meta.accuracyClasses) ||
        (raw.accuracyClass ? [raw.accuracyClass] : []);

      const executions = raw.executions
        ? Object.keys(raw.executions)
        : (meta && meta.executions ? meta.executions : null);

      return {
        id: raw.id || standardId,
        group: meta ? meta.group : found.category,
        groupName: meta ? meta.groupName : found.category,
        type: meta ? meta.type : (raw.type || 'standard'),
        document: raw.document || standardId,
        title: raw.title || '',
        scope: raw.scope || null,
        unit: raw.unit || 'мм',
        accuracyClass: raw.accuracyClass || (meta ? meta.defaultAccuracyClass : null),
        accuracyClasses,
        executions,
        rawExecutions: raw.executions || null,
        types: raw.types || null,
        source,
        notes,
        verification,
        url,
        section,
        nonPreferredDiametersMm: raw.nonPreferredDiametersMm || [],
        fields: raw.fields || null,
        coverage: raw.coverage || null,
        minDiameterByExecutionMm: raw.minDiameterByExecutionMm || null,
        sizesCount: raw.sizes ? Object.keys(raw.sizes).length : 0
      };
    },

    /**
     * Повертає нормалізовані дані таблиці для обраного стандарту
     * @param {Object} [db]
     * @param {string} standardId
     * @param {Object} [options]
     * @returns {{ columns: Array, rows: Array }}
     */
    getTableData(db, standardId, options = {}) {
      // Підтримка виклику getTableData(standardId, options)
      if (typeof db === 'string') {
        options = standardId || {};
        standardId = db;
        db = null;
      }
      const found = findStandard(db, standardId);
      if (!found || !found.raw) {
        return { columns: [], rows: [] };
      }

      const raw = found.raw;
      const meta = found.meta || FASTENER_STANDARDS_META.find(m => m.id === standardId);
      const group = meta ? meta.group : found.category;
      const type = meta ? meta.type : (raw.type || 'standard');
      const nonPreferred = raw.nonPreferredDiametersMm || [];

      let columns = [];
      let rows = [];

      if (group === 'nuts') {
        if (standardId === 'gost-9064-75') {
          // Спеціальний стандарт з типами А і Б
          const selectedType = (options && (options.type || options.nutType)) === 'B' ? 'B' : 'A';
          columns = [
            { key: 'diameter', label: 'Різьба d', symbol: 'd', unit: 'мм' },
            {
              key: 'heightMm',
              label: selectedType === 'B' ? 'Висота l₁ (Тип Б)' : 'Висота H (Тип А)',
              symbol: selectedType === 'B' ? 'l₁' : 'H',
              unit: 'мм'
            },
            { key: 'acrossFlatsMm', label: 'Під ключ S', symbol: 'S', unit: 'мм' },
            { key: 'isNonPreferred', label: 'Ряд', symbol: '—' }
          ];

          if (raw.sizes) {
            rows = Object.entries(raw.sizes).map(([k, s]) => {
              const d = parseFloat(k);
              const height = (s.heightsByTypeMm && s.heightsByTypeMm[selectedType] != null)
                ? s.heightsByTypeMm[selectedType]
                : null;
              const acrossFlats = (s.acrossFlatsByTypeMm && s.acrossFlatsByTypeMm[selectedType] != null)
                ? s.acrossFlatsByTypeMm[selectedType]
                : null;
              const isNonPref = nonPreferred.includes(d);

              return {
                diameter: d,
                heightMm: height,
                acrossFlatsMm: acrossFlats,
                nutType: selectedType,
                heightsByTypeMm: s.heightsByTypeMm,
                acrossFlatsByTypeMm: s.acrossFlatsByTypeMm,
                isNonPreferred: isNonPref,
                preferredLabel: isNonPref ? 'Не рекоменд.' : 'Основний'
              };
            });
          }
        } else {
          // Стандартні шестигранні гайки (ГОСТ 5915-70, ГОСТ 5927-70, ГОСТ 10605-94, ГОСТ ISO 4032-2014)
          columns = [
            { key: 'diameter', label: 'Різьба d', symbol: 'd', unit: 'мм' },
            { key: 'heightMm', label: 'Висота m', symbol: 'm', unit: 'мм' },
            { key: 'acrossFlatsMm', label: 'Під ключ S', symbol: 'S', unit: 'мм' },
            { key: 'isNonPreferred', label: 'Ряд', symbol: '—' }
          ];

          if (raw.sizes) {
            rows = Object.entries(raw.sizes).map(([k, s]) => {
              const d = parseFloat(k);
              const isNonPref = nonPreferred.includes(d);

              return {
                diameter: d,
                heightMm: s.heightMm,
                acrossFlatsMm: s.acrossFlatsMm,
                isNonPreferred: isNonPref,
                preferredLabel: isNonPref ? 'Не рекоменд.' : 'Основний'
              };
            });
          }
        }
      } else if (group === 'washers') {
        const execution = (options && options.execution) ? String(options.execution) : '1';
        let accuracyClass = (options && options.accuracyClass) ? String(options.accuracyClass).toUpperCase() : 'A';
        if (execution === '2') {
          accuracyClass = 'A'; // Виконання 2 тільки класу точності А
        }

        columns = [
          { key: 'diameter', label: 'Різьба d', symbol: 'd', unit: 'мм' },
          { key: 'innerDiameterMm', label: 'Внутрішній d₁', symbol: 'd₁', unit: 'мм' },
          { key: 'outerDiameterMm', label: 'Зовнішній d₂', symbol: 'd₂', unit: 'мм' },
          { key: 'thicknessMm', label: 'Товщина s', symbol: 's', unit: 'мм' }
        ];

        if (raw.sizes) {
          const minDiam = (raw.minDiameterByExecutionMm && raw.minDiameterByExecutionMm[execution])
            ? raw.minDiameterByExecutionMm[execution]
            : 0;

          rows = Object.entries(raw.sizes)
            .filter(([k]) => parseFloat(k) >= minDiam)
            .map(([k, s]) => {
              const d = parseFloat(k);
              let innerD = null;
              if (s.innerDiameterByClassMm) {
                innerD = Object.hasOwn(s.innerDiameterByClassMm,accuracyClass)
                  ? s.innerDiameterByClassMm[accuracyClass]
                  : s.innerDiameterByClassMm.A;
              }

              return {
                diameter: d,
                execution,
                accuracyClass,
                innerDiameterMm: innerD,
                outerDiameterMm: s.outerDiameterMm,
                thicknessMm: s.thicknessMm,
                innerDiameterByClassMm: s.innerDiameterByClassMm || null
              };
            });
        }
      } else if (group === 'threads') {
        columns = [
          { key: 'diameter', label: 'Різьба d', symbol: 'd', unit: 'мм' },
          { key: 'coarsePitchMm', label: 'Великий крок P', symbol: 'P', unit: 'мм' },
          { key: 'pitchesDisplay', label: 'Ряд доступних кроків', symbol: 'P_i', unit: 'мм' }
        ];

        if (raw.sizes) {
          rows = Object.entries(raw.sizes).map(([k, s]) => {
            const d = parseFloat(k);
            const coarse = s.coarsePitchMm != null ? s.coarsePitchMm : null;
            const pitches = Array.isArray(s.pitchesMm) ? s.pitchesMm : [];

            return {
              diameter: d,
              coarsePitchMm: coarse,
              pitchesMm: pitches,
              finePitchesMm: pitches.filter(p => p !== coarse),
              pitchesDisplay: pitches.length > 0 ? pitches.join(', ') : '—'
            };
          });
        }
      } else if (group === 'torques') {
        columns = [
          { key: 'diameter', label: 'Різьба d', symbol: 'd', unit: 'мм' },
          { key: 'torqueRangeNm', label: 'Момент затягування (Н·м)', symbol: 'M_зат', unit: 'Н·м' },
          { key: 'minNm', label: 'Мін. Н·м', symbol: 'M_min', unit: 'Н·м' },
          { key: 'maxNm', label: 'Макс. Н·м', symbol: 'M_max', unit: 'Н·м' },
          { key: 'torqueRangeKgfM', label: 'Момент затягування (кгс·м)', symbol: 'M_зат', unit: 'кгс·м' },
          { key: 'minKgfM', label: 'Мін. кгс·м', symbol: 'M_min', unit: 'кгс·м' },
          { key: 'maxKgfM', label: 'Макс. кгс·м', symbol: 'M_max', unit: 'кгс·м' }
        ];

        if (raw.sizes) {
          rows = Object.entries(raw.sizes).map(([k, s]) => {
            const d = parseFloat(k);
            return {
              diameter: d,
              minNm: s.minNm,
              maxNm: s.maxNm,
              minKgfM: s.minKgfM,
              maxKgfM: s.maxKgfM,
              torqueRangeNm: `${s.minNm} – ${s.maxNm}`,
              torqueRangeKgfM: `${s.minKgfM} – ${s.maxKgfM}`
            };
          });
        }
      }

      // Сортування рядків за номінальним діаметром за зростанням
      rows.sort((a, b) => a.diameter - b.diameter);

      return { columns, rows };
    },

    /**
     * Швидка фільтрація рядків таблиці за значенням діаметра
     * @param {Array} rows
     * @param {string|number} query
     * @returns {Array}
     */
    filterRows(rows, query) {
      if (!rows || !Array.isArray(rows)) return [];
      if (query == null) return rows;

      const raw = String(query).trim().toLowerCase();
      if (!raw) return rows;

      // Видаляємо латинський префікс 'm' або кириличний 'м'
      const cleanNum = raw.replace(/^[mм]/, '').trim();

      return rows.filter(row => {
        if (!row || typeof row.diameter !== 'number') return false;
        const dStr = String(row.diameter);

        // Якщо введено чисте число (напр. '24')
        if (cleanNum) {
          if (dStr === cleanNum) return true;
          if (dStr.startsWith(cleanNum)) return true;
          if (dStr.includes(cleanNum)) return true;
        }

        // Пошук за позначенням типу 'm24' чи 'м24'
        const mStr = 'm' + dStr;
        const cyrMStr = 'м' + dStr;
        if (mStr.startsWith(raw) || cyrMStr.startsWith(raw)) return true;

        return false;
      });
    }
  };

  return StandardsCatalogAdapter;
});
