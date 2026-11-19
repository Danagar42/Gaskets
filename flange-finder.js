'use strict';

const measurementFields = {
  D: ['Зовнішній діаметр D', 'D'],
  D1: ['Коло отворів D₁', 'D₁'],
  b: ['Товщина диска b', 'b'],
  n: ['Кількість отворів n', 'n'],
  d: ['Діаметр отвору d', 'd'],
  bolt: ['Різьба кріплення M', 'Кріплення'],
  bore: ['Внутрішній діаметр', 'Отвір'],
  seal: ['Діаметр D₂ за кресленням', 'D₂'],
  pipeOD: ['Зовнішній діаметр труби', 'Труба'],
};

const faceNames = {
  1: 'З’єднувальний виступ', 2: 'Виступ', 3: 'Впадина',
  4: 'Шип', 5: 'Паз', 6: 'Під лінзову прокладку',
  7: 'Під прокладку овального перерізу', 8: 'Шип під фторопласт', 9: 'Паз під фторопласт',
};

const pressureMarkings = new Map([
  [0.1, '1'], [0.25, '2,5'], [0.6, '6'], [1, '10'], [1.6, '16'],
  [2.5, '25'], [4, '40'], [6.3, '63'], [10, '100'], [16, '160'], [20, '200'],
]);

function parseMeasurement(text, field) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const raw = field === 'bolt' ? trimmed.replace(/^[mм]\s*/i, '') : trimmed;
  const value = Number(raw.replace(',', '.'));
  if (!/^\d+(?:[.,]\d+)?$/.test(raw) || !Number.isFinite(value) || value <= 0) return NaN;
  return field === 'n' && !Number.isInteger(value) ? NaN : value;
}

function flangeValue(row, field, face) {
  if (field !== 'seal') return row.dimensions[field] ?? null;
  if (face) return row.faces[face]?.D2 ?? null;
  const diameters = [...new Set(Object.values(row.faces).map(item => item.D2).filter(Number.isFinite))];
  return diameters.length === 1 ? diameters[0] : null;
}

function rankFlanges(rows, measurements, filters = {}) {
  const fields = Object.entries(measurements).filter(([key, value]) =>
    Object.hasOwn(measurementFields, key) && Number.isFinite(value) && value > 0);
  const candidates = [];
  for (const row of rows) {
    if (['standard', 'dn', 'pressure', 'series', 'pipe'].some(key =>
      filters[key] != null && filters[key] !== row[key])) continue;
    if (filters.face && !row.faces[filters.face]) continue;
    let exact = 0;
    let missing = 0;
    let distance = 0;
    const comparisons = {};
    for (const [field, input] of fields) {
      const value = flangeValue(row, field, filters.face);
      if (value == null) {
        comparisons[field] = { status: 'missing', value: null, delta: null };
        missing++;
      } else {
        const delta = Number((value - input).toFixed(9));
        comparisons[field] = { status: delta ? 'different' : 'exact', value, delta };
        if (!delta) exact++;
        distance += Math.abs(delta) / input;
      }
    }
    if (!filters.exact || exact === fields.length) candidates.push({ row, comparisons, exact, missing, distance });
  }
  return candidates.sort((a, b) =>
    b.exact - a.exact || a.missing - b.missing || a.distance - b.distance
      || a.row.dn - b.row.dn || a.row.pressure - b.row.pressure
      || (b.row.series ?? 0) - (a.row.series ?? 0)
      || a.row.id.localeCompare(b.row.id));
}

if (typeof module !== 'undefined') module.exports = { parseMeasurement, rankFlanges };
else globalThis.FlangeFinder = { parseMeasurement, rankFlanges, faceNames, pressureMarkings };
if (typeof document !== 'undefined' && document.getElementById('matches')) startFlangeFinder();

