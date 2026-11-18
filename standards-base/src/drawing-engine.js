/**
 * StandardsDrawingEngine
 *
 * Оркестратор векторних 2D-креслень нормативних стандартів:
 * - Управління темами: CAD Light (#f8fafc) та Blueprint Dark (#0b1220)
 * - Розмірні лінії, виносні полички та стрілки за ДСТУ/ГОСТ 2.307
 * - Генерація стандартизованого інженерного позначення getStandardCallout
 * - Безпечний рендеринг SVG без NaN, undefined та від'ємних радіусів
 *
 * Працює як у браузері (window.StandardsDrawingEngine), так і в Node.js (CommonJS).
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    let templates;
    try {
      templates = require('./drawing-templates.js').StandardsDrawingTemplates;
    } catch (e) {
      // templates will be resolved from root if not in relative require
    }
    const engine = factory(templates || (root && root.StandardsDrawingTemplates));
    module.exports = { StandardsDrawingEngine: engine };
    module.exports.StandardsDrawingEngine = engine;
    module.exports.default = engine;
  } else {
    const templates = root.StandardsDrawingTemplates || (typeof globalThis !== 'undefined' ? globalThis.StandardsDrawingTemplates : null);
    const engine = factory(templates);
    root.StandardsDrawingEngine = engine;
    if (typeof globalThis !== 'undefined') {
      globalThis.StandardsDrawingEngine = engine;
    }
  }
})(typeof self !== 'undefined' ? self : this, function (injectedTemplates) {
  'use strict';

  // Отримання посилання на шаблони
  function getTemplates() {
    if (injectedTemplates) return injectedTemplates;
    if (typeof globalThis !== 'undefined' && globalThis.StandardsDrawingTemplates) {
      return globalThis.StandardsDrawingTemplates;
    }
    if (typeof window !== 'undefined' && window.StandardsDrawingTemplates) {
      return window.StandardsDrawingTemplates;
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./drawing-templates.js');
        return mod.StandardsDrawingTemplates || mod;
      } catch (err) {
        // silent
      }
    }
    throw new Error('StandardsDrawingTemplates module not found');
  }

  // Колірні палітри тем
  const THEMES = {
    light: {
      name: 'light',
      bg: '#f8fafc',
      line: '#1e293b',
      lineThin: '#64748b',
      axis: '#dc2626',
      dim: '#0284c7',
      dimText: '#0369a1',
      dimHalo: '#ffffff',
      hatchStroke: '#94a3b8',
      threadThin: '#0284c7',
      cardBg: 'rgba(241, 245, 249, 0.85)',
      cardBorder: '#cbd5e1',
      trackBg: '#e2e8f0',
      accentZone: '#0284c7',
      panelFill: '#ffffff'
    },
    dark: {
      name: 'dark',
      bg: '#0b1220',
      line: '#38bdf8',
      lineThin: '#0284c7',
      axis: '#fb7185',
      dim: '#7dd3fc',
      dimText: '#bae6fd',
      dimHalo: '#0b1220',
      hatchStroke: '#0369a1',
      threadThin: '#38bdf8',
      cardBg: 'rgba(15, 23, 42, 0.75)',
      cardBorder: '#1e3a8a',
      trackBg: '#1e293b',
      accentZone: '#0284c7',
      panelFill: 'rgba(11, 18, 32, 0.5)'
    }
  };

  /**
   * Отримати палітру теми
   */
  function getThemeColors(theme = 'dark') {
    return THEMES[theme] || THEMES.dark;
  }

  /**
   * Визначення типу деталі за standardId
   */
  function inferType(standardId) {
    if (!standardId) return 'hex_nut';
    const id = String(standardId).toLowerCase();
    if (id.includes('5915') || id.includes('5927') || id.includes('10605') || id.includes('9064') || id.includes('4032')) {
      return 'hex_nut';
    }
    if (id.includes('6402')) {
      return 'spring_washer';
    }
    if (id.includes('11371') || id.includes('9065')) {
      return 'washer';
    }
    if (id.includes('24705') || id.includes('8724') || id.includes('thread')) {
      return 'thread';
    }
    if (id.includes('universal') || id.includes('torque') || id.includes('table-1')) {
      return 'torque';
    }
    return 'hex_nut';
  }

  /**
   * Генерація стандартизованого позначення для буфера обміну / заголовків
   */
  function getStandardCallout(standardId, row = {}, execution, accuracyClass) {
    const d = row.diameter || row.d || 24;
    const exec = execution || row.execution;
    const acc = accuracyClass || row.accuracyClass;
    const id = String(standardId || '').toLowerCase();

    // Гайки
    if (id === 'gost-5915-70') {
      const execPrefix = exec && String(exec) !== '1' ? `${exec}.` : '';
      return `Гайка ${execPrefix}М${d} ГОСТ 5915-70`;
    }
    if (id === 'gost-5927-70') {
      return `Гайка М${d} ГОСТ 5927-70`;
    }
    if (id === 'gost-10605-94') {
      return `Гайка М${d} ГОСТ 10605-94`;
    }
    if (id === 'gost-9064-75') {
      const typeSuffix = row.type === 'B' || row.type === 'Б' ? '.Б' : row.type === 'A' || row.type === 'А' ? '.А' : '';
      return `Гайка М${d}${typeSuffix} ГОСТ 9064-75`;
    }
    if (id === 'gost-iso-4032-2014') {
      return `Гайка М${d} ГОСТ ISO 4032-2014`;
    }

    // Шайби
    if (id === 'gost-11371-78') {
      const execPrefix = exec && String(exec) === '2' ? '2.' : '';
      const accSuffix = acc && String(acc).toUpperCase() === 'C' ? '.C' : '';
      return `Шайба ${execPrefix}${d}${accSuffix} ГОСТ 11371-78`;
    }
    if (id === 'gost-6402-70') {
      return `Шайба ${d} ГОСТ 6402-70`;
    }
    if (id === 'gost-9065-75') {
      return `Шайба ${d} ГОСТ 9065-75`;
    }

    // Різьби
    if (id === 'gost-24705-2004') {
      const pitchSuffix = row.pitch ? `×${row.pitch}` : '';
      return `Різьба М${d}${pitchSuffix} ГОСТ 24705-2004`;
    }

    // Моменти затягування
    if (id === 'universal-table-1') {
      return `Моменти затягування М${d}`;
    }

    // Загальний fallback
    return `Виріб М${d} (${standardId})`;
  }

  /**
   * Головний метод рендерингу SVG-креслення
   *
   * @param {Object} options
   * @param {string} options.standardId - ID стандарту (напр. 'gost-5915-70')
   * @param {string} [options.type] - Тип деталі ('hex_nut' | 'washer' | 'spring_washer' | 'thread' | 'torque')
   * @param {Object} options.row - Рядок нормативної таблиці з числовими розмірами
   * @param {string} [options.theme='dark'] - 'light' (CAD) або 'dark' (Blueprint)
   * @param {string|number} [options.execution] - Виконання деталі
   * @returns {string} Валідний SVG-рядок
   */
  function render({ standardId, type, row = {}, theme = 'dark', execution } = {}) {
    const templates = getTemplates();
    const colors = getThemeColors(theme);
    const detailType = type || inferType(standardId);
    const safeRow = row || {};

    const diameter = safeRow.diameter ?? safeRow.d ?? 24;

    switch (detailType) {
      case 'hex_nut': {
        const d = diameter;
        const m = safeRow.heightMm ?? safeRow.height ?? safeRow.m ?? 21.5;
        const s = safeRow.acrossFlatsMm ?? safeRow.acrossFlats ?? safeRow.s ?? 36;
        const e = safeRow.acrossCornersMm ?? safeRow.acrossCorners ?? safeRow.e ?? (2 * s / Math.sqrt(3));
        const pitch = safeRow.pitchMm ?? safeRow.coarsePitchMm ?? safeRow.pitch ?? 3;

        return templates.renderHexNut({ d, m, s, e, pitch, colors });
      }

      case 'washer': {
        const d = diameter;
        const d1 = safeRow.innerDiameterMm ?? safeRow.inner ?? safeRow.d1 ?? (d + 1);
        const d2 = safeRow.outerDiameterMm ?? safeRow.outer ?? safeRow.d2 ?? (d * 1.8);
        const s = safeRow.thicknessMm ?? safeRow.thickness ?? safeRow.s ?? safeRow.h ?? 4;

        return templates.renderWasher({ d, d1, d2, s, colors });
      }

      case 'spring_washer': {
        const d = diameter;
        const d1 = safeRow.innerDiameterMm ?? safeRow.inner ?? safeRow.d1 ?? (d + 0.5);
        const d2 = safeRow.outerDiameterMm ?? safeRow.outer ?? safeRow.d2 ?? (d1 + 15.5);
        const s = safeRow.thicknessMm ?? safeRow.thickness ?? safeRow.s ?? safeRow.h ?? 5;

        return templates.renderSpringWasher({ d, d1, d2, s, colors });
      }

      case 'thread': {
        const d = diameter;
        const coarsePitchMm = safeRow.coarsePitchMm ?? safeRow.pitchMm ?? safeRow.pitch ?? 3;
        const pitchesMm = safeRow.pitchesMm ?? [coarsePitchMm];

        return templates.renderThread({ d, coarsePitchMm, pitchesMm, colors });
      }

      case 'torque': {
        const d = diameter;
        const minNm = safeRow.minNm ?? 320;
        const maxNm = safeRow.maxNm ?? 360;
        const minKgfM = safeRow.minKgfM ?? (minNm / 10);
        const maxKgfM = safeRow.maxKgfM ?? (maxNm / 10);

        return templates.renderTorque({ d, minNm, maxNm, minKgfM, maxKgfM, colors });
      }

      default: {
        // Fallback to hex_nut
        return templates.renderHexNut({
          d: diameter,
          m: safeRow.heightMm || 21.5,
          s: safeRow.acrossFlatsMm || 36,
          colors
        });
      }
    }
  }

  return {
    render,
    getStandardCallout,
    getThemeColors,
    THEMES
  };
});
