(function () {
  'use strict';
  const C = window.FlangeCore;
  const materials = typeof materialsDB === 'undefined' ? [] : materialsDB;
  const standards = window.FlangeStandards;
  const standardsDb = window.FlangeStandardsDB || {washers: {}};
  const STORAGE_KEY = 'flange-workspace-v1';
  const main = document.querySelector('#main');
  const editDialog = document.querySelector('#edit-dialog');
  const materialDialog = document.querySelector('#material-dialog');
  const media = ['Відсутнє','Рідина','Вода','Мастило','Олива','Розчин','Пар','Повітря','Водень','Гелій','Газ','Газ з високою проникною властивістю'];
  const sectionNames = { operating:'Параметри роботи', gasket:'Прокладка', fastener:'Кріплення', connection:'З’єднання', nut:'Гайка', washers:'Шайби', extras:'Додаткові елементи' };
  const paths = {
    plus:'M12 5v14M5 12h14', search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow:'m14 6-6 6 6 6', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', close:'m6 6 12 12M18 6 6 18',
    edit:'m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h6', copy:'M9 8h12v13H9zM15 8V3H3v13h6',
    folder:'M3 5h7l2 3h9v12H3z', check:'m5 12 4 4L19 6', info:'M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    save:'m8 12 3 3 6-7M7 3H4v18h16V7l-4-4H7Z', grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    operating:'M4 19h16M6 16V9M12 16V4M18 16v-5', gasket:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    fastener:'M8 3h8v4H8zM10 7v14h4V7M9 11h6M9 15h6M9 19h6', connection:'M3 6h7v12H3zM14 6h7v12h-7zM10 9h4M10 15h4',
    nut:'m12 2 9 5v10l-9 5-9-5V7l9-5ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    washers:'M21 12a9 6 0 1 1-18 0 9 6 0 0 1 18 0ZM16 12a4 2.5 0 1 1-8 0 4 2.5 0 0 1 8 0',
    extras:'m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5', material:'m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9',
    settings:'M4 7h16M4 17h16M8 4v6M16 14v6', star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z',
    lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'
  };
  const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const displayNumber = value => C.number(value) === null ? '—' : new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 }).format(C.number(value));
  const plural = (value, words) => words[value % 10 === 1 && value % 100 !== 11 ? 0 : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? 1 : 2];
  const kindName = kind => ({'body-cover':'Корпус — кришка','flange-flange':'Фланець — фланець',custom:'Інше з’єднання'}[kind] || 'З’єднання');
  const date = value => { const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('uk-UA', {day:'2-digit',month:'2-digit',year:'numeric'}) : '—'; };
  let workspace = { version:1, equipment:[], preferences:{ recent:[], favorites:[] } };
  let storageError = '';
  let rawSaved = '';
  try {
    rawSaved = localStorage.getItem(STORAGE_KEY) || '';
    if (rawSaved) {
      const saved = JSON.parse(rawSaved);
      if (!C.validateWorkspace(saved)) throw new Error('Невідомий формат збережених даних.');
      workspace = saved;
    }
  } catch (error) { storageError = error.message; }
  workspace.preferences ||= {};
  for (const key of ['recent','favorites']) if (!Array.isArray(workspace.preferences[key])) workspace.preferences[key] = [];
  // Preserve old localStorage workspaces without requiring manual migration.
  workspace.equipment.forEach(equipment => equipment.nodes.forEach(node => {
    node.fastener.threadStandardId ??= 'gost-24705-2004';
    node.fastener.pitch ??= '';
    node.nut.standardId ??= 'gost-5915-70';
    node.nut.typeId ??= 'A';
    node.washers.standardId ??= 'gost-11371-78';
    node.washers.accuracyClass ??= 'A';
    node.washers.execution ??= '1';
  }));
  let currentEquipment = null;
  let currentNode = null;
  let editContext = null;
  let picker = null;
  let searchText = '';
  let sortBy = 'recent';
  let saveTimer;
  let toastTimer;
  let saveFailed = false;

  function save() {
    clearTimeout(saveTimer);
    if (storageError) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      saveFailed = false;
      setSaveStatus('Збережено в цьому браузері');
    } catch (error) {
      if (!saveFailed) toast('Не вдалося зберегти зміни. Перевірте доступне місце та налаштування браузера.');
      saveFailed = true;
      setSaveStatus('Зміни не збережено', true);
    }
  }
  function setSaveStatus(text, error = false) {
    document.querySelector('#save-status').textContent = text;
    document.querySelector('.header-status').classList.toggle('error', error);
  }
  function changed() {
    if (currentNode) currentNode.updatedAt = C.timestamp();
    if (currentEquipment) currentEquipment.updatedAt = C.timestamp();
    setSaveStatus('Зберігаю…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }
  function toast(message) {
    const target = document.querySelector('#toast');
    target.textContent = message;
    target.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { target.hidden = true; }, 4500);
  }
  function navigate(hash = '') {
    save();
    if (location.hash.slice(1) === hash) renderRoute();
    else location.hash = hash;
  }
  function renderBreadcrumbs() {
    const links = [`<button data-action="home">Робочий стіл</button>`];
    if (currentEquipment) links.push(`${icon('chevron','root-chevron')}<button data-action="open-equipment" data-id="${currentEquipment.id}" ${!currentNode ? 'aria-current="page"' : ''}>${esc(currentEquipment.name)}</button>`);
    if (currentNode) links.push(`${icon('chevron')}<span class="current" aria-current="page">${esc(currentNode.name)}</span>`);
    document.querySelector('#breadcrumbs').innerHTML = links.join('');
  }
  function renderRoute() {
    if (materialDialog.open) materialDialog.close();
    if (editDialog.open) editDialog.close();
    const parts = location.hash.slice(1).split('/');
    currentEquipment = workspace.equipment.find(item => item.id === parts[1]) || null;
    currentNode = parts[0] === 'node' ? currentEquipment?.nodes.find(item => item.id === parts[2]) || null : null;
    searchText = '';
    renderBreadcrumbs();
    if (storageError) {
      setSaveStatus('Не вдалося відкрити збереження', true);
      main.innerHTML = `<section class="desktop"><h1>Збережені дані потребують перевірки</h1><p class="calculation-notice" style="margin-top:20px">Не вдалося прочитати робочий простір. Поточне збереження залишилося в браузері.</p><button class="button secondary" data-action="recover">Завантажити збережені дані</button><button class="button quiet" data-action="reset">Створити новий простір</button></section>`;
    } else if (currentNode) renderEditor();
    else renderDesktop();
    document.title = `${currentNode?.name || currentEquipment?.name || 'Робочий простір'} — Прокладки`;
  }

  const folderArt = () => `<svg class="folder-art" viewBox="0 0 76 58" fill="none" aria-hidden="true"><path d="M5 8a5 5 0 0 1 5-5h20l8 8h28a5 5 0 0 1 5 5v33H5V8Z" fill="#b9cceb"/><path d="M12 12h49v34H12V12Z" fill="#f5f8ff"/><path d="M10 17h56v31H10V17Z" fill="#e7effc"/><path d="M4 22a5 5 0 0 1 5-5h25l7 7h26a5 5 0 0 1 5 5l-3 23a4 4 0 0 1-4 3H9a4 4 0 0 1-4-4L2 28a5 5 0 0 1 2-6Z" fill="#d2e1fa" stroke="#91b0df"/><path d="M13 35h20M13 40h13" stroke="#87a9d9" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  function emptyArt() {
    return `<svg viewBox="0 0 320 260" fill="none" aria-hidden="true"><path d="M45 64h230M45 194h230M90 30v200M230 30v200" stroke="#c8d7ed" stroke-dasharray="4 5"/><path d="M53 64v130M47 70l6-6 6 6M47 188l6 6 6-6M90 222h140M96 216l-6 6 6 6M224 216l6 6-6 6" stroke="#91aace"/><ellipse cx="160" cy="129" rx="69" ry="67" fill="#e4edfb" stroke="#7d9fd0" stroke-width="2"/><ellipse cx="160" cy="129" rx="42" ry="40" fill="#f6f9ff" stroke="#7d9fd0" stroke-width="2"/><g fill="#f6f9ff" stroke="#7d9fd0" stroke-width="1.6"><circle cx="160" cy="76" r="5"/><circle cx="197" cy="92" r="5"/><circle cx="214" cy="129" r="5"/><circle cx="197" cy="166" r="5"/><circle cx="160" cy="182" r="5"/><circle cx="123" cy="166" r="5"/><circle cx="106" cy="129" r="5"/><circle cx="123" cy="92" r="5"/></g><path d="M160 52v154M78 129h164" stroke="#245ed0" stroke-dasharray="8 4 2 4" opacity=".45"/><rect x="235" y="40" width="47" height="27" rx="5" fill="white" stroke="#d2dff1"/><path d="M247 54h22M258 47v14" stroke="#245ed0" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }
  function renderDesktop() {
    const equipment = currentEquipment;
    main.innerHTML = `<section class="desktop">
      ${equipment ? `<button class="back-button" data-action="home">${icon('arrow')}Робочий стіл</button>` : ''}
      <div class="page-heading"><div class="${equipment ? 'folder-heading' : ''}">${equipment ? folderArt() : ''}<div><h1>${esc(equipment?.name || 'Моє обладнання')}</h1><p>${equipment ? `${esc(equipment.designation || 'Обладнання')} · ${equipment.nodes.length} ${plural(equipment.nodes.length,['вузол','вузли','вузлів'])}` : 'Обладнання та його фланцеві з’єднання в одному просторі.'}</p></div></div><button class="button primary" data-action="${equipment ? 'new-node' : 'new-equipment'}">${icon('plus')}${equipment ? 'Створити вузол' : 'Створити обладнання'}</button></div>
      <div class="toolbar"><div class="search">${icon('search')}<input type="search" id="workspace-search" data-list-search placeholder="${equipment ? 'Знайти вузол…' : 'Знайти обладнання…'}" aria-label="${equipment ? 'Пошук вузла' : 'Пошук обладнання'}"></div><div class="toolbar-right"><span class="item-count">${equipment ? 'Вузли обладнання' : `${workspace.equipment.length} ${plural(workspace.equipment.length,['папка','папки','папок'])}`}</span><select aria-label="Сортування" data-list-sort><option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Спочатку останні</option><option value="name" ${sortBy === 'name' ? 'selected' : ''}>За назвою</option></select></div></div>
      <div id="desktop-content"></div><p class="workspace-footer">${icon('lock')}Дані зберігаються в цьому браузері на вашому комп’ютері.</p></section>`;
    renderDesktopContent();
  }
  function renderDesktopContent() {
    const target = document.querySelector('#desktop-content');
    if (!target) return;
    const source = currentEquipment ? currentEquipment.nodes : workspace.equipment;
    const filtered = source.filter(item => C.canonical(`${item.name} ${item.designation || ''}`).includes(C.canonical(searchText))).sort((a,b) => sortBy === 'name' ? a.name.localeCompare(b.name,'uk',{numeric:true}) : String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (!source.length) {
      target.innerHTML = `<div class="empty-workspace"><div class="empty-copy"><h2>${currentEquipment ? 'Додайте перший вузол' : 'Створіть першу папку обладнання'}</h2><p>${currentEquipment ? 'Кожне з’єднання має власні параметри роботи, прокладку та елементи кріплення.' : 'Додайте насос, апарат або трубопровід. Усередині зберігатимуться анкети його вузлів.'}</p><button class="button primary" data-action="${currentEquipment ? 'new-node' : 'new-equipment'}">${icon('plus')}${currentEquipment ? 'Створити вузол' : 'Створити обладнання'}</button></div><div class="empty-illustration">${emptyArt()}</div></div>`;
      return;
    }
    if (!filtered.length) { target.innerHTML = '<div class="no-results">Нічого не знайдено. Спробуйте іншу назву.</div>'; return; }
    if (currentEquipment) {
      target.innerHTML = `<div class="nodes-list"><div class="node-table-head"><span>Вузол</span><span>Тип з’єднання</span><span>Анкета</span><span>Змінено</span><span></span></div>${filtered.map(node => {
        const p = C.progress(node,materials,standardsDb);
        return `<div class="node-row"><button class="node-open" data-action="open-node" data-id="${node.id}"><span class="file-icon">${icon('file')}</span><span><strong>${esc(node.name)}</strong><small>${esc(node.fastener.nominalDiameter ? `М${node.fastener.nominalDiameter} · ` : '')}${node.fastener.type === 'bolt' ? 'Болтове з’єднання' : 'Шпилькове з’єднання'}</small></span></button><span class="node-kind">${kindName(node.connection.kind)}</span><div class="mini-progress ${p.done === p.total ? 'complete' : ''}"><span class="mini-track"><span style="width:${p.percent}%"></span></span><span>${p.done}/${p.total} блоків</span></div><span class="node-date">${date(node.updatedAt)}</span><div class="card-actions"><button class="icon-button" data-action="edit-node" data-id="${node.id}" aria-label="Перейменувати ${esc(node.name)}" title="Перейменувати">${icon('edit')}</button><button class="icon-button" data-action="copy-node" data-id="${node.id}" aria-label="Дублювати ${esc(node.name)}" title="Дублювати">${icon('copy')}</button><button class="icon-button danger" data-action="delete-node" data-id="${node.id}" aria-label="Видалити ${esc(node.name)}" title="Видалити">${icon('trash')}</button></div></div>`;
      }).join('')}</div>`;
    } else {
      target.innerHTML = `<div class="equipment-grid">${filtered.map(equipment => `<article class="equipment-card"><button class="equipment-open" data-action="open-equipment" data-id="${equipment.id}">${folderArt()}<h2>${esc(equipment.name)}</h2><p class="designation">${esc(equipment.designation || 'Обладнання')}</p></button><div class="equipment-card-footer"><span>${icon('file')}${equipment.nodes.length} ${plural(equipment.nodes.length,['вузол','вузли','вузлів'])}</span><div class="card-actions"><button class="icon-button" data-action="edit-equipment" data-id="${equipment.id}" aria-label="Редагувати ${esc(equipment.name)}" title="Редагувати">${icon('edit')}</button><button class="icon-button danger" data-action="delete-equipment" data-id="${equipment.id}" aria-label="Видалити ${esc(equipment.name)}" title="Видалити">${icon('trash')}</button></div></div></article>`).join('')}<button class="create-card" data-action="new-equipment"><span>${icon('plus')}</span>Нове обладнання</button></div>`;
    }
  }

  function field(path, label, unit = '', settings = {}) {
    const value = C.get(currentNode,path);
    const fieldId = `field-${path.replaceAll('.','-')}`;
    return `<div class="field"><label for="${fieldId}">${label}</label><div class="input-unit"><input id="${fieldId}" data-field="${path}" value="${esc(value)}" ${unit ? `inputmode="${settings.integer ? 'numeric' : 'decimal'}" data-number="true" data-min="${settings.min ?? 0}" ${settings.positive !== false ? 'data-positive="true"' : ''} ${settings.integer ? 'data-integer="true"' : ''}` : 'maxlength="120"'} autocomplete="off" placeholder="${esc(settings.placeholder || '—')}" ${unit === 'М' ? 'data-unit="М"' : ''}>${unit ? `<span ${unit === 'М' ? 'class="unit-prefix"' : ''}>${unit}</span>` : ''}</div>${settings.help ? `<p class="field-help">${settings.help}</p>` : ''}<p class="field-error" hidden></p></div>`;
  }
  function selectField(path, label, options) {
    return `<div class="field"><label for="field-${path.replaceAll('.','-')}">${label}</label><select id="field-${path.replaceAll('.','-')}" data-field="${path}">${options.map(([value,text]) => `<option value="${esc(value)}" ${C.get(currentNode,path) === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></div>`;
  }
  function materialField(path, label = 'Матеріал') {
    const ref = C.get(currentNode,path);
    const found = C.resolveMaterial(materials,ref);
    return `<p class="sub-label">${esc(label)}</p><button type="button" class="material-card ${!ref ? 'missing' : !found ? 'invalid' : ''}" data-action="pick-material" data-path="${path}" data-label="${esc(label)}" aria-label="${esc(label)}: ${esc(ref?.name || 'вибрати матеріал')}">${icon('material')}<span><strong>${esc(ref?.name || 'Вибрати матеріал')}</strong><small>${found ? `${found.grade.kp ? `КП ${esc(found.grade.kp)} · ` : ''}${esc(C.cleanDescription(found.material.name,found.grade.description))}` : ref ? 'Виконання відсутнє в базі. Виберіть повторно.' : 'Марка сталі / сплаву та КП'}</small></span>${icon('chevron','chevron')}</button>`;
  }
  function updateMaterialWarnings() {
    const labels = { RTm:'Rm', RTp:'Rp', E:'E', Alpha:'α' };
    for (const button of document.querySelectorAll('.material-card')) {
      const path = button.dataset.path;
      const keys = path.startsWith('nut.') ? ['RTm','RTp'] : path.startsWith('washers.') || path.startsWith('extras.') ? ['E','Alpha'] : ['RTm','RTp','E','Alpha'];
      const missing = C.missingProperties(materials, C.get(currentNode,path), currentNode.operating, keys);
      button.querySelector('.material-warning')?.remove();
      if (missing.length) {
        const warning = document.createElement('small');
        warning.className = 'material-warning';
        warning.textContent = `Немає даних: ${missing.map(item => `${labels[item.property]} (${item.mode === 'normal' ? 'НУЕ' : 'ГВ'})`).join(', ')}`;
        button.querySelector('span').appendChild(warning);
      }
    }
  }
  function statusMarkup(key, complete) {
    const optional = key === 'extras' && !currentNode.extras.length ? 'Не додано' : key === 'washers' && currentNode.washers.placement === 'none' ? 'Не потрібні' : 'Заповнено';
    return `<span class="section-status ${complete ? 'ready' : ''}">${complete ? icon('check') : ''}${complete ? optional : 'Заповнити'}</span>`;
  }
  function section(key, body, open, statuses) {
    return `<details class="settings-section" data-section="${key}" ${open ? 'open' : ''}><summary>${icon(key)}${sectionNames[key]}${statusMarkup(key,statuses[key])}${icon('down','section-chevron')}</summary><div class="section-body">${body}</div></details>`;
  }
  function standardBox(kind) {
    if (kind === 'washers') {
      const selection = currentNode.washers;
      const record = standardsDb.washers?.[selection.standardId];
      const diameter = C.number(currentNode.fastener.nominalDiameter);
      const dimensions = C.washerDimensions(standardsDb, selection.standardId, diameter, selection.accuracyClass, selection.execution);
      const label = record?.document || 'Стандарт шайб не знайдено';
      const rows = dimensions ? [['Товщина',dimensions.thicknessMm],['Зовнішній діаметр',dimensions.outerDiameterMm],['Внутрішній діаметр',dimensions.innerDiameterMm]] : [];
      const note = diameter === null ? 'Спочатку вкажіть номінальний діаметр різьби.' : !record ? 'Відсутні дані вибраного стандарту.' : `Немає нормативних розмірів для М${displayNumber(diameter)}, виконання ${esc(selection.execution)}, класу ${esc(selection.accuracyClass)}.`;
      return `<div class="standard-box"><span>${icon('file')}${esc(label)} · виконання ${esc(selection.execution)}, клас ${esc(selection.accuracyClass)}</span>${rows.length ? rows.map(([name,value]) => `<div class="readonly-line"><span>${name}</span><strong>${displayNumber(value)} мм</strong></div>`).join('') : note}</div>`;
    }
    if (kind === 'nuts') {
      const selection = currentNode.nut;
      const record = standardsDb.nuts?.[selection.standardId];
      const diameter = C.number(currentNode.fastener.nominalDiameter);
      const dimensions = C.nutDimensions(standardsDb, selection.standardId, diameter, selection.typeId || 'A');
      const label = record?.document || 'Стандарт гайок не знайдено';
      const note = diameter === null ? 'Спочатку вкажіть номінальний діаметр різьби.' : !record ? 'Відсутні дані вибраного стандарту.' : `Для М${displayNumber(diameter)} й обраного типу немає оцифрованої нормативної висоти.`;
      return `<div class="standard-box"><span>${icon('file')}${esc(label)}</span>${dimensions
        ? `<div class="readonly-line"><span>${esc(dimensions.heightLabel)} ${esc(dimensions.heightSymbol)}</span><strong>${displayNumber(dimensions.heightMm)} мм</strong></div>${dimensions.nonPreferred ? '<p class="field-help">Розмір у ГОСТ наведено в дужках; за можливості не застосовувати.</p>' : ''}${dimensions.typeId === 'B' ? '<p class="field-help">Для ковпачкової гайки l₁ — загальна висота, а не довжина зачеплення різьби чи висота опорної частини.</p>' : ''}`
        : note}</div>`;
    }
    return '';
  }
  function gasketReference() {
    const properties = [['seatingPressureMPa','Тиск обтиснення q₀','МПа'],['minimumPressureMPa','Мінімальний тиск qmin','МПа'],['maximumPressureMPa','Максимальний тиск qmax','МПа'],['elasticModulusMPa','Модуль пружності E','МПа'],['expansionMicroPerK','Коефіцієнт розширення α','10⁻⁶/К']];
    const filled = properties.filter(([key]) => C.number(standards.gasket[key]) !== null);
    return `<div class="standard-box"><span>${icon('lock')}Характеристики за ТУ${standards.gasket.document ? ` · ${esc(standards.gasket.document)}` : ''}</span>${filled.length ? filled.map(([key,label,unit]) => `<div class="readonly-line"><span>${label}</span><strong>${displayNumber(standards.gasket[key])} ${unit}</strong></div>`).join('') : 'Довідкові значення ще не внесено.'}</div>`;
  }
  function gasketSketch() {
    return `<svg viewBox="0 0 70 66" fill="none" aria-hidden="true"><circle cx="34" cy="32" r="26" fill="#e7effb" stroke="#91acd0"/><circle cx="34" cy="32" r="17" fill="#f5f8fd" stroke="#91acd0"/><circle cx="34" cy="10" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="56" cy="32" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="34" cy="54" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="12" cy="32" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><path d="M34 2v60M3 32h62" stroke="#a6bad7" stroke-dasharray="3 3"/></svg>`;
  }
  function settingsContent(openSections) {
    const node = currentNode;
    const statuses = C.sectionStatus(node,materials,standardsDb);
    const operating = `<div class="case-grid">${[['normal','НУЕ'],['hydro','ГВ']].map(([key,label]) => `<div><p class="case-title ${key === 'hydro' ? 'hydro' : ''}"><span></span>${label}</p>${field(`operating.${key}.pressure`,'Тиск','МПа',{positive:false})}${field(`operating.${key}.temperature`,'Температура','°C',{min:-273.15,positive:false})}${selectField(`operating.${key}.medium`,'Середовище',[['','Оберіть…'],...media.map(item => [item,item])])}</div>`).join('')}</div>`;
    const gasket = `<p class="section-intro">${esc(standards.gasket.name)}${standards.gasket.document ? ` · ${esc(standards.gasket.document)}` : ' · характеристики за ТУ'}</p><div class="choice-group" role="group" aria-label="Спосіб задання прокладки"><button data-action="gasket-mode" data-value="ring" aria-pressed="${node.gasket.mode === 'ring'}">Кільцева</button><button data-action="gasket-mode" data-value="area" aria-pressed="${node.gasket.mode === 'area'}">Задати площі</button></div>${field('gasket.thickness','Товщина прокладки','мм')}${node.gasket.mode === 'ring' ? `<div class="field-row">${field('gasket.outerDiameter','Зовнішній Ø','мм')}${field('gasket.innerDiameter','Внутрішній Ø','мм')}</div><label class="check-label"><input type="checkbox" data-field="gasket.hasHoles" ${node.gasket.hasHoles ? 'checked' : ''}>Отвори під кріплення</label>${node.gasket.hasHoles ? field('gasket.holeDiameter','Діаметр отвору','мм',{help:'Кількість отворів дорівнює кількості кріплень.'}) : ''}` : `${field('gasket.effectiveArea','Ефективна площа перерізу Aпр','мм²')}${field('gasket.pressureArea','Площа дії гідростатичного зусилля A','мм²')}<div class="gasket-help">${gasketSketch()}<span>Це дві різні площі. Введіть готові значення для нестандартної форми прокладки.</span></div>`}<p class="small-note">${icon('lock')}Характеристики матеріалу прокладки задаються за ТУ.</p>`;
    const threadStandardOptions = Object.values(standardsDb.threads || {}).map(item => [item.id, `${item.document} — ${item.title}`]);
    const selectedThreadStandard = standardsDb.threads?.[node.fastener.threadStandardId];
    const nominalThreadDiameter = C.number(node.fastener.nominalDiameter);
    const threadSize = nominalThreadDiameter === null ? null : selectedThreadStandard?.sizes?.[String(nominalThreadDiameter)];
    const pitchOptions = threadSize ? [
      ['', threadSize.coarsePitchMm === null ? 'Оберіть крок різьби…' : `Великий крок (авто): ${displayNumber(threadSize.coarsePitchMm)} мм`],
      ...threadSize.pitchesMm.map(pitch => [String(pitch), `P = ${displayNumber(pitch)} мм${pitch === threadSize.coarsePitchMm ? ' · великий' : ''}${threadSize.nonPreferredPitchesMm?.includes(pitch) ? ' · нерекомендований' : ''}`])
    ] : [['','Спочатку вкажіть діаметр з довідника']];
    const resolvedPitch = C.threadPitch(standardsDb,node.fastener.threadStandardId,nominalThreadDiameter,node.fastener.pitch);
    const pitchReference = resolvedPitch ? `Крок різьби: P = ${displayNumber(resolvedPitch.pitchMm)} мм${resolvedPitch.automatic ? ' (автоматично)' : ''}${resolvedPitch.nonPreferred ? ' · у ГОСТ 8724 наведений у дужках' : ''}.` : threadSize ? 'Для цього діаметра немає великого кроку. Оберіть допустимий крок вручну.' : 'Крок буде доступний після введення стандартного номінального діаметра.';
    const fastener = `${selectField('fastener.type','Виконання',[['stud','Шпилька в корпусі'],['bolt','Наскрізний болт із гайкою']])}${materialField('fastener.material','Матеріал кріплення')}<div class="field-row">${field('fastener.nominalDiameter','Діаметр різьби','М')}${field('fastener.count','Кількість','шт.',{integer:true})}</div>${selectField('fastener.threadStandardId','Стандарт різьби',threadStandardOptions)}${selectField('fastener.pitch','Крок різьби P',pitchOptions)}<p class="field-help">${esc(pitchReference)}</p><label class="check-label"><input type="checkbox" data-field="fastener.lubricated" ${node.fastener.lubricated ? 'checked' : ''}>Мащення є</label><p class="small-note">${icon('info')}Великі й дрібні кроки — за ГОСТ 8724-2002; розміри різьби — за ГОСТ 24705-2004. Розрахунок похідних розмірів буде додано окремо.</p>`;
    const connection = `${selectField('connection.kind','Тип з’єднання',[['body-cover','Корпус — кришка'],['flange-flange','Фланець — фланець'],['custom','Інше з’єднання']])}${['sideA','sideB'].map((key,index) => `<div class="side-title"><span class="side-letter">${index ? 'Б' : 'А'}</span>Деталь ${index + 1}</div>${field(`connection.${key}.name`,'Назва деталі')}${materialField(`connection.${key}.material`,`Матеріал деталі ${index + 1}`)}`).join('')}<p class="small-note">${icon('info')}Геометричні розміри фланців додаємо на наступному етапі.</p>`;
    const nutStandardOptions = Object.values(standardsDb.nuts || {}).map(item => [item.id, `${item.document} — ${item.title}`]);
    const currentNutStandard = standardsDb.nuts?.[node.nut.standardId];
    const nutTypeField = currentNutStandard?.types ? selectField('nut.typeId','Тип гайки',Object.entries(currentNutStandard.types).map(([id,type]) => [id,type.label])) : '';
    const nut = `${materialField('nut.material','Матеріал гайки')}${selectField('nut.standardId','Стандарт',nutStandardOptions)}${nutTypeField}<div class="readonly-line"><span>Номінальний діаметр</span><strong>${node.fastener.nominalDiameter ? `М${displayNumber(node.fastener.nominalDiameter)}` : '—'}</strong></div>${standardBox('nuts')}`;
    const washerStandardOptions = Object.values(standardsDb.washers || {}).map(item => [item.id, `${item.document} — ${item.scope}`]);
    const washers = `${selectField('washers.placement','Розташування',[['none','Шайб немає'],['a','Тільки з боку А'],['b','Тільки з боку Б'],['both','З обох боків']])}${node.washers.placement !== 'none' ? `${selectField('washers.standardId','Стандарт',washerStandardOptions)}<div class="field-row">${selectField('washers.execution','Виконання',[['1','Виконання 1'],['2','Виконання 2']])}${selectField('washers.accuracyClass','Клас точності',[['A','А'],['C','С']])}</div>${materialField('washers.material','Матеріал шайб')}${node.washers.placement === 'both' ? '<p class="section-intro">З обох боків використовуються однакові шайби.</p>' : ''}${standardBox('washers')}` : '<p class="section-intro">У цьому з’єднанні шайби не використовуються.</p>'}`;
    const extras = `<p class="section-intro">Проставки та інші деталі, що впливають на податливість з’єднання.</p>${node.extras.map((item,index) => `<div class="extra-card"><div class="extra-card-heading"><span>Елемент ${index + 1}</span><button class="icon-button danger" data-action="remove-extra" data-id="${item.id}" aria-label="Видалити додатковий елемент ${index + 1}">${icon('close')}</button></div>${field(`extras.${index}.name`,'Назва')}${materialField(`extras.${index}.material`,'Матеріал елемента')}<div class="field-row">${field(`extras.${index}.thickness`,'Товщина','мм')}${field(`extras.${index}.area`,'Площа перерізу','мм²')}</div></div>`).join('')}<button class="add-extra" data-action="add-extra">${icon('plus')}Додати елемент</button>`;
    return Object.entries({operating,gasket:gasket + gasketReference(),fastener,connection,nut,washers,extras}).map(([key,body]) => section(key,body,openSections.includes(key),statuses)).join('');
  }
  function renderEditor(preserve = false) {
    const oldSettings = document.querySelector('.settings');
    const scroll = preserve ? oldSettings?.scrollTop || 0 : 0;
    const openSections = preserve ? [...document.querySelectorAll('.settings-section[open]')].map(item => item.dataset.section) : ['operating'];
    const oldResults = preserve ? resultsState() : null;
    const node = currentNode;
    main.innerHTML = `<section class="editor"><div class="node-topbar"><div class="node-title"><button class="icon-button" data-action="open-equipment" data-id="${currentEquipment.id}" aria-label="Назад до вузлів">${icon('arrow')}</button><span class="file-icon">${icon('file')}</span><div><h1>${esc(node.name)}</h1><p>${esc(currentEquipment.name)} · ${kindName(node.connection.kind)}</p></div><button class="icon-button" data-action="edit-node" data-id="${node.id}" aria-label="Перейменувати вузол">${icon('edit')}</button></div><div class="torque-bar" aria-label="Межі моменту затягування"><div class="torque-item"><div class="torque-label">Мінімальний момент</div><div class="torque-value">Ще не розраховано</div></div><div class="torque-item"><div class="torque-label">Максимальний момент</div><div class="torque-value">Ще не розраховано</div></div><span class="torque-unit">Н·м</span></div></div><div class="editor-body"><aside class="settings" aria-label="Налаштування вузла"><div class="settings-heading"><div>${icon('settings')}Параметри вузла</div><small id="progress-count"></small></div>${settingsContent(openSections)}<p class="settings-bottom">Зміни зберігаються автоматично. Незавершену анкету можна доповнити пізніше.</p></aside><div class="results" id="results"></div></div></section>`;
    document.querySelector('.settings').scrollTop = scroll;
    refreshResults(oldResults);
    updateStatuses();
    document.querySelectorAll('[data-number]').forEach(validateInput);
  }
  function resultsState() {
    return { open:[...document.querySelectorAll('.calc-block[open]')].map(item => item.dataset.calc), scroll:document.querySelector('#results')?.scrollTop || 0 };
  }
  function refreshResults(previous = resultsState()) {
    const target = document.querySelector('#results');
    if (!target) return;
    const node = currentNode;
    const p = C.progress(node,materials,standardsDb);
    const washerA = ['a','both'].includes(node.washers.placement);
    const washerB = ['b','both'].includes(node.washers.placement);
    const piece = (type,text,title) => `<span class="stack-piece ${type}" title="${esc(title)}">${text}</span>`;
    const assembly = `${piece('nut','',node.fastener.type === 'bolt' ? 'Головка болта' : 'Гайка')}${washerA ? piece('washer','','Шайба, бік А') : ''}${piece('','А',node.connection.sideA.name)}${piece('gasket','','Прокладка')}${node.extras.map(item => piece('extra','',item.name || 'Додатковий елемент')).join('')}${piece('','Б',node.connection.sideB.name)}${washerB ? piece('washer','','Шайба, бік Б') : ''}${node.fastener.type === 'bolt' ? piece('nut','','Гайка') : ''}`;
    const blocks = [
      ['load','Розрахунок коефіцієнта навантаження',[['Податливість кріплення','мм/Н'],['Податливість прокладки','мм/Н'],['Податливість з’єднуваних деталей','мм/Н'],['Податливість додаткових елементів','мм/Н'],['Коефіцієнт навантаження χ','']]],
      ['thermal','Розрахунок лінійного розширення матеріалів',[['Подовження кріплення','мм'],['Розширення пакета деталей','мм'],['Температурне зусилля','Н']]],
      ['parameters','Розрахункові параметри',[['Зусилля обтиснення прокладки','Н'],['Гідростатичне зусилля','Н'],['Зусилля в кріпленні','Н'],['Зусилля на прокладку','Н']]],
      ['tightness','Виконання умов герметичності',[['Питомий тиск на прокладку','МПа'],['Мінімальний питомий тиск','МПа'],['Максимальний питомий тиск','МПа']]],
      ['stud','Розрахунок міцності кріплення',[['Напруження розтягу','МПа'],['Дотичні напруження','МПа'],['Еквівалентні напруження','МПа'],['Допустимі напруження','МПа']]],
      ['thread','Розрахунок міцності різьбових з’єднань',[['Різьблення з боку гайки','МПа'],['Різьблення з боку корпусу','МПа'],['Міцність гайки','МПа'],['Міцність корпусної деталі','МПа']]],
      ['limits','Визначення мінімального та максимального зусиль',[['Мінімальне зусилля затягування','Н'],['Максимальне зусилля затягування','Н'],['Мінімальний момент на ключі','Н·м'],['Максимальний момент на ключі','Н·м']]],
      ['flanges','Розрахунок міцності фланців',[]]
    ];
    const open = previous ? previous.open : ['load','parameters','stud'];
    target.innerHTML = `<div class="results-title"><h2>Розрахунок вузла</h2><span class="outline-badge">${p.done === p.total ? 'Анкета заповнена' : 'Анкета в роботі'}</span></div><p class="calculation-notice">${icon('info')}<span>Заповніть параметри з’єднання. Результати з’являться після підключення погоджених формул розрахунку.</span></p><div class="assembly-panel"><div class="assembly-caption"><strong>Склад з’єднання</strong><span>${C.positive(node.fastener.count) ? `${displayNumber(node.fastener.count)} ${node.fastener.type === 'bolt' ? 'болтів' : 'шпильок'}${C.positive(node.fastener.nominalDiameter) ? ` М${displayNumber(node.fastener.nominalDiameter)}` : ''}` : 'Кріплення не задано'}</span></div><div class="assembly-drawing"><div class="stack-visual" role="img" aria-label="Умовна схема: ${esc(node.connection.sideA.name)}, прокладка, ${esc(node.connection.sideB.name)}${node.extras.length ? `; додаткових елементів: ${node.extras.length}` : ''}; ${washerA || washerB ? 'із шайбами' : 'без шайб'}">${assembly}</div><div class="assembly-legend"><span><i class="legend-dot"></i>${esc(node.connection.sideA.name || 'Деталь А')} / ${esc(node.connection.sideB.name || 'Деталь Б')}</span><span><i class="legend-dot gasket"></i>Прокладка</span>${washerA || washerB ? '<span><i class="legend-dot washer"></i>Шайби</span>' : ''}${node.extras.length ? `<span><i class="legend-dot extra"></i>Додаткові: ${node.extras.length}</span>` : ''}</div></div></div>${blocks.map(([key,title,rows]) => `<details class="calc-block" data-calc="${key}" ${open.includes(key) ? 'open' : ''}><summary>${icon('chevron')}${title}<small>Ще не розраховано</small></summary>${rows.length ? `<table class="result-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([label,unit]) => `<tr><td>${label}${unit ? `<span>, ${unit}</span>` : ''}</td><td aria-label="Не розраховано">—</td><td aria-label="Не розраховано">—</td></tr>`).join('')}</tbody></table>` : '<p class="calc-footer">Геометрію фланців і перевірки перерізів А–А, В–В та С–С додаємо наступним етапом.</p>'}</details>`).join('')}<p class="results-end">${icon('file')}Розрахункова методика та експорт Excel будуть додані окремо.</p>`;
    target.scrollTop = previous?.scroll || 0;
  }
  function updateStatuses() {
    const p = C.progress(currentNode,materials);
    document.querySelector('#progress-count').textContent = `${p.done} / ${p.total} блоків`;
    for (const key of C.sections) {
      const summary = document.querySelector(`[data-section="${key}"] summary .section-status`);
      if (summary) summary.outerHTML = statusMarkup(key,p.statuses[key]);
    }
    updateMaterialWarnings();
    for (const box of document.querySelectorAll('[data-standard-kind]')) box.outerHTML = standardBox(box.dataset.standardKind);
    const nutDiameter = document.querySelector('[data-section="nut"] .readonly-line strong');
    if (nutDiameter) nutDiameter.textContent = C.positive(currentNode.fastener.nominalDiameter) ? `М${displayNumber(currentNode.fastener.nominalDiameter)}` : '—';
  }
  function validateInput(input) {
    const output = input.closest('.field')?.querySelector('.field-error');
    if (!output) return;
    const value = C.number(input.value);
    let message = '';
    if (input.value.trim() && (value === null || value < Number(input.dataset.min))) message = 'Вкажіть коректне число у зазначених одиницях.';
    if (value !== null && input.dataset.positive && value <= 0) message = 'Значення має бути більшим за нуль.';
    if (value !== null && input.dataset.integer && !Number.isInteger(value)) message = 'Кількість має бути цілим числом.';
    if (input.dataset.field === 'gasket.innerDiameter' && value !== null && C.positive(currentNode.gasket.outerDiameter) && value >= C.number(currentNode.gasket.outerDiameter)) message = 'Внутрішній діаметр має бути меншим за зовнішній.';
    output.textContent = message;
    output.hidden = !message;
    input.setAttribute('aria-invalid', String(!!message));
  }

  function openEdit(type, targetId) {
    const equipment = type.endsWith('equipment') ? workspace.equipment.find(item => item.id === targetId) : currentEquipment;
    const node = type.endsWith('node') ? currentEquipment.nodes.find(item => item.id === targetId) : null;
    editContext = { type, equipment, node };
    const deleting = type.startsWith('delete');
    const isEquipment = type.endsWith('equipment');
    const item = isEquipment ? equipment : node;
    const title = deleting ? `Видалити ${isEquipment ? 'обладнання' : 'вузол'}?` : type.startsWith('new') ? `Створити ${isEquipment ? 'обладнання' : 'вузол'}` : isEquipment ? 'Редагувати обладнання' : 'Перейменувати вузол';
    editDialog.innerHTML = `<form id="edit-form"><div class="dialog-header"><div><h2 id="edit-title">${title}</h2>${!deleting ? `<p>${isEquipment ? 'Окрема папка для вузлів одного обладнання.' : 'Окрема анкета для одного з’єднання.'}</p>` : ''}</div><button class="icon-button" type="button" data-action="close-edit" aria-label="Закрити">${icon('close')}</button></div><div class="dialog-body">${deleting ? `<p class="delete-description">${esc(item.name)}${isEquipment && equipment.nodes.length ? ` та всі його вузли (${equipment.nodes.length})` : ''} буде видалено з робочого простору.</p>` : `<div class="field"><label for="edit-name">${isEquipment ? 'Назва обладнання' : 'Назва вузла'}</label><input id="edit-name" name="name" required maxlength="120" value="${esc(item?.name || '')}" placeholder="${isEquipment ? 'Наприклад, насос 600В-1,6/100' : 'Наприклад, кришка — корпус'}" autocomplete="off"></div>${isEquipment ? `<div class="field"><label for="edit-designation">Позначення / позиція <span style="font-weight:400">(необов’язково)</span></label><input id="edit-designation" name="designation" maxlength="120" value="${esc(item?.designation || '')}" placeholder="Наприклад, Н-101" autocomplete="off"></div>` : type === 'new-node' ? '<div class="field"><label for="edit-kind">Тип з’єднання</label><select id="edit-kind" name="kind"><option value="body-cover">Корпус — кришка</option><option value="flange-flange">Фланець — фланець</option><option value="custom">Інше з’єднання</option></select></div>' : ''}`}<p class="dialog-error" id="edit-error" hidden></p></div><div class="dialog-footer"><button class="button secondary" type="button" data-action="close-edit">Скасувати</button><button class="button ${deleting ? 'danger' : 'primary'}" type="submit">${deleting ? 'Видалити' : type.startsWith('new') ? 'Створити' : 'Зберегти'}</button></div></form>`;
    editDialog.showModal();
    if (deleting) editDialog.querySelector('[data-action="close-edit"]').focus();
    else document.querySelector('#edit-name').focus();
  }
  editDialog.addEventListener('submit', event => {
    event.preventDefault();
    const { type, equipment, node } = editContext;
    const form = new FormData(event.target);
    const name = String(form.get('name') || '').trim();
    if (!type.startsWith('delete') && !name) {
      document.querySelector('#edit-error').textContent = 'Вкажіть назву.';
      document.querySelector('#edit-error').hidden = false;
      return;
    }
    let nextHash;
    if (type === 'new-equipment') {
      const created = C.createEquipment(name,String(form.get('designation') || ''));
      workspace.equipment.push(created);
      nextHash = `equipment/${created.id}`;
    } else if (type === 'edit-equipment') {
      equipment.name = name;
      equipment.designation = String(form.get('designation') || '').trim();
      equipment.updatedAt = C.timestamp();
    } else if (type === 'delete-equipment') {
      workspace.equipment = workspace.equipment.filter(item => item.id !== equipment.id);
      nextHash = '';
    } else if (type === 'new-node') {
      const created = C.createNode(name,String(form.get('kind')));
      equipment.nodes.push(created);
      equipment.updatedAt = C.timestamp();
      nextHash = `node/${equipment.id}/${created.id}`;
    } else if (type === 'edit-node') {
      node.name = name;
      node.updatedAt = C.timestamp();
      equipment.updatedAt = C.timestamp();
    } else if (type === 'delete-node') {
      equipment.nodes = equipment.nodes.filter(item => item.id !== node.id);
      equipment.updatedAt = C.timestamp();
      if (currentNode?.id === node.id) nextHash = `equipment/${equipment.id}`;
    }
    editDialog.close();
    save();
    if (nextHash !== undefined) navigate(nextHash);
    else renderRoute();
  });

  function openMaterial(path, label) {
    const ref = C.get(currentNode,path);
    const materialIndex = ref ? materials.findIndex(item => item.name === ref.name) : -1;
    const gradeIndex = materialIndex < 0 ? -1 : materials[materialIndex].grades.findIndex(item => String(item.kp ?? '') === ref.kp && (item.description ?? '') === ref.description);
    picker = { path, label, materialIndex: materialIndex >= 0 ? materialIndex : 0, gradeIndex: gradeIndex >= 0 ? gradeIndex : 0, query:'' };
    materialDialog.innerHTML = `<div class="dialog-header"><div><h2 id="material-title">Вибір матеріалу</h2><p>${esc(label)} · ${materials.length} марок у довіднику</p></div><button class="icon-button" data-action="close-material" aria-label="Закрити вибір матеріалу">${icon('close')}</button></div><div class="material-dialog-body"><div class="material-controls"><div class="search">${icon('search')}<input id="material-search" type="search" placeholder="Марка, КП або виконання…" aria-label="Пошук матеріалу" autocomplete="off"></div><div id="recent-materials"></div><div class="field"><label for="material-select">Марка сталі / сплаву</label><div class="material-select-row"><select id="material-select"></select><button class="icon-button favorite" id="material-favorite" data-action="favorite" aria-label="Додати до вибраного" title="Додати до вибраного">${icon('star')}</button></div></div><div class="field"><label id="kp-label" for="kp-trigger">Категорія міцності (КП)</label><div class="kp-picker"><button class="kp-trigger" id="kp-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="kp-options" data-action="toggle-kp"></button><div class="kp-options" id="kp-options" role="listbox" aria-labelledby="kp-label" hidden></div></div></div></div><div class="material-preview" id="material-preview"></div></div><div class="dialog-footer"><button class="button secondary" data-action="close-material">Скасувати</button><button class="button primary" id="apply-material" data-action="apply-material">Вибрати матеріал</button></div>`;
    renderRecents();
    updateMaterialList();
    materialDialog.showModal();
    document.querySelector('#material-search').focus();
  }
  function renderRecents() {
    document.querySelector('#recent-materials').innerHTML = workspace.preferences.recent.length ? `<p class="recent-label">Нещодавно вибрані</p><div class="recent-chips">${workspace.preferences.recent.filter(name => materials.some(item => item.name === name)).map(name => `<button class="recent-chip" data-action="recent-material" data-name="${esc(name)}">${esc(name)}</button>`).join('')}</div>` : '';
  }
  function updateMaterialList() {
    const query = C.canonical(picker.query);
    const options = materials.map((item,index) => ({item,index})).filter(({item}) => !query || C.canonical(`${item.name} ${item.grades.map(grade => `${grade.kp || ''} ${grade.description || ''}`).join(' ')}`).includes(query));
    if (!options.some(({index}) => index === picker.materialIndex)) {
      picker.materialIndex = options[0]?.index ?? -1;
      picker.gradeIndex = 0;
    }
    const select = document.querySelector('#material-select');
    const groups = [ ['Вибране', options.filter(({item}) => workspace.preferences.favorites.includes(item.name))], ['Всі матеріали', options.filter(({item}) => !workspace.preferences.favorites.includes(item.name))] ];
    select.innerHTML = options.length ? groups.filter(([,items]) => items.length).map(([label,items]) => `<optgroup label="${label}">${items.map(({item,index}) => `<option value="${index}" ${picker.materialIndex === index ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</optgroup>`).join('') : '<option value="">Нічого не знайдено</option>';
    select.disabled = !options.length;
    renderGradePicker();
  }
  function renderGradePicker() {
    const material = materials[picker.materialIndex];
    if (material && !material.grades[picker.gradeIndex]) picker.gradeIndex = 0;
    const grade = material?.grades[picker.gradeIndex];
    const trigger = document.querySelector('#kp-trigger');
    trigger.disabled = !grade;
    trigger.innerHTML = grade ? `<span><strong>${grade.kp ? `КП ${esc(grade.kp)}` : 'Без КП'}</strong><small>${esc(C.cleanDescription(material.name,grade.description))}</small></span>${icon('down')}` : '<span>Нічого не знайдено</span>';
    const choices = document.querySelector('#kp-options');
    choices.hidden = true;
    trigger.setAttribute('aria-expanded','false');
    choices.innerHTML = material ? material.grades.map((item,index) => `<button class="kp-option" role="option" aria-selected="${index === picker.gradeIndex}" data-action="select-grade" data-index="${index}"><strong>${item.kp ? `КП ${esc(item.kp)}` : 'Без КП'}</strong><small>${esc(C.cleanDescription(material.name,item.description))}</small></button>`).join('') : '';
    const favorite = document.querySelector('#material-favorite');
    const isFavorite = !!material && workspace.preferences.favorites.includes(material.name);
    favorite.classList.toggle('active',isFavorite);
    favorite.setAttribute('aria-label',isFavorite ? 'Прибрати з вибраного' : 'Додати до вибраного');
    favorite.setAttribute('aria-pressed',String(isFavorite));
    favorite.title = favorite.getAttribute('aria-label');
    favorite.disabled = !material;
    document.querySelector('#apply-material').disabled = !grade;
    renderMaterialPreview();
  }
  function renderMaterialPreview() {
    const material = materials[picker.materialIndex];
    const grade = material?.grades[picker.gradeIndex];
    const target = document.querySelector('#material-preview');
    if (!grade) { target.innerHTML = '<p class="material-empty">Матеріали не знайдено. Змініть пошуковий запит.</p>'; return; }
    const props = [['RTm','Границя міцності Rm','МПа'],['RTp','Границя текучості Rp','МПа'],['E','Модуль пружності E','ГПа'],['Alpha','Коефіцієнт розширення α','10⁻⁶/К']];
    target.innerHTML = `<h3>${esc(material.name)}</h3><p class="material-description">${grade.kp ? `КП ${esc(grade.kp)} · ` : ''}${esc(C.cleanDescription(material.name,grade.description))}</p><table class="material-properties"><thead><tr><th scope="col">Характеристика</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${props.map(([property,title,unit]) => `<tr><td>${title}<span>${unit}</span></td>${['normal','hydro'].map(mode => {
      const temperature = currentNode.operating[mode].temperature;
      const result = C.propertyAt(grade,property,temperature);
      return `<td>${result ? displayNumber(result.value) : '—'}<small>${result ? `при ${displayNumber(result.temperature)} °C` : C.number(temperature) === null ? 'Вкажіть температуру' : 'Немає даних'}</small></td>`;
    }).join('')}</tr>`).join('')}</tbody></table><p class="temperature-note">Для кожної характеристики використовується значення за заданої або найближчої більшої доступної температури. За межами наявних даних значення не підставляється.</p>`;
  }
  function closeKp() {
    const options = document.querySelector('#kp-options');
    if (options) options.hidden = true;
    document.querySelector('#kp-trigger')?.setAttribute('aria-expanded','false');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'home') navigate();
    else if (action === 'open-equipment') navigate(`equipment/${button.dataset.id}`);
    else if (action === 'open-node') navigate(`node/${currentEquipment.id}/${button.dataset.id}`);
    else if (['new-equipment','new-node','edit-equipment','edit-node','delete-equipment','delete-node'].includes(action)) openEdit(action,button.dataset.id);
    else if (action === 'close-edit') editDialog.close();
    else if (action === 'copy-node') {
      const source = currentEquipment.nodes.find(node => node.id === button.dataset.id);
      const clone = JSON.parse(JSON.stringify(source));
      clone.id = C.id(); clone.name = `${source.name} (копія)`; clone.createdAt = clone.updatedAt = C.timestamp();
      clone.extras.forEach(item => { item.id = C.id(); });
      currentEquipment.nodes.push(clone); currentEquipment.updatedAt = C.timestamp();
      save(); renderDesktop();
      document.querySelector('#workspace-search').value = searchText;
      toast('Копію вузла створено.');
    } else if (action === 'gasket-mode') {
      currentNode.gasket.mode = button.dataset.value; changed(); renderEditor(true);
    } else if (action === 'add-extra') {
      currentNode.extras.push({id:C.id(),name:'',thickness:'',area:'',material:null});
      changed(); renderEditor(true);
      const input = document.querySelector(`[data-field="extras.${currentNode.extras.length - 1}.name"]`);
      input.focus();
    } else if (action === 'remove-extra') {
      currentNode.extras = currentNode.extras.filter(item => item.id !== button.dataset.id);
      changed(); renderEditor(true);
    } else if (action === 'pick-material') openMaterial(button.dataset.path,button.dataset.label);
    else if (action === 'close-material') materialDialog.close();
    else if (action === 'apply-material') {
      const material = materials[picker.materialIndex];
      const grade = material?.grades[picker.gradeIndex];
      if (!grade) return;
      C.set(currentNode,picker.path,C.materialRef(material,grade));
      workspace.preferences.recent = [material.name,...workspace.preferences.recent.filter(name => name !== material.name)].slice(0,5);
      materialDialog.close(); changed(); renderEditor(true);
      document.querySelector(`[data-action="pick-material"][data-path="${picker.path}"]`)?.focus();
    } else if (action === 'toggle-kp') {
      const options = document.querySelector('#kp-options');
      options.hidden = !options.hidden;
      document.querySelector('#kp-trigger').setAttribute('aria-expanded',String(!options.hidden));
      if (!options.hidden) options.querySelector('[aria-selected="true"]')?.focus();
    } else if (action === 'select-grade') {
      picker.gradeIndex = Number(button.dataset.index); renderGradePicker(); document.querySelector('#kp-trigger').focus();
    } else if (action === 'recent-material') {
      picker.materialIndex = materials.findIndex(item => item.name === button.dataset.name); picker.gradeIndex = 0; picker.query = '';
      document.querySelector('#material-search').value = ''; updateMaterialList();
    } else if (action === 'favorite') {
      const name = materials[picker.materialIndex]?.name;
      if (!name) return;
      workspace.preferences.favorites = workspace.preferences.favorites.includes(name) ? workspace.preferences.favorites.filter(item => item !== name) : [...workspace.preferences.favorites,name];
      save(); updateMaterialList();
    } else if (action === 'recover') {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([rawSaved],{type:'application/json'}));
      link.download = 'prokladky-recovery.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href),1000);
    } else if (action === 'reset' && window.confirm('Завантажте збережені дані перед скиданням. Створити порожній робочий простір?')) {
      try { localStorage.removeItem(STORAGE_KEY); location.reload(); }
      catch (error) { toast('Браузер не дозволяє змінити збережені дані.'); }
    }
  });
  document.addEventListener('input', event => {
    const input = event.target;
    if (input.matches('[data-list-search]')) { searchText = input.value; renderDesktopContent(); return; }
    if (input.id === 'material-search') { picker.query = input.value; updateMaterialList(); return; }
    if (!currentNode || !input.dataset.field || input.type === 'checkbox' || input.tagName === 'SELECT') return;
    C.set(currentNode,input.dataset.field,input.value);
    if (input.dataset.field === 'fastener.nominalDiameter') currentNode.fastener.pitch = '';
    changed();
    if (input.dataset.number) validateInput(input);
    if (input.dataset.field.startsWith('gasket.') && ['outerDiameter','innerDiameter'].some(key => input.dataset.field.endsWith(key))) document.querySelector('[data-field="gasket.innerDiameter"]') && validateInput(document.querySelector('[data-field="gasket.innerDiameter"]'));
    updateStatuses(); refreshResults();
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-list-sort]')) { sortBy = input.value; renderDesktopContent(); return; }
    if (input.id === 'material-select') { picker.materialIndex = Number(input.value); picker.gradeIndex = 0; renderGradePicker(); return; }
    if (currentNode && input.dataset.field === 'fastener.nominalDiameter') { renderEditor(true); return; }
    if (!currentNode || !input.dataset.field || (input.tagName !== 'SELECT' && input.type !== 'checkbox')) return;
    if (input.dataset.field === 'connection.kind') {
      const old = currentNode.connection.kind;
      const previous = old === 'flange-flange' ? ['Фланець 1','Фланець 2'] : ['Кришка','Корпус'];
      const next = input.value === 'flange-flange' ? ['Фланець 1','Фланець 2'] : ['Кришка','Корпус'];
      ['sideA','sideB'].forEach((side,index) => { if (currentNode.connection[side].name === previous[index]) currentNode.connection[side].name = next[index]; });
    }
    C.set(currentNode,input.dataset.field,input.type === 'checkbox' ? input.checked : input.value);
    if (input.dataset.field === 'fastener.threadStandardId') currentNode.fastener.pitch = '';
    if (input.dataset.field === 'nut.standardId') currentNode.nut.typeId = 'A';
    // Execution 2 exists only for class A; keep selections compatible.
    if (input.dataset.field === 'washers.execution' && input.value === '2') currentNode.washers.accuracyClass = 'A';
    if (input.dataset.field === 'washers.accuracyClass' && input.value === 'C') currentNode.washers.execution = '1';
    changed(); renderEditor(true);
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && currentNode && !editDialog.open) {
      event.preventDefault();
      if (!materialDialog.open) openMaterial('fastener.material','Матеріал кріплення');
      document.querySelector('#material-search').focus();
    }
    if (!materialDialog.open) return;
    const options = document.querySelector('#kp-options');
    if (event.key === 'Escape' && !options.hidden) {
      event.preventDefault(); closeKp(); document.querySelector('#kp-trigger').focus();
    } else if (event.target.closest('#kp-options') && ['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...options.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0,Math.min(buttons.length - 1,index + (event.key === 'ArrowDown' ? 1 : -1)));
      buttons[next]?.focus();
    } else if (event.target.id === 'kp-trigger' && ['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault(); options.hidden = false; event.target.setAttribute('aria-expanded','true'); options.querySelector('[aria-selected="true"]')?.focus();
    }
  });
  materialDialog.addEventListener('click', event => { if (!event.target.closest('.kp-picker')) closeKp(); });
  materialDialog.addEventListener('cancel', event => {
    if (!document.querySelector('#kp-options').hidden) { event.preventDefault(); closeKp(); document.querySelector('#kp-trigger').focus(); }
  });
  window.addEventListener('hashchange',renderRoute);
  window.addEventListener('pagehide',save);
  window.addEventListener('beforeunload',event => {
    save();
    if (saveFailed) { event.preventDefault(); event.returnValue = ''; }
  });
  renderRoute();
  if (!materials.length) toast('Базу матеріалів не знайдено. Перевірте файл data.js поруч з index.html.');
})();
