/**
 * Standards Knowledge Base (StandardsBase)
 * Application Controller & UI State Manager
 *
 * Implements Modern Engineering Glass 2.0 Master-Detail interaction:
 * - Dynamic sidebar navigation grouped by fastener categories
 * - Metadata Passport card with standard specifications & official notes
 * - Interactive dimensions table with instant search and non-preferred size badges
 * - Sticky 2D CAD vector drawing with real-time hover inspection & click lock
 * - Standard engineering callout generator with clipboard copy and toast feedback
 * - Vector SVG export functionality
 * - Theme switcher (CAD Light / Blueprint Dark) with SVG re-rendering
 * - Collapsible sidebar for maximizing workspace on engineer laptops
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.StandardsApp = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Application State
  const state = {
    activeCategory: 'fasteners',
    activeStandardId: 'gost-5915-70',
    activeExecution: '1',
    activeAccuracyClass: 'A',
    activeType: 'A',
    activeRow: null,
    hoveredRow: null,
    searchQuery: '',
    currentTableData: { columns: [], rows: [] },
    currentDetails: null
  };

  let isInitialized = false;

  // DOM Elements Cache
  const dom = {};

  function cacheDom() {
    dom.searchInput = document.getElementById('searchInput');
    dom.standardsList = document.getElementById('standardsList');
    dom.passportCard = document.getElementById('passportCard');
    dom.dimensionsTable = document.getElementById('dimensionsTable');
    dom.drawingContainer = document.getElementById('drawingContainer');
    dom.calloutBadge = document.getElementById('calloutBadge');
    dom.btnCopyCallout = document.getElementById('btnCopyCallout');
    dom.btnExportSvg = document.getElementById('btnExportSvg');
    dom.themeToggle = document.getElementById('themeToggle');
    dom.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    dom.toastContainer = document.getElementById('toastContainer');
    dom.dynamicFilters = document.getElementById('dynamicFilters');
    dom.rowCountBadge = document.getElementById('rowCountBadge');
    dom.mainSidebar = document.getElementById('mainSidebar');
    dom.mainContent = document.getElementById('mainContent');
    dom.detailSidebar = document.getElementById('detailSidebar');
  }

  function getAdapter() {
    if (typeof StandardsCatalogAdapter !== 'undefined') return StandardsCatalogAdapter;
    if (typeof globalThis !== 'undefined' && globalThis.StandardsCatalogAdapter) return globalThis.StandardsCatalogAdapter;
    if (typeof window !== 'undefined' && window.StandardsCatalogAdapter) return window.StandardsCatalogAdapter;
    return null;
  }

  function getDrawingEngine() {
    if (typeof StandardsDrawingEngine !== 'undefined') return StandardsDrawingEngine;
    if (typeof globalThis !== 'undefined' && globalThis.StandardsDrawingEngine) return globalThis.StandardsDrawingEngine;
    if (typeof window !== 'undefined' && window.StandardsDrawingEngine) return window.StandardsDrawingEngine;
    return null;
  }

  /**
   * Escape HTML utility
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Toast notification system
   */
  function showToast(message, type = 'info') {
    if (!dom.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast-message';

    let icon = `
      <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
    if (type === 'error') {
      icon = `
        <svg class="w-4 h-4 text-rose-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
    }

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px) scale(0.95)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2500);
  }

  /**
   * Group and render the standards in the left sidebar
   */
  function renderSidebar() {
    if (!dom.standardsList) return;

    const adapter = getAdapter();

    if (!adapter) {
      dom.standardsList.innerHTML = '<div class="p-4 text-xs text-rose-500">Помилка завантаження адаптера стандартів</div>';
      return;
    }

    const standards = adapter.getStandards('fasteners');

    // Group standards
    const groups = [
      {
        id: 'nuts',
        title: 'Гайки шестигранні',
        icon: '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>',
        items: standards.filter(s => s.group === 'nuts')
      },
      {
        id: 'washers',
        title: 'Шайби (плоскі, гровери)',
        icon: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle>',
        items: standards.filter(s => s.group === 'washers')
      },
      {
        id: 'threads',
        title: 'Метричні різьби',
        icon: '<line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>',
        items: standards.filter(s => s.group === 'threads')
      },
      {
        id: 'torques',
        title: 'Моменти затягування',
        icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
        items: standards.filter(s => s.group === 'torques')
      }
    ];

    let html = '';

    groups.forEach(group => {
      html += `
        <div class="space-y-1">
          <div class="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${group.icon}
            </svg>
            <span>${escapeHtml(group.title)}</span>
          </div>
          <div class="space-y-0.5">
      `;

      group.items.forEach(std => {
        const isActive = std.id === state.activeStandardId;
        const activeClass = isActive ? 'sidebar-item-active' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300';

        html += `
          <button type="button" data-standard-id="${escapeHtml(std.id)}" class="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between group ${activeClass}">
            <div class="truncate pr-2">
              <div class="font-bold tracking-tight ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}">
                ${escapeHtml(std.document)}
              </div>
              <div class="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                ${escapeHtml(std.title)}
              </div>
            </div>
            ${isActive ? `
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
            ` : ''}
          </button>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    dom.standardsList.innerHTML = html;

    // Attach click events
    dom.standardsList.querySelectorAll('[data-standard-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-standard-id');
        if (id && id !== state.activeStandardId) {
          selectStandard(id);
        }
      });
    });
  }

  /**
   * Select and activate standard
   */
  function selectStandard(standardId) {
    state.activeStandardId = standardId;
    state.searchQuery = '';
    if (dom.searchInput) dom.searchInput.value = '';

    const adapter = getAdapter();

    if (!adapter) return;

    const details = adapter.getStandardDetails(standardId);
    state.currentDetails = details;

    // Reset options
    if (details.executions && details.executions.length > 0) {
      state.activeExecution = details.executions[0];
    } else {
      state.activeExecution = '1';
    }

    if (details.accuracyClasses && details.accuracyClasses.length > 0) {
      state.activeAccuracyClass = details.accuracyClasses[0];
    } else if (details.accuracyClass) {
      state.activeAccuracyClass = details.accuracyClass;
    } else {
      state.activeAccuracyClass = 'A';
    }

    if (standardId === 'gost-9064-75') {
      state.activeType = 'A';
    }

    state.activeRow = null;
    state.hoveredRow = null;

    renderSidebar();
    renderPassportCard(details);
    renderControls(details);
    loadTableData();
  }

  /**
   * Render Standard Passport Card
   */
  function renderPassportCard(details) {
    if (!dom.passportCard || !details) return;

    let accuracyBadge = '';
    if (details.accuracyClass || (details.accuracyClasses && details.accuracyClasses.length > 0)) {
      const acc = details.accuracyClass || details.accuracyClasses.join(' / ');
      accuracyBadge = `
        <span class="badge-indigo inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold">
          <svg class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="m9 12 2 2 4-4"></path>
          </svg>
          Клас точності: ${escapeHtml(acc)}
        </span>
      `;
    }

    let executionsBadge = '';
    if (details.executions && details.executions.length > 0) {
      executionsBadge = `
        <span class="badge-cyan inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold">
          Виконання: ${details.executions.map(e => `№${e}`).join(', ')}
        </span>
      `;
    }

    let nonPreferredAlert = '';
    if (details.nonPreferredDiametersMm && details.nonPreferredDiametersMm.length > 0) {
      const nonPrefList = details.nonPreferredDiametersMm.map(d => `М${d}`).join(', ');
      nonPreferredAlert = `
        <div class="badge-amber mt-3 p-3 rounded-xl text-xs flex items-start gap-2.5">
          <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div class="leading-relaxed">
            <span class="font-bold">Нерекомендовані діаметри (Ряд 2/3):</span> розміри <span class="font-mono font-semibold">${escapeHtml(nonPrefList)}</span> наведені в дужках за стандартом і допускаються лише у технічно обґрунтованих випадках.
          </div>
        </div>
      `;
    }

    let sourceInfo = '';
    if (details.source) {
      const docName = details.source.document || details.source.title || 'Офіційний нормативний документ';
      const sectionName = details.source.section ? `, ${details.source.section}` : '';
      sourceInfo = `
        <div class="text-[11px] text-slate-400 flex items-center gap-2">
          <span>Джерело даних:</span>
          <span class="font-medium text-slate-600 dark:text-slate-300">${escapeHtml(docName)}${escapeHtml(sectionName)}</span>
          ${details.verification ? `
            <span class="text-emerald-500 font-semibold">• ${escapeHtml(details.verification)}</span>
          ` : ''}
        </div>
      `;
    }

    dom.passportCard.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div class="space-y-1.5 flex-1">
          <div class="flex flex-wrap items-center gap-2.5">
            <span class="font-black text-lg text-slate-900 dark:text-white tracking-tight">${escapeHtml(details.document)}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              ${escapeHtml(details.groupName || 'Стандарт')}
            </span>
            <span class="badge-emerald inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Верифіковано 100%
            </span>
          </div>
          <h1 class="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">${escapeHtml(details.title)}</h1>
          ${details.notes ? `
            <p class="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">${escapeHtml(details.notes)}</p>
          ` : ''}
        </div>

        <div class="flex flex-wrap md:flex-col items-start md:items-end gap-2 flex-shrink-0">
          ${accuracyBadge}
          ${executionsBadge}
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
            Одиниця: ${escapeHtml(details.unit || 'мм')}
          </span>
        </div>
      </div>

      ${nonPreferredAlert}

      <div class="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
        ${sourceInfo}
        <div class="text-[11px] font-mono text-indigo-500 dark:text-indigo-400">
          SuperBase Data Engine
        </div>
      </div>
    `;
  }

  /**
   * Render dynamic filters (Executions 1/2, Class A/C, Nut Type A/B)
   */
  function renderControls(details) {
    if (!dom.dynamicFilters) return;

    let html = '';

    // Standard Washer ГОСТ 11371-78
    if (details.id === 'gost-11371-78') {
      html += `
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Виконання:</span>
          <div class="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button type="button" data-execution="1" class="px-2.5 py-1 rounded-md transition-colors ${state.activeExecution === '1' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
              1 (без фаски)
            </button>
            <button type="button" data-execution="2" class="px-2.5 py-1 rounded-md transition-colors ${state.activeExecution === '2' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
              2 (з фаскою d ≥ 5)
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Клас точності:</span>
          <div class="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button type="button" data-accuracy-class="A" class="px-2.5 py-1 rounded-md transition-colors ${state.activeAccuracyClass === 'A' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
              Клас А
            </button>
            <button type="button" data-accuracy-class="C" ${state.activeExecution === '2' ? 'disabled title="Виконання 2 тільки класу А"' : ''} class="px-2.5 py-1 rounded-md transition-colors ${state.activeExecution === '2' ? 'opacity-40 cursor-not-allowed text-slate-400' : state.activeAccuracyClass === 'C' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
              Клас С
            </button>
          </div>
        </div>
      `;
    }
    // Flange Nut ГОСТ 9064-75 (Types A and B)
    else if (details.id === 'gost-9064-75') {
      html += `
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Тип виконання:</span>
          <div class="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button type="button" data-nut-type="A" class="px-3 py-1 rounded-md transition-colors ${state.activeType === 'A' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
              Тип А (суцільна шестигранна)
            </button>
            <button type="button" data-nut-type="B" class="px-3 py-1 rounded-md transition-colors ${state.activeType === 'B' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
              Тип Б (з проточкою під ковпак)
            </button>
          </div>
        </div>
      `;
    } else {
      // General informative badge for other standards
      html = `
        <div class="text-xs text-slate-500 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span>Нормативний ряд розмірів за стандартом</span>
        </div>
      `;
    }

    dom.dynamicFilters.innerHTML = html;

    // Attach filter button events
    dom.dynamicFilters.querySelectorAll('[data-execution]').forEach(btn => {
      btn.addEventListener('click', () => {
        const exec = btn.getAttribute('data-execution');
        if (exec && exec !== state.activeExecution) {
          state.activeExecution = exec;
          if (exec === '2') {
            state.activeAccuracyClass = 'A';
          }
          renderControls(details);
          loadTableData();
        }
      });
    });

    dom.dynamicFilters.querySelectorAll('[data-accuracy-class]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.hasAttribute('disabled')) return;
        const cls = btn.getAttribute('data-accuracy-class');
        if (cls && cls !== state.activeAccuracyClass) {
          state.activeAccuracyClass = cls;
          renderControls(details);
          loadTableData();
        }
      });
    });

    dom.dynamicFilters.querySelectorAll('[data-nut-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tp = btn.getAttribute('data-nut-type');
        if (tp && tp !== state.activeType) {
          state.activeType = tp;
          renderControls(details);
          loadTableData();
        }
      });
    });
  }

  /**
   * Fetch table data from catalog adapter and apply filters
   */
  function loadTableData() {
    const adapter = getAdapter();

    if (!adapter) return;

    const options = {
      execution: state.activeExecution,
      accuracyClass: state.activeAccuracyClass,
      type: state.activeType,
      nutType: state.activeType
    };

    const tableData = adapter.getTableData(state.activeStandardId, options);
    state.currentTableData = tableData;

    applyFilterAndRender();
  }

  /**
   * Filter and render table
   */
  function applyFilterAndRender() {
    const adapter = getAdapter();

    const allRows = state.currentTableData.rows || [];
    const columns = state.currentTableData.columns || [];

    const filteredRows = adapter ? adapter.filterRows(allRows, state.searchQuery) : allRows;

    // Update row count badge
    if (dom.rowCountBadge) {
      dom.rowCountBadge.textContent = `${filteredRows.length} типорозмірів`;
    }

    // Preserve active row selection if still in filtered list
    if (state.activeRow) {
      const match = filteredRows.find(r => r.diameter === state.activeRow.diameter);
      state.activeRow = match || filteredRows[0] || null;
    } else {
      state.activeRow = filteredRows[0] || null;
    }

    renderTable(columns, filteredRows);
    renderDrawing();
  }

  /**
   * Render table element
   */
  function renderTable(columns, rows) {
    if (!dom.dimensionsTable) return;

    if (!rows || rows.length === 0) {
      dom.dimensionsTable.innerHTML = `
        <div class="p-12 text-center text-slate-500 space-y-3">
          <svg class="w-8 h-8 text-slate-400 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div class="text-sm font-medium">Розмірів не знайдено за запитом «<span class="font-bold text-indigo-500">${escapeHtml(state.searchQuery)}</span>»</div>
          <p class="text-xs text-slate-400">Спробуйте ввести інший діаметр або очистіть рядок пошуку.</p>
          <button id="btnResetSearch" type="button" class="btn-primary mt-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            Скинути пошук
          </button>
        </div>
      `;

      const btnReset = document.getElementById('btnResetSearch');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          state.searchQuery = '';
          if (dom.searchInput) dom.searchInput.value = '';
          applyFilterAndRender();
        });
      }
      return;
    }

    let theadHtml = '<thead class="sticky-thead"><tr>';
    columns.forEach((col, idx) => {
      const isFirst = idx === 0;
      const stickyClass = isFirst ? ' sticky-first-col' : '';
      theadHtml += `
        <th class="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 text-xs tracking-wider whitespace-nowrap${stickyClass}">
          <div>${escapeHtml(col.label)}</div>
          ${col.unit ? `<div class="text-[10px] text-slate-400 font-normal">[${escapeHtml(col.unit)}]</div>` : ''}
        </th>
      `;
    });
    theadHtml += '</tr></thead>';

    let tbodyHtml = '<tbody>';
    rows.forEach(row => {
      const isActive = state.activeRow && state.activeRow.diameter === row.diameter;
      const rowClasses = [
        'table-row-interactive font-mono-num border-b border-slate-200/60 dark:border-slate-800/60',
        isActive ? 'active-row' : '',
        row.isNonPreferred ? 'non-preferred-size' : ''
      ].filter(Boolean).join(' ');

      tbodyHtml += `<tr class="${rowClasses}" data-diameter="${row.diameter}">`;

      columns.forEach((col, colIdx) => {
        const isFirst = colIdx === 0;
        const stickyClass = isFirst ? ' sticky-first-col' : '';
        let cellVal = row[col.key];

        // Format cell values
        let displayVal = '—';
        if (cellVal != null) {
          if (col.key === 'diameter') {
            displayVal = `М${cellVal}`;
          } else if (typeof cellVal === 'number') {
            displayVal = cellVal;
          } else {
            displayVal = cellVal;
          }
        }

        // Additional badge for first column if non-preferred
        let extraTag = '';
        if (isFirst && row.isNonPreferred) {
          extraTag = `<span class="badge-amber ml-1.5 text-[9px] px-1 py-0.5 rounded font-sans font-semibold">нерек.</span>`;
        }

        tbodyHtml += `<td class="px-4 py-2.5 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300${stickyClass}">${escapeHtml(String(displayVal))}${extraTag}</td>`;
      });

      tbodyHtml += '</tr>';
    });
    tbodyHtml += '</tbody>';

    dom.dimensionsTable.innerHTML = `<table class="w-full text-left text-xs border-collapse">${theadHtml}${tbodyHtml}</table>`;

    // Attach row events
    const rowElements = dom.dimensionsTable.querySelectorAll('tbody tr[data-diameter]');
    rowElements.forEach(tr => {
      const diameter = parseFloat(tr.getAttribute('data-diameter'));
      const rowObj = rows.find(r => r.diameter === diameter);

      if (!rowObj) return;

      // Mouseover: live preview in drawing
      tr.addEventListener('mouseover', () => {
        state.hoveredRow = rowObj;
        renderDrawing();
      });

      // Mouseleave: restore locked active row
      tr.addEventListener('mouseleave', () => {
        state.hoveredRow = null;
        renderDrawing();
      });

      // Click: lock selection
      tr.addEventListener('click', () => {
        state.activeRow = rowObj;
        rowElements.forEach(r => r.classList.remove('active-row'));
        tr.classList.add('active-row');
        renderDrawing();
      });
    });
  }

  /**
   * Render dynamic 2D CAD SVG Drawing
   */
  function renderDrawing() {
    if (!dom.drawingContainer) return;

    const engine = getDrawingEngine();

    if (!engine) {
      dom.drawingContainer.innerHTML = '<div class="text-xs text-rose-500">Креслярський рушій не завантажено</div>';
      return;
    }

    const displayRow = state.hoveredRow || state.activeRow || (state.currentTableData.rows && state.currentTableData.rows[0]) || null;
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

    if (!displayRow) {
      dom.drawingContainer.innerHTML = `
        <div class="text-center text-slate-400 text-xs space-y-2 p-6">
          <svg class="w-8 h-8 mx-auto text-slate-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
          </svg>
          <div>Виберіть типорозмір для перегляду креслення</div>
        </div>
      `;
      if (dom.calloutBadge) dom.calloutBadge.textContent = '—';
      return;
    }

    // Callout text
    const rowForCallout = {
      ...displayRow,
      type: state.activeType || displayRow.nutType || displayRow.type
    };

    const callout = engine.getStandardCallout(
      state.activeStandardId,
      rowForCallout,
      state.activeExecution,
      state.activeAccuracyClass
    );

    if (dom.calloutBadge) {
      dom.calloutBadge.innerHTML = `
        <span class="truncate">${escapeHtml(callout)}</span>
        ${state.hoveredRow && state.hoveredRow !== state.activeRow ? `
          <span class="text-[9px] px-1 py-0.5 rounded bg-indigo-500 text-white font-sans font-bold flex-shrink-0 animate-pulse">Перегляд</span>
        ` : `
          <span class="text-[9px] px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-sans flex-shrink-0">Активний</span>
        `}
      `;
    }

    // Render SVG
    try {
      const svg = engine.render({
        standardId: state.activeStandardId,
        type: state.currentDetails ? state.currentDetails.type : null,
        row: displayRow,
        theme,
        execution: state.activeExecution,
        accuracyClass: state.activeAccuracyClass
      });

      dom.drawingContainer.innerHTML = svg;
    } catch (err) {
      dom.drawingContainer.innerHTML = `<div class="p-4 text-xs text-rose-500">Помилка побудови креслення: ${escapeHtml(err.message)}</div>`;
    }
  }

  /**
   * Setup interactive application event listeners
   */
  function setupEventListeners() {
    // Search input
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        applyFilterAndRender();
      });
    }

    // Theme toggle
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.theme = isDark ? 'dark' : 'light';
        renderDrawing();
        showToast(isDark ? 'Темна тема (Blueprint Dark)' : 'Світла тема (CAD Light)');
      });
    }

    // Sidebar collapse toggle
    if (dom.btnToggleSidebar && dom.mainSidebar) {
      dom.btnToggleSidebar.addEventListener('click', () => {
        dom.mainSidebar.classList.toggle('sidebar-collapsed');
      });
    }

    // Copy callout button
    if (dom.btnCopyCallout) {
      dom.btnCopyCallout.addEventListener('click', () => {
        const engine = getDrawingEngine();

        const displayRow = state.hoveredRow || state.activeRow;
        if (!displayRow || !engine) return;

        const rowForCallout = {
          ...displayRow,
          type: state.activeType || displayRow.nutType || displayRow.type
        };

        const callout = engine.getStandardCallout(
          state.activeStandardId,
          rowForCallout,
          state.activeExecution,
          state.activeAccuracyClass
        );

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(callout).then(() => {
            showToast(`Скопійовано: «${callout}»`);
          }).catch(() => {
            fallbackCopyText(callout);
          });
        } else {
          fallbackCopyText(callout);
        }
      });
    }

    // Export SVG button
    if (dom.btnExportSvg && dom.drawingContainer) {
      dom.btnExportSvg.addEventListener('click', () => {
        const svgEl = dom.drawingContainer.querySelector('svg');
        if (!svgEl) {
          showToast('Креслення для експорту відсутнє', 'error');
          return;
        }

        const displayRow = state.hoveredRow || state.activeRow;
        const dStr = displayRow && displayRow.diameter ? `-M${displayRow.diameter}` : '';
        const filename = `${state.activeStandardId}${dStr}.svg`;

        const svgContent = svgEl.outerHTML;
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`Креслення збережено як ${filename}`);
      });
    }
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(`Скопійовано: «${text}»`);
    } catch (e) {
      showToast('Не вдалося скопіювати', 'error');
    }
    document.body.removeChild(ta);
  }

  /**
   * Main Initialization
   */
  function init() {
    if (isInitialized) return;
    if (typeof document === 'undefined') return;

    cacheDom();
    setupEventListeners();
    selectStandard(state.activeStandardId);

    isInitialized = true;
  }

  // Auto-init on DOM readiness in browser environment
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    state,
    init,
    selectStandard,
    loadTableData,
    renderDrawing,
    showToast
  };
});
