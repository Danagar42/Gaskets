'use strict';
(function(root) {
  const title = 'Довідник стандартів';
  const format = new Intl.NumberFormat('uk-UA',{useGrouping:false, maximumFractionDigits:12});
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const routeFor = (categoryId, entryId) => ['standards',categoryId,entryId].filter(Boolean).join('/');
  const link = (route, label, attrs = '') => `<a href="#${esc(route)}" data-reference-route="${esc(route)}" ${attrs}>${esc(label)}</a>`;

  function resolveRoute(parts, entries) {
    const [categoryId, entryId] = parts;
    const known = root.StandardsCatalogAdapter.listReferenceCategories().some(category => category.id === categoryId);
    if (known && parts.length === 1) return {categoryId,entryId:null};
    if (known && parts.length === 2 && entries.some(entry => entry.id === entryId && entry.categoryId === categoryId)) {
      return {categoryId,entryId};
    }
    return {categoryId:null,entryId:null};
  }

  function entryList(entries) {
    if (!entries.length) return '<p class="reference-empty">Стандартів не знайдено.</p>';
    return `<ul class="reference-list">${entries.map(entry => {
      const route = routeFor(entry.categoryId,entry.id);
      return `<li><a href="#${esc(route)}" data-reference-route="${esc(route)}">
        <strong>${esc(entry.document)}</strong><span>${esc(entry.title)}</span>
        ${entry.range ? `<small>${esc(entry.range)}</small>` : ''}</a></li>`;
    }).join('')}</ul>`;
  }

  function filterMarkup({key,label,value,options}) {
    return `<label class="reference-filter"><span>${esc(label)}</span>${options ?
      `<select data-reference-filter="${esc(key)}">${options.map(option => `<option value="${esc(option.value)}"${option.value === String(value) ? ' selected' : ''}>${esc(option.label)}</option>`).join('')}</select>` :
      `<input type="search" data-reference-filter="${esc(key)}" value="${esc(value)}" placeholder="М24" autocomplete="off">`}</label>`;
  }

  function valueText(value) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '—';
    if (Array.isArray(value)) return value.map(valueText).join(', ');
    if (typeof value === 'number') return format.format(value);
    return value;
  }

  function tableMarkup({id,title,rows,columns}, selectedId, selectable) {
    const sizeId = `reference-table-${id}`;
    return `<section class="reference-table-block" aria-labelledby="${esc(sizeId)}">
      <h2 id="${esc(sizeId)}">${esc(title)}</h2>
      <div class="reference-table-scroll" data-reference-scroll="${esc(id)}" tabindex="0" role="region" aria-labelledby="${esc(sizeId)}">
        <table class="reference-table"><thead><tr>${columns.map(({label,unit}) =>
          `<th scope="col">${esc(label)}${unit ? `<small>${esc(unit)}</small>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map(row => {
          const active = selectable && row.id === selectedId;
          return `<tr${active ? ' class="is-selected"' : ''}${selectable ? ` data-reference-size="${esc(row.id)}"` : ''}>${columns.map(({key},index) => {
            const value = esc(valueText(row[key]));
            const marked = key === 'diameter' && row.isNonPreferred;
            const label = marked ? `${value}<sup aria-hidden="true">*</sup>` : value;
            const accessibleLabel = marked ? ` aria-label="${value}, нерекомендований діаметр"` : '';
            return `<td>${index === 0 && selectable ? `<button type="button" data-reference-row="${esc(row.id)}" aria-pressed="${active}"${accessibleLabel}>${label}</button>` : label}</td>`;
          }).join('')}</tr>`;
        }).join('')}</tbody></table>
      </div>${rows.some(row => row.isNonPreferred) ? '<p class="reference-table-note">* Нерекомендований діаметр</p>' : ''}</section>`;
  }

  function sourcesMarkup({sources,notes,related}) {
    if (!sources.length && !notes.length && !related?.length) return '';
    return `<section class="reference-sources" aria-labelledby="reference-sources-title">
      <h2 id="reference-sources-title">Джерела й примітки</h2>
      ${sources.length ? `<ul>${sources.map(source => `<li>${source.url ?
        `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>` :
        `<strong>${esc(source.label)}</strong>`}${source.edition ? `<span>${esc(source.edition)}</span>` : ''}${source.section ? `<span>${esc(source.section)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${notes.map(note => `<p>${esc(note)}</p>`).join('')}
      ${related?.length ? `<nav class="reference-related" aria-label="Пов’язані стандарти">${related.map(entry =>
        link(routeFor(entry.categoryId,entry.id),entry.document)).join('')}</nav>` : ''}
    </section>`;
  }

  function render(main, parts, {navigate,toast}) {
    const adapter = root.StandardsCatalogAdapter;
    const flange = root.StandardsFlangeReference;
    if (!adapter || !flange) return null;
    const db = root.FlangeStandardsDB;
    const catalog = root.GostFlangeCatalog;
    const categories = adapter.listReferenceCategories();
    const entries = adapter.listReferenceEntries(db,flange.listEntries(catalog));
    const {categoryId,entryId} = resolveRoute(parts,entries);
    const category = categories.find(item => item.id === categoryId);
    const entry = entries.find(item => item.id === entryId);
    const heading = entry?.document || category?.title || title;
    const crumbs = category ? `<nav class="reference-path" aria-label="Шлях у довіднику">${link(routeFor(),title)}
      ${entry ? `<span aria-hidden="true">›</span>${link(routeFor(categoryId),category.title)}` : ''}</nav>` : '';

    main.innerHTML = `<section class="standards-reference" aria-labelledby="reference-heading">
      ${crumbs}<header class="reference-heading"><h1 id="reference-heading">${esc(heading)}</h1>
      ${entry ? `<p>${esc(entry.title)}</p>${entry.range ? `<small>${esc(entry.range)}</small>` : ''}` : ''}</header>
      <div data-reference-panel></div></section>`;
    const view = main.firstElementChild;
    const panel = view.querySelector('[data-reference-panel]');
    let filters = {};
    let selectedId = null;
    let selectedPitch;
    let activeDrawing = null;
    let activeCallout = null;

    function refreshCard(focusKey, rowAction) {
      const oldScroll = panel.querySelector('[data-reference-scroll]');
      const priorTop = rowAction || focusKey === 'pitch' || focusKey === 'face' ? oldScroll?.scrollTop || 0 : 0;
      const priorLeft = oldScroll?.scrollLeft || 0;
      const oldField = [...panel.querySelectorAll('[data-reference-filter]')].find(field => field.dataset.referenceFilter === focusKey);
      const selection = oldField?.tagName === 'INPUT' ? [oldField.selectionStart,oldField.selectionEnd] : null;

      const isFlange = categoryId === 'flanges';
      const card = isFlange ? flange.getCard(catalog,entryId,filters,selectedId) : adapter.getReferenceCard(db,entryId,filters);
      const table = card.tables[0];
      const row = table?.rows.find(item => item.id === (isFlange ? card.selectedRow?.id : selectedId)) || table?.rows[0];
      selectedId = row?.id ?? null;
      filters = Object.fromEntries(card.filters.map(filter => [filter.key,filter.value]));
      activeDrawing = null;
      activeCallout = null;
      if (row && card.drawingKind === 'thread') {
        const pitches = row.pitchesMm || [];
        if (!pitches.includes(selectedPitch)) selectedPitch = row.coarsePitchMm ?? pitches[0];
        if (pitches.length) card.filters.push({key:'pitch',label:'Крок вибраної різьби',value:selectedPitch,
          options:pitches.map(value => ({value:String(value),label:`${format.format(value)} мм`}))});
      }
      if (row && card.drawingKind === 'flange') {
        const dims = card.selectedRow.dimensions;
        const necessary = card.selectedRow.standard === '12821' ? ['b','bore','D','D1','d','n','h4','Dm','Dn'] : ['b','bore','D','D1','d','n'];
        if (necessary.every(key => Number.isFinite(dims[key]) && dims[key] > 0)) {
          activeDrawing = {svg:root.FlangePickerDrawing.drawCandidate(card.selectedRow,card.face,null,card.dimensionOrigins)};
        }
      } else if (row && card.drawingKind) {
        const engine = root.StandardsDrawingEngine;
        activeDrawing = engine?.renderReference({standardId:entryId,type:card.drawingKind,row,pitchMm:selectedPitch});
        activeCallout = activeDrawing?.callout || engine?.getStandardCallout(entryId,row);
      }

      const hasResults = Boolean(row);
      const showDrawing = card.drawingKind && table;
      const calc = activeDrawing?.calculated;
      const copy = activeCallout ? '<button type="button" class="button secondary" data-reference-copy>Скопіювати позначення</button>' : '';
      const drawing = activeDrawing ? `<figure class="reference-figure">
        ${activeDrawing.callout ? `<div class="reference-callout">${esc(activeDrawing.callout)}</div>` : `<h2>Ескіз фланця</h2>`}
        <div class="reference-canvas${isFlange ? ' fp-drawings' : ''}">${activeDrawing.svg}</div>
        <figcaption>Схема не в масштабі</figcaption>
        ${calc ? `<table class="reference-table reference-calculated" aria-label="Розрахований розмір"><tbody><tr>
          <th scope="row">${esc(calc.label)}</th><td>≈ ${esc(formatValueForSketch(calc.value))} ${esc(calc.unit)}</td><td>Розраховано</td></tr></tbody></table>` : ''}
        ${activeDrawing.callout ? `<div class="reference-actions">
          ${copy}
          <button type="button" class="button secondary" data-reference-export>Експорт SVG</button></div>` : ''}
      </figure>` : showDrawing && hasResults ? `<div class="reference-empty">
        ${activeCallout ? `<p class="reference-callout">${esc(activeCallout)}</p>` : ''}
        <p>Недостатньо розмірів для ескізу.</p>${copy ? `<div class="reference-actions">${copy}</div>` : ''}</div>` : '';

      panel.innerHTML = `${card.filters.length ? `<div class="reference-filters">${card.filters.map(filterMarkup).join('')}</div>` : ''}
        ${table && !hasResults ? `<div class="reference-empty" role="status">Типорозмірів не знайдено.
          <button type="button" class="button secondary" data-reference-reset>Скинути фільтри</button></div>` : ''}
        <div class="reference-detail${drawing ? ' reference-detail-split' : ''}">
          <div class="reference-tables">${hasResults ? card.tables.map((item,index) =>
            tableMarkup(item,selectedId,index === 0 && Boolean(showDrawing))).join('') : ''}</div>${drawing}
        </div>${sourcesMarkup(card)}`;

      const scroll = panel.querySelector('[data-reference-scroll]');
      if (scroll) {
        scroll.scrollTop = priorTop;
        scroll.scrollLeft = priorLeft;
      }
      const newField = [...panel.querySelectorAll('[data-reference-filter]')].find(field => field.dataset.referenceFilter === focusKey);
      if (newField) {
        newField.focus({preventScroll:true});
        if (selection?.[0] != null) newField.setSelectionRange(...selection);
      } else if (rowAction) {
        [...panel.querySelectorAll('[data-reference-row]')].find(button => button.dataset.referenceRow === selectedId)?.focus({preventScroll:true});
      }
    }

    if (entry) refreshCard();
    else if (category) panel.innerHTML = entryList(entries.filter(item => item.categoryId === categoryId));
    else {
      panel.innerHTML = `<form class="reference-search" data-reference-search-form>
        <label for="reference-search">Пошук стандарту</label>
        <div><input id="reference-search" type="search" placeholder="Номер або назва" autocomplete="off" data-reference-search>
        <button type="submit" class="button primary">Знайти</button></div></form>
        <div data-reference-search-results hidden></div>
        <ul class="reference-categories" aria-label="Категорії" data-reference-categories>${categories.map(item => {
          const count = entries.filter(candidate => candidate.categoryId === item.id).length;
          const route = routeFor(item.id);
          return `<li><a href="#${route}" data-reference-route="${route}"><strong>${esc(item.title)}</strong><span>${count}</span></a></li>`;
        }).join('')}</ul>`;
    }

    view.addEventListener('input',event => {
      const field = event.target;
      if (field.dataset.referenceSearch !== undefined) {
        const query = field.value.trim();
        const results = view.querySelector('[data-reference-search-results]');
        view.querySelector('[data-reference-categories]').hidden = Boolean(query);
        results.hidden = !query;
        results.innerHTML = query ? entryList(adapter.searchReferenceEntries(entries,query)) : '';
      } else if (field.dataset.referenceFilter && field.tagName === 'INPUT') {
        filters[field.dataset.referenceFilter] = field.value;
        refreshCard(field.dataset.referenceFilter);
      }
    });
    view.addEventListener('submit',event => {
      if (!event.target.matches('[data-reference-search-form]')) return;
      event.preventDefault();
      const query = view.querySelector('[data-reference-search]').value.trim();
      const result = query && adapter.searchReferenceEntries(entries,query)[0];
      if (result) navigate(routeFor(result.categoryId,result.id));
    });
    view.addEventListener('change',event => {
      const {value,dataset,tagName} = event.target;
      const key = dataset.referenceFilter;
      if (!key || tagName !== 'SELECT') return;
      if (key === 'pitch') selectedPitch = Number(value);
      else filters[key] = value;
      refreshCard(key);
    });
    view.addEventListener('click',event => {
      const element = event.target.closest('[data-reference-route], [data-reference-reset], [data-reference-row], [data-reference-size], [data-reference-copy], [data-reference-export]');
      if (!element) return;
      const {referenceRoute,referenceReset,referenceRow,referenceSize,referenceCopy,referenceExport} = element.dataset;
      if (referenceRoute) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        navigate(referenceRoute);
      } else if (referenceReset !== undefined) {
        filters = {};
        selectedId = null;
        refreshCard('diameter');
      } else if (referenceRow || referenceSize) {
        selectedId = referenceRow || referenceSize;
        refreshCard(null,true);
      } else if (referenceCopy !== undefined && activeCallout) {
        copyCallout(activeCallout,element).then(copied => toast(copied ? 'Позначення скопійовано.' : 'Не вдалося скопіювати позначення.'));
      } else if (referenceExport !== undefined && activeDrawing?.callout) {
        downloadSvg(activeDrawing.svg,`${entryId}-${selectedId}.svg`);
      }
    });
    return heading;
  }

  const formatValueForSketch = new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format;

  async function copyCallout(text, button) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Local files can deny clipboard access.
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    try { return document.execCommand('copy'); }
    catch (error) { return false; }
    finally {
      input.remove();
      if (button.isConnected) button.focus({preventScroll:true});
    }
  }

  function downloadSvg(svg, name) {
    const url = URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  root.StandardsReference = {render,resolveRoute};
})(globalThis);