function startFlangeFinder() {
  const $ = id => document.getElementById(id);
  const data = globalThis.GostFlangeCatalog;
  if (!data?.rows?.length) {
    $('count').textContent = 'Каталог не завантажився. Перевірте файл flange-catalog.bundle.js поруч зі сторінкою.';
    return;
  }
  const locales = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
  const fmt = value => value == null ? '—' : locales.format(value);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const form = $('filters');
  const kind = row => row.standard === '12820' ? 'Плоский' : 'Комірцевий';
  const model = row => `DN ${row.dn}${row.pipe || ''} / ${fmt(row.pressure)} МПа`;
  const pageSize = 25;
  let page = 0;
  let state;
  let dialogTrigger;

  const fill = (id, values, label = String) => {
    for (const value of values) {
      const option = element('option', label(value));
      option.value = value;
      $(id).append(option);
    }
  };
  fill('dn', [...new Set(data.rows.map(row => row.dn))].sort((a, b) => a - b));
  fill('pressure', [...new Set(data.rows.map(row => row.pressure))].sort((a, b) => a - b),
    value => `${fmt(value)} МПа · ${pressureMarkings.get(value)} кгс/см²`);
  fill('face', Object.keys(faceNames), face => `${face}. ${faceNames[face]}`);
  for (const [field, [label]] of Object.entries(measurementFields)) {
    const pair = element('label', label);
    const input = element('input');
    input.id = `measure-${field}`;
    input.name = field;
    input.inputMode = field === 'n' ? 'numeric' : 'decimal';
    input.autocomplete = 'off';
    input.placeholder = { D: '215', D1: '180', b: '18', n: '8', bolt: 'М16' }[field] || '—';
    pair.append(input);
    $('measurements').append(pair);
  }

  function sourceLink(standard, page, label) {
    const link = element('a', label);
    link.href = `standards/sources/flanges/${data.sources[standard]}#page=${page}`;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }

  function showDetail(item, trigger) {
    const { row, comparisons } = item;
    dialogTrigger = trigger;
    $('detail-title').textContent = `${kind(row)} фланець ${model(row)}`;
    $('detail-subtitle').textContent = `ГОСТ ${row.standard}-80 · ${row.series ? `ряд ${row.series}` : 'один ряд у таблиці'}`;
    const body = $('detail-body');
    body.replaceChildren();
    const properties = element('dl', null, 'properties');
    const labels = {
      ...Object.fromEntries(Object.entries(measurementFields).map(([id, field]) => [id, field[0]])),
      pipeOD: 'Зовнішній діаметр труби', h4: 'Висота до площини тіла h₄',
      Dm: 'Діаметр основи коміра Dₘ', Dn: 'Діаметр приварного кінця Dₙ',
    };
    for (const [field, value] of Object.entries(row.dimensions)) {
      const suffix = field === 'bolt' || field === 'n' ? '' : ' мм';
      const comparison = comparisons[field];
      const delta = comparison?.delta;
      const text = `${field === 'bolt' ? 'М' : ''}${fmt(value)}${suffix}`;
      const item = element('dd', text);
      if (delta) item.append(element('small', `Δ ${delta > 0 ? '+' : ''}${fmt(delta)}${suffix}`, 'delta'));
      properties.append(element('dt', labels[field] || field), item);
    }
    body.append(properties);

    const faceDetails = Object.keys(row.faces);
    if (faceDetails.length) {
      const section = element('section');
      section.append(element('h3', 'Ущільнювальні поверхні'));
      for (const id of faceDetails) {
        const details = element('details');
        details.open = Number($('face').value) === Number(id);
        details.append(element('summary', `Вик. ${id} · ${faceNames[id]}`));
        details.append(element('p', Object.entries(row.faces[id]).map(([field, value]) =>
          `${field} = ${fmt(value)} мм`).join(' · '), 'muted'));
        section.append(details);
      }
      body.append(section);
    }

    const source = element('section');
    source.append(element('h3', 'Джерела розмірів'));
    const links = element('ul', null, 'source-list');
    for (const [standard, ref] of [[row.standard, row.refs.body], ['12815', row.refs.connection], ['12815', row.refs.ptfe]]) {
      if (!ref) continue;
      const li = element('li');
      li.append(sourceLink(standard, ref[1], `ГОСТ ${standard}-80 · таблиця ${ref[0]}, PDF с. ${ref[1]}`));
      links.append(li);
    }
    source.append(links);
    if (comparisons.b?.status === 'different') {
      const note = element('p', 'Для однакових приєднувальних розмірів стандарт описує випадок товщини за більшою групою тиску. ');
      note.className = 'notice';
      note.append(sourceLink('12816', 5, 'ГОСТ 12816-80, п. 1.9'));
      source.append(note);
    }
    if (row.standard === '12821' && row.dn === 80 && row.pressure <= 6.3) {
      const note = element('p', 'ГОСТ допускає для цього DN приварний кінець Dₙ = 95 мм. У картці показано табличний розмір. ');
      note.className = 'notice';
      note.append(sourceLink('12821', 11, 'Примітка 2'));
      source.append(note);
    }
    if (row.standard === '12820' && (comparisons.bore?.delta || comparisons.pipeOD?.delta)) {
      const note = element('p', 'Стандарт описує виготовлення під інший діаметр труби і розточування посадкового отвору. ');
      note.className = 'notice';
      note.append(sourceLink('12820', 7, 'Пункти 7 і 8'));
      source.append(note);
    }
    for (const note of row.notes) source.append(element('p', note, 'notice'));
    const differences = Object.entries(row.differences);
    const pending = Object.entries(row.unconfirmed);
    const corrections = Object.entries(row.corrections);
    if (differences.length || pending.length || corrections.length) {
      const detail = element('details');
      detail.open = true;
      detail.append(element('summary', 'Відмінності та поправки'));
      const list = element('ul', null, 'source-list');
      for (const [field, ref] of differences) {
        const row = element('li', `${field}: КОМПАС ${fmt(ref.kompas)}, ГОСТ ${fmt(ref.gost)}.${ref.used === 'kompas' ? ' Показано КОМПАС.' : ''} `);
        row.append(sourceLink(ref.standard, ref.page, `Табл. ${ref.table}, графа ${ref.column}`));
        list.append(row);
      }
      for (const [field, ref] of corrections) {
        const row = element('li');
        row.append(sourceLink(ref.standard, ref.correctionPage,
          `${field}: поправка ${fmt(ref.original)} → ${fmt(ref.gost)} мм`));
        list.append(row);
      }
      for (const [field, ref] of pending) {
        const row = element('li', `${field}: у підборі ${fmt(ref.kompas)} з КОМПАС. Прочитання ГОСТ розходяться (${ref.unresolved.map(fmt).join(' / ')}). `);
        row.append(sourceLink(ref.standard, ref.page, `Табл. ${ref.table}, графа ${ref.column}`));
        list.append(row);
      }
      detail.append(list);
      source.append(detail);
    }
    body.append(source);
    $('details').showModal();
  }

  function column(text) {
    const th = element('th', text);
    th.scope = 'col';
    return th;
  }

  function showResults() {
    const { selected, found } = state;
    const maxPage = Math.max(0, Math.ceil(found.length / pageSize) - 1);
    page = Math.min(page, maxPage);
    const columns = selected.length ? selected : ['D', 'D1', 'b', 'n', 'bolt'];
    const table = $('matches');
    const header = table.tHead.rows[0];
    header.replaceChildren(column('Типорозмір'), ...columns.map(field => column(measurementFields[field][1])),
      column(selected.length ? 'Збіги / відомо' : 'Виконання'));
    const body = table.tBodies[0];
    body.replaceChildren();
    for (const item of found.slice(page * pageSize, (page + 1) * pageSize)) {
      const { row, comparisons } = item;
      const tr = body.insertRow();
      const th = element('th');
      th.scope = 'row';
      const button = element('button', model(row), 'result-button');
      button.type = 'button';
      button.addEventListener('click', () => showDetail(item, button));
      th.append(button, element('small',
        `${kind(row)} · ГОСТ ${row.standard}-80${row.series ? ` · ряд ${row.series}` : ''}`, 'muted'));
      if (Object.keys(row.differences).length || Object.keys(row.unconfirmed).length
          || Object.keys(row.corrections).length || row.notes.length) {
        th.append(element('small', 'Є примітки до джерел', 'flag'));
      }
      tr.append(th);
      for (const field of columns) {
        const comparison = comparisons[field];
        const value = comparison ? comparison.value : flangeValue(row, field);
        const cell = element('td', `${field === 'bolt' && value != null ? 'М' : ''}${fmt(value)}`);
        if (comparison?.status === 'different') {
          const delta = comparison.delta;
          cell.append(element('small', `Δ ${delta > 0 ? '+' : ''}${fmt(delta)}${['n', 'bolt'].includes(field) ? '' : ' мм'}`, 'delta'));
        } else if (comparison?.status === 'exact') {
          cell.append(element('small', 'Збіг', 'exact'));
        } else if (comparison?.status === 'missing') {
          cell.append(element('small', 'Немає даних', 'muted'));
        }
        tr.append(cell);
      }
      tr.append(element('td', selected.length ? `${item.exact} / ${selected.length}` : Object.keys(row.faces).join(', ') || '—'));
    }
    $('count').textContent = found.length ? `Знайдено ${fmt(found.length)} типорозмірів` : 'За цими умовами кандидатів немає';
    $('empty').hidden = !!found.length;
    table.hidden = !found.length;
    $('prev').disabled = page === 0;
    $('next').disabled = page >= maxPage;
    $('page').textContent = found.length ? `${page + 1} з ${maxPage + 1}` : '—';
    $('table-view').scrollTop = 0;
  }

  function search() {
    const measurements = {};
    let invalid = 0;
    for (const name of Object.keys(measurementFields)) {
      const input = form.elements.namedItem(name);
      const value = parseMeasurement(input.value, name);
      const bad = Number.isNaN(value);
      input.setAttribute('aria-invalid', String(bad));
      if (bad) invalid++;
      else if (value !== null) measurements[name] = value;
    }
    $('validation').hidden = !invalid;
    const filters = {
      standard: $('standard').value || null, dn: Number($('dn').value) || null,
      pressure: Number($('pressure').value) || null, series: Number($('series').value) || null,
      pipe: $('pipe').value || null,
      face: Number($('face').value) || null, exact: $('exact-only').checked,
    };
    const found = invalid ? [] : rankFlanges(data.rows, measurements, filters);
    state = { selected: Object.keys(measurements), found };
    page = 0;
    showResults();
    if (invalid) {
      $('count').textContent = 'Виправте позначені розміри';
      $('empty').hidden = true;
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    search();
  });
  form.addEventListener('reset', () => setTimeout(search, 0));
  form.addEventListener('input', search);
  $('prev').addEventListener('click', () => { page--; showResults(); });
  $('next').addEventListener('click', () => { page++; showResults(); });
  $('details').addEventListener('close', () => dialogTrigger?.focus());
  $('example').addEventListener('click', () => {
    $('standard').value = '12820';
    $('dn').value = '100';
    $('pressure').value = '1.6';
    $('series').value = '';
    $('pipe').value = '';
    $('face').value = '1';
    $('exact-only').checked = false;
    for (const key of Object.keys(measurementFields)) $('measure-' + key).value = '';
    for (const [key, value] of Object.entries({ D: 215, D1: 180, b: 18, n: 8, bolt: 16 })) $('measure-' + key).value = value;
    search();
  });
  search();
}
