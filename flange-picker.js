(function (root) {
  'use strict';

  const isCommonJS = typeof module !== 'undefined' && module.exports;
  const finder = isCommonJS ? require('./flange-finder.js') : root.FlangeFinder;
  const core = isCommonJS ? require('./core.js') : root.FlangeCore;
  const fields = {
    innerDiameter: ['bore', 'Внутрішній діаметр D'],
    outerDiameter: ['D', 'Зовнішній діаметр Df'],
    boltCircle: ['D1', 'Коло кріплень Dw'],
    holeDiameter: ['d', 'Діаметр отвору d₀'],
  };
  const sideLabels = {sideA: 'А', sideB: 'Б'};
  const sidePair = ['sideA', 'sideB'];
  const otherSide = side => side === 'sideA' ? 'sideB' : 'sideA';
  const fmt = core.formatNumber;
  const positive = value => {
    const number = core.number(value);
    return number > 0 ? number : null;
  };
  const fastenerCount = node => {
    const count = positive(node.fastener?.count);
    return Number.isInteger(count) ? count : null;
  };
  const empty = value => String(value ?? '').trim() === '';
  const intendedCircles = node => {
    if (node.connection?.kind === 'flange-cover') {
      const part = node.flanges?.sideA;
      return [part?.mode === 'none' ? null : positive(part?.boltCircle), null];
    }
    return sidePair.map(side => {
      const part = node.flanges?.[side];
      return part?.mode === 'none' ? null : positive(part?.boltCircle);
    });
  };

  function gasketFit(node, row, circle = row.dimensions.D1) {
    const gasket = node.gasket;
    const fastener = positive(node.fastener?.nominalDiameter) ?? positive(row.dimensions.bolt);
    if (gasket?.mode !== 'ring') return {status: 'unknown', text: 'Для прокладки, заданої площами, розташування відносно шпильок невідоме.'};
    if (gasket.hasHoles) {
      const hole = positive(gasket.holeDiameter);
      if (hole !== null && fastener !== null && hole < fastener) {
        return {status: 'conflict', text: 'Отвір прокладки менший за номінальний діаметр кріплення.'};
      }
      return {status: 'unknown', text: 'Для прокладки з отворами звірте їхнє коло та розташування за кресленням.'};
    }
    const outer = positive(gasket.outerDiameter);
    const inner = positive(gasket.innerDiameter);
    if (outer === null || inner === null || inner >= outer || fastener === null || positive(circle) === null) {
      return {status: 'unknown', text: 'Для перевірки потрібні діаметри кільця, коло кріплень і діаметр шпильки.'};
    }
    const gap = (circle - fastener - outer) / 2;
    if (gap > 0) {
      return {status: 'clear', text: `Прокладка всередині кола кріплень. Відстань до шпильки за номінальними розмірами ${fmt(gap)} мм.`};
    }
    if (inner <= circle + fastener) {
      return {status: 'conflict', text: gap === 0 ? 'Край кільця торкається шпильки.' : 'Кільце прокладки заходить у зону шпильок.'};
    }
    return {status: 'unknown', text: 'Кільце лежить зовні кола кріплень. Звірте розташування ущільнення за кресленням.'};
  }

  function knownAttachment(node, row) {
    const count = fastenerCount(node);
    const nominal = positive(node.fastener?.nominalDiameter);
    return (count === null || row.dimensions.n === count)
      && (nominal === null || row.dimensions.bolt === nominal);
  }

  function attachmentMismatch(rows, node) {
    const nominal = positive(node.fastener?.nominalDiameter);
    if (nominal === null) return '';
    const sizes = rows.filter(row => row.dimensions.bolt === nominal);
    const thread = `М${fmt(nominal)}`;
    if (!sizes.length) return `У каталозі немає фланців під ${thread}.`;
    const count = fastenerCount(node);
    if (count === null || sizes.some(row => knownAttachment(node, row))) return '';
    const counts = [...new Set(sizes.map(row => row.dimensions.n))].sort((a,b) => a-b);
    return `Для ${thread} у каталозі немає фланців з такою кількістю отворів (${fmt(count)}). Кількість отворів під цю різьбу в каталозі — ${counts.map(n => fmt(n)).join(', ')}. Звірте поле «Кількість» у схемі вузла.`;
  }

  function pressureHint(operating) {
    const conditions = [];
    for (const [mode, label] of [['normal', 'Робочий режим'], ['hydro', 'Гідровипробування']]) {
      const pressure = core.number(operating?.[mode]?.pressure);
      if (pressure === null || pressure < 0) continue;
      const temperature = core.number(operating[mode].temperature);
      const atTemperature = temperature !== null && temperature >= -273.15 ? ` при ${fmt(temperature)} °C` : '';
      conditions.push(`${label} — ${fmt(pressure)} МПа${atTemperature}.`);
    }
    return [...conditions, 'Допустимий робочий тиск для вибраного PN залежить від матеріалу й температури.'].join(' ');
  }

  function findCandidates(rows, node, measurements, filters) {
    const circles = intendedCircles(node).filter(circle => circle !== null);
    const eligible = rows.filter(row => knownAttachment(node, row) && circles.every(circle => row.dimensions.D1 === circle));
    return finder.rankFlanges(eligible, measurements, filters).map(match => ({...match, fit: gasketFit(node, match.row)}))
      .sort((a,b) => Number(a.fit.status === 'conflict') - Number(b.fit.status === 'conflict'));
  }

  function previewApplication(node, row, target) {
    const preview = {sides: {}, errors: [], count: 0};
    const isFlangeFlange = node.connection?.kind === 'flange-flange';
    const isFlangeCover = node.connection?.kind === 'flange-cover';
    if ((!isFlangeFlange && !isFlangeCover) || !['sideA', 'sideB', 'both'].includes(target) || (isFlangeCover && target !== 'sideA')) {
      preview.errors.push('Виберіть сторону вузла «фланець — фланець» або фланець у з’єднанні «фланець — кришка».');
      return preview;
    }
    if (!knownAttachment(node, row)) preview.errors.push('Різьба або кількість отворів фланця не відповідає кріпленню вузла.');
    const sides = target === 'both' ? sidePair : [target];
    for (const side of sides) {
      const current = node.flanges[side];
      const label = `Сторона ${sideLabels[side]}`;
      const change = {fields: {}, activate: false};
      preview.sides[side] = change;
      if (current.mode === 'none') {
        preview.errors.push(`${label}: перевірку фланця вимкнено.`);
        continue;
      }
      change.activate = current.mode === 'pending';
      for (const [field, [dimension]] of Object.entries(fields)) {
        const value = positive(row.dimensions[dimension]);
        const previous = current[field];
        const status = value === null ? 'missing' : empty(previous) ? 'fill' : positive(previous) === value ? 'same' : 'preserve';
        change.fields[field] = {value, previous, status};
        if (status === 'fill') preview.count++;
      }
      const effective = field => {
        const info = change.fields[field];
        return info.status === 'fill' ? info.value : positive(info.previous);
      };
      const writableCircle = effective('boltCircle');
      if (writableCircle !== row.dimensions.D1) {
        preview.errors.push(`${label}: коло отворів анкети відрізняється від ${fmt(row.dimensions.D1)} мм у каталозі.`);
      }
      const hole = effective('holeDiameter');
      const nominal = positive(node.fastener?.nominalDiameter) ?? positive(row.dimensions.bolt);
      if (hole !== null && nominal !== null && hole < nominal) {
        preview.errors.push(`${label}: діаметр отвору менший за номінальний діаметр кріплення.`);
      }
      const outer = effective('outerDiameter');
      const inner = effective('innerDiameter');
      if ((inner !== null && writableCircle !== null && inner >= writableCircle)
        || (outer !== null && writableCircle !== null && outer <= writableCircle)
        || (inner !== null && outer !== null && hole !== null && outer - inner - 2 * hole <= 0)) {
        preview.errors.push(`${label}: після доповнення діаметрів геометрія отворів не проходить перевірку анкети.`);
      }
      if (writableCircle !== null && hole !== null
        && ((inner !== null && writableCircle - hole <= inner)
          || (outer !== null && writableCircle + hole >= outer))) {
        preview.errors.push(`${label}: отвір кріплення торкається внутрішнього або зовнішнього краю фланця.`);
      }
      const gasketInner = positive(node.gasket?.innerDiameter);
      const gasketOuter = positive(node.gasket?.outerDiameter);
      const mean = node.gasket?.mode === 'ring'
        ? (gasketInner !== null && gasketOuter > gasketInner ? (gasketInner + gasketOuter) / 2 : null)
        : positive(current.gasketDiameter);
      if (mean !== null && ((inner !== null && mean <= inner) || (outer !== null && mean >= outer))) {
        preview.errors.push(`${label}: розрахунковий діаметр прокладки має бути між внутрішнім і зовнішнім діаметрами фланця.`);
      }
      const fit = gasketFit(node, row, writableCircle);
      if (fit.status === 'conflict' && !preview.errors.includes(fit.text)) preview.errors.push(fit.text);
    }
    if (target !== 'both') {
      const other = node.flanges[otherSide(target)];
      const circle = other.mode === 'none' ? null : positive(other.boltCircle);
      const hole = other.mode === 'none' ? null : positive(other.holeDiameter);
      const nominal = positive(node.fastener?.nominalDiameter) ?? positive(row.dimensions.bolt);
      if (circle !== null && circle !== row.dimensions.D1) {
        preview.errors.push(`Коло отворів іншої сторони ${fmt(circle)} мм. У кандидата ${fmt(row.dimensions.D1)} мм.`);
      }
      if (hole !== null && nominal !== null && hole < nominal) {
        preview.errors.push('На іншій стороні отвір менший за номінальний діаметр кріплення.');
      }
    }
    return preview;
  }

  function applyCandidate(node, row, target) {
    const preview = previewApplication(node, row, target);
    if (preview.errors.length || !preview.count) return {...preview, applied: false};
    for (const [side, change] of Object.entries(preview.sides)) {
      const part = node.flanges[side];
      const updates = Object.entries(change.fields).filter(([,info]) => info.status === 'fill');
      if (!updates.length) continue;
      for (const [key, info] of updates) part[key] = String(info.value);
      if (change.activate) part.mode = 'flange';
    }
    return {...preview, applied: true};
  }

  function openPicker({node, side, onApplied, isCurrent}) {
    const dialog = document.getElementById('flange-picker-dialog');
    const catalog = root.GostFlangeCatalog;
    if (!dialog || !catalog?.rows.length || !root.FlangePickerDrawing || dialog.open) return false;
    const drawings = root.FlangePickerDrawing;
    const el = (tag, value, css) => {
      const item = document.createElement(tag);
      if (value != null) item.textContent = value;
      if (css) item.className = css;
      return item;
    };
    const rowName = row => `DN ${row.dn}${row.pipe || ''} · ${fmt(row.pressure)} МПа`;
    const kind = row => row.standard === '12820' ? 'Плоский' : 'Комірцевий';
    const reference = row => `ГОСТ ${row.standard}-80${row.series ? ` · ряд ${row.series}` : ''}`;
    const m = value => `${fmt(value)} мм`;
    const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmt(Math.abs(value))} мм`;
    const count = fastenerCount(node);
    const nominal = positive(node.fastener?.nominalDiameter);
    const ring = node.gasket?.mode === 'ring' && positive(node.gasket.outerDiameter);
    const isFlangeCover = node.connection?.kind === 'flange-cover';
    dialog.innerHTML = `
      <div class="fp-shell">
        <header class="fp-head">
          <div><h2 id="flange-picker-title">Підбір фланця</h2><p class="fp-context"></p></div>
          <button type="button" class="button secondary" data-fp-close>Закрити</button>
        </header>
        <div class="fp-workspace">
          <section class="fp-search" aria-label="Пошук у каталозі">
            <form class="fp-filters" novalidate>
              <label>Конструкція<select name="standard"><option value="">Усі конструкції</option>
                <option value="12820">Плоска · ГОСТ 12820-80</option><option value="12821">Комірцева · ГОСТ 12821-80</option></select></label>
              <div class="fp-pair fp-markings">
                <label>Умовний прохід<select name="dn"><option value="">Будь-який DN</option></select></label>
                <label>Умовний тиск (PN)<select name="pressure" aria-describedby="fp-pressure-hint"><option value="">Будь-який</option></select></label>
              </div>
              <p class="fp-muted" id="fp-pressure-hint"></p>
              <label>Ущільнювальна поверхня<select name="face"><option value="">Усі виконання</option></select></label>
              <div class="fp-pair">
                <label>Зовнішній Ø, мм<input name="D" type="text" inputmode="decimal" autocomplete="off" placeholder="215"></label>
                <label>Товщина диска, мм<input name="b" type="text" inputmode="decimal" autocomplete="off" placeholder="18"></label>
              </div>
              <button type="reset" class="fp-link">Скинути фільтри</button>
            </form>
            <p class="fp-count" role="status"></p>
            <div class="fp-candidates" role="group" aria-label="Кандидати фланців"></div>
            <button type="button" class="button secondary fp-more" hidden>Показати ще</button>
          </section>
          <section class="fp-preview" aria-label="Попередній перегляд кандидата">
            <div class="fp-detail"></div>
            <div class="fp-transfer" tabindex="-1"></div>
          </section>
        </div>
        <footer class="fp-bottom">
          <fieldset class="fp-target"><legend>Застосувати до</legend>
            <label><input type="radio" name="fp-target" value="sideA"><span>А</span></label>
            <label><input type="radio" name="fp-target" value="sideB" ${isFlangeCover ? 'disabled' : ''}><span>Б</span></label>
            <label><input type="radio" name="fp-target" value="both" ${isFlangeCover ? 'disabled' : ''}><span>Обидва</span></label>
          </fieldset>
          <div class="fp-apply-area"><span class="fp-apply-status" role="status"></span>
            <button type="button" class="fp-link fp-review" hidden>Переглянути зміни</button>
            <button type="button" class="button primary fp-apply" disabled>Заповнити порожні поля</button></div>
        </footer>
      </div>`;
    const $ = selector => dialog.querySelector(selector);
    const form = $('.fp-filters');
    $('#fp-pressure-hint').textContent = pressureHint(node.operating);
    const measurementInputs = ['D','b'].map(key => form.elements[key]);
    for (const input of measurementInputs) {
      input.addEventListener('input', () => { input.dataset.rawValue = input.value; });
      input.addEventListener('focus', () => { input.value = input.dataset.rawValue ?? input.value; });
      input.addEventListener('blur', () => {
        const value = finder.parseMeasurement(input.value, input.name);
        if (Number.isFinite(value)) input.value = fmt(value,{useGrouping:false});
      });
    }
    const option = (select, value, label) => {
      const item = el('option', label);
      item.value = value;
      select.append(item);
    };
    const choices = catalog.rows;
    const attachmentIssue = attachmentMismatch(choices, node);
    for (const dn of [...new Set(choices.map(row => row.dn))].sort((a,b) => a-b)) option(form.elements.dn, dn, `DN ${dn}`);
    for (const p of [...new Set(choices.map(row => row.pressure))].sort((a,b) => a-b)) {
      option(form.elements.pressure, p, `${fmt(p)} МПа (${finder.pressureMarkings.get(p)} кгс/см²)`);
    }
    for (const [id, name] of Object.entries(finder.faceNames)) option(form.elements.face, id, `${id}. ${name}`);
    const circles = intendedCircles(node);
    const context = [
      Number.isFinite(nominal) ? `М${fmt(nominal)}` : '',
      Number.isFinite(count) ? `${fmt(count)} шт.` : '',
      ring ? `Прокладка Ø${fmt(ring)} мм` : '',
      ...circles.map((circle, index) =>
        circle === null ? '' : `Коло ${sideLabels[sidePair[index]]} Ø${fmt(circle)} мм`),
    ].filter(Boolean);
    $('.fp-context').textContent = context.length ? context.join(' · ') : 'Введіть відомі розміри або виберіть позначення.';
    let selected = null;
    let matches = [];
    let limit = 30;
    let face = null;
    let activeSize = null;
    let measurements = {};
    let target = isFlangeCover ? 'sideA' : (sidePair.includes(side) ? side : 'sideA');
    $(`input[name="fp-target"][value="${target}"]`).checked = true;
    const apply = $('.fp-apply');
    const draw = () => {
      const viewport = $('.fp-drawings');
      if (viewport && selected) viewport.innerHTML = drawings.drawCandidate(selected.row, face, activeSize);
    };

    function renderTransfer() {
      const transfer = $('.fp-transfer');
      transfer.replaceChildren();
      apply.disabled = true;
      $('.fp-review').hidden = !selected;
      if (!selected) {
        $('.fp-apply-status').textContent = '';
        return;
      }
      const preview = previewApplication(node, selected.row, target);
      transfer.append(el('h3', 'Що перейде в анкету'));
      const table = el('table', null, 'fp-transfer-table');
      const head = table.createTHead().insertRow();
      head.append(el('th', 'Розмір анкети'));
      const sides = Object.keys(preview.sides);
      for (const side of sides) head.append(el('th', sideLabels[side]));
      const body = table.createTBody();
      for (const [field, [,label]] of Object.entries(fields)) {
        const tr = body.insertRow();
        const th = el('th', label);
        th.scope = 'row';
        tr.append(th);
        for (const side of sides) {
          const info = preview.sides[side].fields[field];
          const td = el('td');
          if (!info || info.status === 'missing') td.textContent = '—';
          else if (info.status === 'fill') td.append(el('strong', `Додати ${m(info.value)}`, 'fp-good'));
          else if (info.status === 'same') td.textContent = `${m(info.value)} · уже задано`;
          else td.append(el('span', `Зберегти ${fmt(info.previous)}`), el('small', `У каталозі ${m(info.value)}`, 'fp-muted'));
          tr.append(td);
        }
      }
      transfer.append(table);
      for (const side of sides) {
        const change = preview.sides[side];
        if (change.activate && Object.values(change.fields).some(field => field.status === 'fill')) {
          transfer.append(el('p', `${sideLabels[side]} · Відкрити геометрію для розрахунку фланця.`, 'fp-muted'));
        }
      }
      if (selected.row.standard === '12821') {
        transfer.append(el('p', 'Для комірцевого фланця звірте форму й задайте висоту конуса h₂ та товщини стінок за розрахунковим кресленням.', 'fp-note'));
      }
      if (target === 'both' && [2,3,4,5,8,9].includes(face)) {
        transfer.append(el('p', 'Для цього ущільнення поверхні пари різні. Переносяться діаметри й отвори, а виконання обох поверхонь потрібно звірити окремо.', 'fp-note'));
      }
      if (preview.errors.length) {
        const errors = el('ul', null, 'fp-errors');
        for (const error of preview.errors) errors.append(el('li', error));
        transfer.append(errors);
      }
      apply.disabled = Boolean(preview.errors.length) || !preview.count;
      $('.fp-apply-status').textContent = preview.errors.length ? preview.errors[0]
        : preview.count ? `Порожніх полів до заповнення: ${preview.count}` : 'Усі доступні поля вже заповнені.';
    }

    function renderSizes(row) {
      const list = el('div', null, 'fp-size-list');
      const sizes = {...row.dimensions, ...row.faces[face]};
      for (const [key, value] of Object.entries(sizes)) {
        if (!Number.isFinite(value) || !drawings.dimensions[key]) continue;
        const button = el('button', null, 'fp-size');
        button.type = 'button';
        button.dataset.sizeKey = key;
        button.setAttribute('aria-pressed', String(key === activeSize));
        const name = ({
          D: 'Зовнішній D', D1: 'Коло D₁', b: 'Товщина b', bore: 'Отвір', d: 'Діаметр отвору d', n: 'Кількість n',
        })[key] || drawings.dimensions[key];
        button.append(el('span', name), el('strong', key === 'bolt' ? `М${fmt(value)}` : key === 'n' ? `${fmt(value)} шт.` : m(value)));
        const comparison = selected.comparisons[key];
        if (comparison) {
          button.append(el('small', `Обмір ${m(measurements[key])} · ${comparison.delta ? signed(comparison.delta) : 'збіг'}`,
            comparison.delta ? 'fp-delta' : 'fp-good'));
        }
        button.addEventListener('click', () => {
          activeSize = key;
          for (const item of list.querySelectorAll('button')) item.setAttribute('aria-pressed', String(item === button));
          draw();
        });
        list.append(button);
      }
      return list;
    }

    function renderDetail() {
      const detail = $('.fp-detail');
      detail.replaceChildren();
      if (!selected) {
        detail.append(el('h3', 'Немає кандидата для перегляду'));
        renderTransfer();
        return;
      }
      const {row, fit} = selected;
      detail.append(el('p', `${kind(row)} фланець · ${reference(row)}`, 'fp-reference'));
      const title = el('h3', rowName(row));
      detail.append(title);
      const figure = el('figure', null, 'fp-figure');
      figure.append(el('div', null, 'fp-drawings'), el('figcaption', 'Схема не в масштабі'));
      detail.append(figure);
      draw();
      const faceIds = Object.keys(row.faces);
      if (faceIds.length) {
        const label = el('label', 'Ущільнювальне виконання для схеми', 'fp-face');
        const surface = el('select');
        option(surface, '', 'Без уточнення');
        for (const id of faceIds) option(surface, id, `${id}. ${finder.faceNames[id]}`);
        surface.value = face ?? '';
        surface.addEventListener('change', () => {
          face = Number(surface.value) || null;
          activeSize = null;
          draw();
          const sizes = $('.fp-size-list');
          if (sizes) sizes.replaceWith(renderSizes(row));
          renderTransfer();
        });
        label.append(surface);
        detail.append(label);
      }
      detail.append(renderSizes(row), el('p', fit.text, `fp-note fp-fit-${fit.status}`));
      const changes = Object.entries(row.differences || {});
      const corrections = Object.entries(row.corrections || {});
      if (row.notes?.length || changes.length || corrections.length) {
        const notes = el('details', null, 'fp-source');
        notes.append(el('summary', 'Примітки джерел'));
        for (const note of row.notes || []) notes.append(el('p', note));
        for (const [key, ref] of changes) {
          const field = drawings.dimensions[key] || key;
          notes.append(el('p', `${field}: КОМПАС ${ref.kompas ?? '—'}, ГОСТ ${ref.gost ?? '—'}. Таблиця ${ref.table}, PDF с. ${ref.page}.`));
        }
        for (const [key, ref] of corrections) {
          notes.append(el('p', `${drawings.dimensions[key] || key}: поправка ${ref.original} → ${ref.gost}. PDF с. ${ref.correctionPage}.`));
        }
        detail.append(notes);
      }
      renderTransfer();
    }

    function activateMatch(item) {
      selected = item;
      face = Number(form.elements.face.value) || null;
      activeSize = null;
      renderDetail();
    }

    function renderCandidates() {
      const options = $('.fp-candidates');
      options.replaceChildren();
      for (const item of matches.slice(0, limit)) {
        const {row, comparisons} = item;
        const button = el('button', null, 'fp-candidate');
        button.type = 'button';
        button.setAttribute('aria-pressed', String(item === selected));
        button.append(el('strong', rowName(row)), el('span', `${kind(row)} · ${reference(row)}`));
        const differences = Object.entries(comparisons).map(([key, item]) => item.delta ? `${drawings.dimensions[key]} ${signed(item.delta)}` : '');
        const detail = differences.filter(Boolean).join(' · ');
        if (detail) button.append(el('small', detail, 'fp-delta'));
        if (item.fit.status === 'conflict') button.append(el('small', 'Конфлікт з прокладкою', 'fp-delta'));
        button.addEventListener('click', () => {
          for (const candidate of options.children) candidate.setAttribute('aria-pressed', String(candidate === button));
          activateMatch(item);
          $('.fp-preview').scrollTop = 0;
        });
        options.append(button);
      }
      $('.fp-more').hidden = limit >= matches.length;
    }

    function search() {
      measurements = {};
      let invalid = false;
      for (const input of measurementInputs) {
        const value = finder.parseMeasurement(input.dataset.rawValue ?? input.value, input.name);
        const bad = Number.isNaN(value);
        input.setAttribute('aria-invalid', String(bad));
        if (bad) invalid = true;
        else if (value != null) measurements[input.name] = value;
      }
      const filters = {
        standard: form.elements.standard.value || null, dn: Number(form.elements.dn.value) || null,
        pressure: Number(form.elements.pressure.value) || null, face: Number(form.elements.face.value) || null,
      };
      matches = invalid ? [] : findCandidates(choices, node, measurements, filters);
      limit = 30;
      $('.fp-count').textContent = invalid ? 'Введіть додатні розміри в міліметрах.'
        : matches.length ? `Кандидатів: ${fmt(matches.length)}`
          : circles.every(circle => circle !== null) && circles[0] !== circles[1]
            ? 'Кола отворів А і Б різні. Звірте заповнені діаметри.' : attachmentIssue || 'За цими умовами кандидатів немає.';
      activateMatch(matches[0] || null);
      renderCandidates();
    }

    form.addEventListener('submit', event => {event.preventDefault(); search();});
    form.addEventListener('input', search);
    form.addEventListener('reset', () => {
      for (const input of measurementInputs) delete input.dataset.rawValue;
      setTimeout(search, 0);
    });
    $('.fp-more').addEventListener('click', () => {
      const firstAdded = limit;
      limit += 30;
      renderCandidates();
      $('.fp-candidates').children[firstAdded]?.focus();
    });
    $('.fp-target').addEventListener('change', event => {
      if (isFlangeCover && event.target.value !== 'sideA') return;
      target = event.target.value;
      renderTransfer();
      if (selected) $('.fp-transfer').scrollIntoView({block:'nearest'});
    });
    $('.fp-review').addEventListener('click', () => $('.fp-transfer').focus());
    $('[data-fp-close]').addEventListener('click', () => dialog.close());
    apply.addEventListener('click', () => {
      if (!selected || (isCurrent && !isCurrent())) return;
      const result = applyCandidate(node, selected.row, target);
      if (!result.applied) {renderTransfer(); return;}
      dialog.close();
      onApplied(result, target);
    });
    search();
    dialog.showModal();
    return true;
  }

  const api = {gasketFit, findCandidates, previewApplication, applyCandidate, openPicker};
  if (isCommonJS) module.exports = {...api, attachmentMismatch, pressureHint};
  else root.FlangePicker = api;
})(globalThis);
