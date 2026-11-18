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

  const StandardsCatalogAdapter = {
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
                innerD = s.innerDiameterByClassMm[accuracyClass] != null
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
