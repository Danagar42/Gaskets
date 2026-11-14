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
  const fileDialog = document.querySelector('#file-dialog');
  const P = window.FlangeProject;
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
      workspace = P.normalize(saved);
    }
  } catch (error) { storageError = error.message; }
  let currentEquipment = null;
  let currentNode = null;
  let editContext = null;
  let picker = null;
  let searchText = '';
  let sortBy = 'recent';
  let saveTimer;
  let toastTimer;
  let saveFailed = false;
  let importedProject = null;
  let excelContext = null;
  const touchedFields = new Set();

  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content],{type}));
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function fileShell(title,body,footer = '') {
    fileDialog.innerHTML = `<div class="dialog-header"><div><h2 id="file-title">${title}</h2></div><button class="icon-button" data-action="close-file" aria-label="Закрити">${icon('close')}</button></div><div class="dialog-body file-body">${body}<p id="file-error" class="dialog-error" role="alert" hidden></p></div>${footer ? `<div class="dialog-footer">${footer}</div>` : ''}`;
    if (!fileDialog.open) fileDialog.showModal();
  }
  function fileError(error) {
    const target = document.querySelector('#file-error');
    if (!target || !fileDialog.open) return;
    target.textContent = error.message; target.hidden = false;
  }
  function openProjectFile() {
    importedProject = null;
    let backupAvailable = false;
    try { backupAvailable = !!localStorage.getItem(`${STORAGE_KEY}-before-import`); }
    catch { /* A browser storage error must not block downloading the in-memory project. */ }
    fileShell('Файл проєкту',`<p>Збережіть усе обладнання та анкети вузлів в окремий файл. Матеріали зберігаються як посилання на актуальну базу.</p><button class="button primary" data-action="save-project">${icon('save')}Зберегти JSON</button><hr><label class="field" for="project-upload"><strong>Відкрити резервну копію</strong><span>Спочатку покажемо вміст файла та спосіб відновлення.</span><input id="project-upload" type="file" accept=".json,application/json"></label><div id="import-preview" hidden></div>${backupAvailable ? '<button class="button secondary" data-action="download-before-import">Завантажити стан до останнього відновлення</button>' : ''}`);
  }
  fileDialog.addEventListener('change',async event => {
    if (event.target.id !== 'project-upload') return;
    importedProject = null;
    document.querySelector('#import-preview').hidden = true;
    document.querySelector('#file-error').hidden = true;
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > P.MAX_BYTES) throw new Error('Розмір проєкту перевищує 10 МБ.');
      const candidate = P.parse(await file.text());
      if (!event.target.isConnected || !fileDialog.open || event.target.files[0] !== file) return;
      importedProject = candidate;
      const count = candidate.equipment.reduce((sum,item) => sum + item.nodes.length,0);
      const preview = document.querySelector('#import-preview');
      preview.innerHTML = `<div class="import-summary"><strong>${candidate.equipment.length} обладнання · ${count} вузлів</strong><ul>${candidate.equipment.map(item => `<li>${esc(item.name)} <span>(${item.nodes.length})</span></li>`).join('')}</ul></div><label class="import-choice"><input type="radio" name="import-mode" value="add" checked><span><strong>Додати копії обладнання</strong><small>Поточні анкети залишаться. Імпортовані отримають нові ідентифікатори.</small></span></label><label class="import-choice"><input type="radio" name="import-mode" value="replace"><span><strong>Відновити весь проєкт із файла</strong><small>Замінить поточний простір. Попередній стан залишиться в резервній копії цього браузера.</small></span></label><button class="button primary" data-action="apply-import">Імпортувати</button>`;
      preview.hidden = false;
    } catch (error) {
      if (event.target.isConnected && fileDialog.open && event.target.files[0] === file) fileError(error);
    }
  });
  function applyImport() {
    if (!importedProject) return;
    try {
      const mode = fileDialog.querySelector('[name="import-mode"]:checked').value;
      const next = P.combine(workspace,importedProject,mode);
      clearTimeout(saveTimer);
      // Write successfully before changing the in-memory workspace.
      if (mode === 'replace') localStorage.setItem(`${STORAGE_KEY}-before-import`,storageError ? rawSaved : P.serialize(workspace));
      localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      workspace = next; storageError = ''; rawSaved = ''; saveFailed = false;
      currentEquipment = currentNode = null;
      searchText = '';
      fileDialog.close(); navigate();
      toast('Проєкт імпортовано.');
    } catch (error) { fileError(new Error(`Імпорт не виконано: ${error.message}`)); }
  }
  function openExcelExport(scope) {
    if (!currentEquipment) return;
    const nodes = scope === 'equipment' ? currentEquipment.nodes : [currentNode];
    if (!nodes.length || !nodes[0]) { toast('Спочатку додайте вузол.'); return; }
    excelContext = {equipment:JSON.parse(JSON.stringify(currentEquipment)),nodes:JSON.parse(JSON.stringify(nodes))};
    const reports = nodes.map(node => window.FlangeExcel.inspect(node,materials,standardsDb));
    const blocked = reports.some(report => report.errors.length);
    fileShell('Експорт у початковий Excel',`<p>${esc(currentEquipment.name)} · ${nodes.length} ${plural(nodes.length,['вузол','вузли','вузлів'])}. Кожен вузол матиме окремий редагований аркуш із формулами.</p><div class="export-nodes">${nodes.map((node,index) => {
      const report = reports[index];
      const torque = C.number(node.fastener.torqueNm) ?? (report.limits.maximum.roundedTorqueNm >= 0 ? report.limits.maximum.roundedTorqueNm : '');
      return `<section class="export-node"><h3>${esc(node.name)}</h3>${report.errors.length ? `<ul class="dialog-error">${report.errors.map(error => `<li>${esc(error)}</li>`).join('')}</ul>` : `<div class="field"><label for="excel-torque-${index}">Момент перевірки, Н·м</label><input id="excel-torque-${index}" data-excel-torque="${index}" inputmode="decimal" value="${esc(torque)}" required><small>Для C6 у файлі. ${C.number(node.fastener.torqueNm) === null ? 'Запропоновано округлений максимум.' : 'Взято з анкети.'} Анкета не зміниться.</small></div>`}${report.warnings.map(warning => `<p class="file-warning">${esc(warning)}</p>`).join('')}</section>`;
    }).join('')}</div><p class="file-warning">Схеми й оформлення збережені з шаблону; зображення не перебудовуються за новими розмірами. Характеристики металів беруться з поточної бази на момент експорту. Excel перерахує формули при відкритті.</p>`, `<button class="button secondary" data-action="close-file">Закрити</button><button class="button primary" data-action="download-excel" ${blocked ? 'disabled' : ''}>${icon('file')}Завантажити XLSX</button>`);
  }
  async function exportExcel(button) {
    if (!excelContext) return;
    const context = excelContext;
    const torques = [...fileDialog.querySelectorAll('[data-excel-torque]')].map(input => C.number(input.value));
    if (torques.some(value => value === null || value < 0)) { fileError(new Error('Вкажіть невід’ємний момент перевірки для кожного вузла.')); return; }
    button.disabled = true; button.textContent = 'Формую файл…';
    try {
      const result = await window.FlangeExcel.create({...context,materials,catalog:standardsDb,torques});
      const label = `${context.equipment.name}${context.nodes.length === 1 ? ' — '+context.nodes[0].name : ''}`.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,160);
      download(result,`${label}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      if (button.isConnected) fileDialog.close();
      toast('Excel сформовано. Формули перерахуються при відкритті файла.');
    } catch (error) { if (button.isConnected) fileError(error); }
    finally { button.disabled = false; button.textContent = 'Завантажити XLSX'; }
  }

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
      <div class="page-heading"><div class="${equipment ? 'folder-heading' : ''}">${equipment ? folderArt() : ''}<div><h1>${esc(equipment?.name || 'Моє обладнання')}</h1><p>${equipment ? `${esc(equipment.designation || 'Обладнання')} · ${equipment.nodes.length} ${plural(equipment.nodes.length,['вузол','вузли','вузлів'])}` : 'Обладнання та його фланцеві з’єднання в одному просторі.'}</p></div></div><div class="heading-actions">${equipment ? '<button class="button secondary" data-action="excel-export" data-scope="equipment">Excel обладнання</button>' : ''}<button class="button primary" data-action="${equipment ? 'new-node' : 'new-equipment'}">${icon('plus')}${equipment ? 'Створити вузол' : 'Створити обладнання'}</button></div></div>
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
    return `<div class="field"><label for="${fieldId}">${label}</label><div class="input-unit"><input id="${fieldId}" aria-describedby="${fieldId}-error" data-field="${path}" value="${esc(value)}" ${unit ? `inputmode="${settings.integer ? 'numeric' : 'decimal'}" data-number="true" data-min="${settings.min ?? 0}" ${settings.positive !== false ? 'data-positive="true"' : ''} ${settings.integer ? 'data-integer="true"' : ''}` : 'maxlength="120"'} autocomplete="off" placeholder="${esc(settings.placeholder || '—')}" ${unit === 'М' ? 'data-unit="М"' : ''}>${unit ? `<span ${unit === 'М' ? 'class="unit-prefix"' : ''}>${unit}</span>` : ''}</div>${settings.help ? `<p class="field-help">${settings.help}</p>` : ''}<p id="${fieldId}-error" class="field-error" aria-live="polite" hidden></p></div>`;
  }
  function selectField(path, label, options) {
    return `<div class="field"><label for="field-${path.replaceAll('.','-')}">${label}</label><select id="field-${path.replaceAll('.','-')}" aria-describedby="field-${path.replaceAll('.','-')}-error" data-field="${path}">${options.map(([value,text]) => `<option value="${esc(value)}" ${C.get(currentNode,path) === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select><p id="field-${path.replaceAll('.','-')}-error" class="field-error" aria-live="polite" hidden></p></div>`;
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
      const keys = path.startsWith('nut.') ? ['RTm','RTp'] : path.startsWith('extras.') ? ['E'] : path.startsWith('fastener.') ? ['RTm','RTp','E'] : path.startsWith('washers.') ? ['E','Alpha'] : ['RTm','RTp','E','Alpha'];
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
    const referenceId = currentNode.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID;
    const record = standardsDb.gaskets?.[referenceId];
    if (!record) return `<div class="standard-box" data-gasket-reference><span>${icon('file')}Характеристики графітової прокладки</span>Нормативні дані недоступні. Перевірте файл standards.bundle.js.</div>`;
    const scalarRows = [
      ['Модуль Юнга Eпр', record.elasticModulusMPa, 'МПа'],
      ['Питомий тиск обтиснення q₀', record.seatingPressureMPa, 'МПа'],
      ['Мінімальний питомий тиск qmin', record.minimumPressureMPa, 'МПа'],
      ['Максимальний питомий тиск qmax', record.maximumPressureMPa, 'МПа']
    ];
    const cases = [['normal','НУЕ'],['hydro','ГВ']];
    const stateRows = cases.map(([mode,label]) => {
      const state = currentNode.operating[mode];
      const m = C.gasketMediumCoefficient(standardsDb, referenceId, state.medium);
      const a = C.gasketExpansionAt(standardsDb, referenceId, state.temperature);
      const temp = C.number(state.temperature);
      return `<div class="readonly-line"><span>m, ${label} (${esc(state.medium || 'середовище не задано')})</span><strong>${m ? displayNumber(m.value) : '—'}</strong></div><div class="readonly-line"><span>α, ${label} (${temp === null ? 'T не задано' : `${displayNumber(temp)} °C`})</span><strong>${a ? `${displayNumber(a.value)} × 10⁻⁶/°C` : '—'}</strong></div>${a ? `<p class="field-help">α для ${label} взята з таблиці при ${displayNumber(a.temperatureC)} °C.</p>` : ''}`;
    }).join('');
    const alphaRows = Object.entries(record.expansionMicroPerCByTemperatureC || {}).map(([temp,value]) => `<div class="readonly-line"><span>${esc(temp)} °C</span><strong>${displayNumber(value)} × 10⁻⁶/°C</strong></div>`).join('');
    const warning = record.source?.verificationStatus === 'screenshot_only' ? '<p class="field-help">Номер та редакцію ТУ не встановлено. Дані оцифровані з наданого фрагмента: перед використанням у розрахунковій методиці потрібно підтвердити джерело.</p>' : '';
    return `<div class="standard-box" data-gasket-reference><span>${icon('file')}${esc(record.document || record.name)}</span>${scalarRows.map(([name,value,unit]) => `<div class="readonly-line"><span>${esc(name)}</span><strong>${displayNumber(value)} ${unit}</strong></div>`).join('')}<div class="readonly-line"><span>Ширина за таблицею Б.1</span><strong>Ширина поля прокладки</strong></div><p class="field-help">У розрахунку застосовано погоджене зменшення: b = 3,8√b₀ при b₀ &gt; 15 мм; інакше b = b₀.</p>${stateRows}<p class="field-help">Для α береться точна або найближча вища доступна таблична температура. Вище останньої точки значення не підставляється.</p><details><summary>Таблиця Б.2 — всі значення α</summary>${alphaRows}</details>${warning}</div>`;
  }
  function gasketSketch() {
    return `<svg viewBox="0 0 70 66" fill="none" aria-hidden="true"><circle cx="34" cy="32" r="26" fill="#e7effb" stroke="#91acd0"/><circle cx="34" cy="32" r="17" fill="#f5f8fd" stroke="#91acd0"/><circle cx="34" cy="10" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="56" cy="32" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="34" cy="54" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="12" cy="32" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><path d="M34 2v60M3 32h62" stroke="#a6bad7" stroke-dasharray="3 3"/></svg>`;
  }
  function settingsContent(openSections) {
    const node = currentNode;
    const statuses = C.sectionStatus(node,materials,standardsDb);
    const operating = `<div class="case-grid">${[['normal','НУЕ'],['hydro','ГВ']].map(([key,label]) => `<div><p class="case-title ${key === 'hydro' ? 'hydro' : ''}"><span></span>${label}</p>${field(`operating.${key}.pressure`,'Тиск','МПа',{positive:false})}${field(`operating.${key}.temperature`,'Температура','°C',{min:-273.15,positive:false})}${selectField(`operating.${key}.medium`,'Середовище',[['','Оберіть…'],...media.map(item => [item,item])])}</div>`).join('')}</div>`;
    const gasket = `<p class="section-intro">Графітова прокладка · параметри з таблиць Б.1–Б.2 застосовуються автоматично. Номер ТУ уточнюється.</p><div class="choice-group" role="group" aria-label="Спосіб задання прокладки"><button data-action="gasket-mode" data-value="ring" aria-pressed="${node.gasket.mode === 'ring'}">Кільцева</button><button data-action="gasket-mode" data-value="area" aria-pressed="${node.gasket.mode === 'area'}">Задати площі</button></div>${field('gasket.thickness','Товщина прокладки','мм')}${node.gasket.mode === 'ring' ? `<div class="field-row">${field('gasket.outerDiameter','Зовнішній Ø','мм')}${field('gasket.innerDiameter','Внутрішній Ø','мм')}</div><label class="check-label"><input type="checkbox" data-field="gasket.hasHoles" ${node.gasket.hasHoles ? 'checked' : ''}>Отвори під кріплення</label>${node.gasket.hasHoles ? field('gasket.holeDiameter','Діаметр отвору','мм',{help:'Кількість отворів дорівнює кількості кріплень.'}) : ''}` : `${field('gasket.effectiveArea','Ефективна площа перерізу Aпр','мм²')}${field('gasket.pressureArea','Площа дії гідростатичного зусилля A','мм²')}<div class="gasket-help">${gasketSketch()}<span>Це дві різні площі. Введіть готові значення для нестандартної форми прокладки.</span></div>`}<p class="small-note">${icon('lock')}Характеристики матеріалу прокладки задаються за ТУ.</p>`;
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
    const fastener = `${selectField('fastener.type','Виконання',[['stud','Шпилька в корпусі'],['bolt','Наскрізний болт із гайкою']])}${materialField('fastener.material','Матеріал кріплення')}<div class="field-row">${field('fastener.nominalDiameter','Діаметр різьби','М')}${field('fastener.count','Кількість','шт.',{integer:true})}</div>${selectField('fastener.threadStandardId','Стандарт різьби',threadStandardOptions)}${selectField('fastener.pitch','Крок різьби P',pitchOptions)}<p class="field-help">${esc(pitchReference)}</p><label class="check-label"><input type="checkbox" data-field="fastener.lubricated" ${node.fastener.lubricated ? 'checked' : ''}>Мащення є</label><p class="small-note">${icon('info')}Великі й дрібні кроки — за ГОСТ 8724-2002; розміри різьби — за ГОСТ 24705-2004. Похідні розміри показані в блоці геометрії.</p>`;
    const connection = `${selectField('connection.kind','Тип з’єднання',[['body-cover','Корпус — кришка'],['flange-flange','Фланець — фланець'],['custom','Інше з’єднання']])}${['sideA','sideB'].map((key,index) => `<div class="side-title"><span class="side-letter">${index ? 'Б' : 'А'}</span>Деталь ${index + 1}</div>${field(`connection.${key}.name`,'Назва деталі')}${materialField(`connection.${key}.material`,`Матеріал деталі ${index + 1}`)}`).join('')}<p class="small-note">${icon('info')}Нижче задаються застосовність та геометрія фланцевих перевірок для обох деталей.</p>`;
    const nutStandardOptions = Object.values(standardsDb.nuts || {}).map(item => [item.id, `${item.document} — ${item.title}`]);
    const currentNutStandard = standardsDb.nuts?.[node.nut.standardId];
    const nutTypeField = currentNutStandard?.types ? selectField('nut.typeId','Тип гайки',Object.entries(currentNutStandard.types).map(([id,type]) => [id,type.label])) : '';
    const nut = `${materialField('nut.material','Матеріал гайки')}${selectField('nut.standardId','Стандарт',nutStandardOptions)}${nutTypeField}<div class="readonly-line"><span>Номінальний діаметр</span><strong>${node.fastener.nominalDiameter ? `М${displayNumber(node.fastener.nominalDiameter)}` : '—'}</strong></div>${standardBox('nuts')}`;
    const washerStandardOptions = Object.values(standardsDb.washers || {}).map(item => [item.id, `${item.document} — ${item.scope}`]);
    const washers = `${selectField('washers.placement','Розташування',[['none','Шайб немає'],['a','Тільки з боку А'],['b','Тільки з боку Б'],['both','З обох боків']])}${node.washers.placement !== 'none' ? `${selectField('washers.standardId','Стандарт',washerStandardOptions)}<div class="field-row">${selectField('washers.execution','Виконання',[['1','Виконання 1'],['2','Виконання 2']])}${selectField('washers.accuracyClass','Клас точності',[['A','А'],['C','С']])}</div>${materialField('washers.material','Матеріал шайб')}${node.washers.placement === 'both' ? '<p class="section-intro">З обох боків використовуються однакові шайби.</p>' : ''}${standardBox('washers')}` : '<p class="section-intro">У цьому з’єднанні шайби не використовуються.</p>'}`;
    const extras = `<p class="section-intro">Проставки та інші деталі, що впливають на податливість з’єднання.</p>${node.extras.map((item,index) => `<div class="extra-card"><div class="extra-card-heading"><span>Елемент ${index + 1}</span><button class="icon-button danger" data-action="remove-extra" data-id="${item.id}" aria-label="Видалити додатковий елемент ${index + 1}">${icon('close')}</button></div>${field(`extras.${index}.name`,'Назва')}${materialField(`extras.${index}.material`,'Матеріал елемента')}<div class="field-row">${field(`extras.${index}.thickness`,'Товщина','мм')}${field(`extras.${index}.area`,'Площа перерізу','мм²')}</div></div>`).join('')}<button class="add-extra" data-action="add-extra">${icon('plus')}Додати елемент</button>`;
    const heightFields = `<div class="field-row">${field('connection.sideA.height','Висота деталі А','мм')}${field('connection.sideB.height','Висота деталі Б','мм')}</div><p class="field-help">А: ${esc(node.connection.sideA.name)}. Б: ${esc(node.connection.sideB.name)}. Для шпильки в корпусі висота деталі Б входить до різьбової довжини; для наскрізного болта обидві деталі — до нерізьбової.</p>`;
    const axialHole = field('fastener.axialHoleDiameter','Поздовжній отвір у кріпленні','мм',{positive:false,help:'Для суцільної шпильки або болта — 0.'});
    const nutThreadHeight = C.nutDimensions(standardsDb,node.nut.standardId,node.fastener.nominalDiameter,node.nut.typeId)?.typeId === 'B' ? field('nut.threadedHeight','Висота різьбової частини','мм',{help:'Для ковпачкової гайки загальна висота l₁ не використовується замість висоти різьбової частини.'}) : '';
    const areaFields = `<div class="field-row">${field('connection.sideA.area','Площа перерізу А','мм²',{placeholder:'Авто'})}${field('connection.sideB.area','Площа перерізу Б','мм²',{placeholder:'Авто'})}</div><p class="field-help">Порожнє поле: площа кільцевого поля прокладки з урахуванням отворів, як у контрольному Excel. Для іншого перерізу введіть власну площу. При ручному заданні площ прокладки площі деталей А/Б обов’язкові.</p>`;
    const torque = field('fastener.torqueNm','Заданий момент затягування','Н·м',{positive:false,help:'Для перевірки конкретного затягу. Нижня межа обчислюється незалежно від цього поля.'});
    const flangeFields = ['sideA','sideB'].map(side=>{
      const path = `flanges.${side}`;
      return `<div class="side-title">Фланець · ${esc(node.connection[side].name || (side === 'sideA' ? 'Деталь А' : 'Деталь Б'))}</div>${selectField(path+'.mode',`Перевірка фланця ${side === 'sideA' ? 'А' : 'Б'}`,[['pending','Оберіть застосовність…'],['flange','Розраховувати як фланець'],['none','Ця перевірка не застосовується']])}${node.flanges[side].mode === 'flange' ? `<div class="field-row">${field(path+'.innerDiameter','Внутрішній діаметр D','мм')}${field(path+'.boltCircle','Коло кріплень Dw','мм')}</div><div class="field-row">${field(path+'.outerDiameter','Зовнішній діаметр Df','мм')}${field(path+'.holeDiameter','Отвір під кріплення d₀','мм',{placeholder:'Авто',help:'Порожнє поле: d+3 при d≥27; d+2 при 10<d<27; інакше d+1. Можна ввести фактичний діаметр.'})}</div><div class="field-row">${field(path+'.height','Висота фланця hf','мм')}${field(path+'.coneHeight','Висота конуса h₂','мм',{positive:false})}</div><div class="field-row">${field(path+'.wallCylinder','Товщина стінки s₁','мм')}${field(path+'.wallCone','Товщина конуса s₂','мм')}</div>${node.gasket.mode === 'area' ? field(path+'.gasketDiameter','Розрахунковий діаметр Dm','мм',{help:'Для ручних площ задайте діаметр, потрібний для плеча e₂.'}) : '<p class="field-help">Dm береться за середнім діаметром кільцевої прокладки. Матеріал — із відповідної деталі з’єднання.</p>'}` : ''}`;
    }).join('');
    return Object.entries({operating,gasket:gasket + gasketReference(),fastener:fastener + axialHole + torque,connection:connection + heightFields + areaFields + flangeFields,nut:nut + nutThreadHeight,washers,extras}).map(([key,body]) => section(key,body,openSections.includes(key),statuses)).join('');
  }
  function renderEditor(preserve = false) {
    const oldSettings = document.querySelector('.settings');
    const scroll = preserve ? oldSettings?.scrollTop || 0 : 0;
    const openSections = preserve ? [...document.querySelectorAll('.settings-section[open]')].map(item => item.dataset.section) : ['operating'];
    const oldResults = preserve ? resultsState() : null;
    const node = currentNode;
    main.innerHTML = `<section class="editor"><div class="node-topbar"><div class="node-title"><button class="icon-button" data-action="open-equipment" data-id="${currentEquipment.id}" aria-label="Назад до вузлів">${icon('arrow')}</button><span class="file-icon">${icon('file')}</span><div><h1>${esc(node.name)}</h1><p>${esc(currentEquipment.name)} · ${kindName(node.connection.kind)}</p></div><button class="icon-button" data-action="edit-node" data-id="${node.id}" aria-label="Перейменувати вузол">${icon('edit')}</button></div><div class="torque-bar" aria-label="Межі моменту затягування"><div class="torque-item"><div class="torque-label">Мінімальний момент</div><div class="torque-value">Ще не розраховано</div></div><div class="torque-item"><div class="torque-label">Максимальний момент</div><div class="torque-value">Ще не розраховано</div></div><span class="torque-unit">Н·м</span></div></div><div class="editor-body"><aside class="settings" aria-label="Налаштування вузла"><div class="settings-heading"><div>${icon('settings')}Параметри вузла</div><small id="progress-count"></small></div><div id="input-validation" class="input-validation" role="status" hidden></div>${settingsContent(openSections)}<p class="settings-bottom">Зміни зберігаються автоматично. Незавершену анкету можна доповнити пізніше.</p></aside><div class="results" id="results"></div></div></section>`;
    document.querySelector('.settings').scrollTop = scroll;
    refreshResults(oldResults);
    updateStatuses();
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
    const open = previous ? previous.open : ['geometry','load','parameters','stud'];
    target.innerHTML = `<div class="results-title"><h2>Розрахунок вузла</h2><button class="button secondary" data-action="excel-export" data-scope="node">Експорт Excel</button><span class="outline-badge">${p.done === p.total ? 'Анкета заповнена' : 'Анкета в роботі'}</span></div><p class="calculation-notice">${icon('info')}<span>Обчислюються геометрія, податливість, коефіцієнт навантаження та температурний внесок. Міцність і межі затягування — наступні блоки.</span></p><div class="assembly-panel"><div class="assembly-caption"><strong>Склад з’єднання</strong><span>${C.positive(node.fastener.count) ? `${displayNumber(node.fastener.count)} ${node.fastener.type === 'bolt' ? 'болтів' : 'шпильок'}${C.positive(node.fastener.nominalDiameter) ? ` М${displayNumber(node.fastener.nominalDiameter)}` : ''}` : 'Кріплення не задано'}</span></div><div class="assembly-drawing"><div class="stack-visual" role="img" aria-label="Умовна схема: ${esc(node.connection.sideA.name)}, прокладка, ${esc(node.connection.sideB.name)}${node.extras.length ? `; додаткових елементів: ${node.extras.length}` : ''}; ${washerA || washerB ? 'із шайбами' : 'без шайб'}">${assembly}</div><div class="assembly-legend"><span><i class="legend-dot"></i>${esc(node.connection.sideA.name || 'Деталь А')} / ${esc(node.connection.sideB.name || 'Деталь Б')}</span><span><i class="legend-dot gasket"></i>Прокладка</span>${washerA || washerB ? '<span><i class="legend-dot washer"></i>Шайби</span>' : ''}${node.extras.length ? `<span><i class="legend-dot extra"></i>Додаткові: ${node.extras.length}</span>` : ''}</div></div></div>${blocks.map(([key,title,rows]) => `<details class="calc-block" data-calc="${key}" ${open.includes(key) ? 'open' : ''}><summary>${icon('chevron')}${title}<small>Ще не розраховано</small></summary>${rows.length ? `<table class="result-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([label,unit]) => `<tr><td>${label}${unit ? `<span>, ${unit}</span>` : ''}</td><td aria-label="Не розраховано">—</td><td aria-label="Не розраховано">—</td></tr>`).join('')}</tbody></table>` : '<p class="calc-footer">Геометрію фланців і перевірки перерізів А–А, В–В та С–С додаємо наступним етапом.</p>'}</details>`).join('')}<p class="results-end">${icon('file')}Редагований Excel із формулами — кнопка «Експорт Excel» над розрахунком.</p>`;
    target.querySelector('.assembly-panel').insertAdjacentHTML('afterend',geometryBlock(open.includes('geometry')));
    target.querySelector('[data-calc="load"]').outerHTML = complianceBlock(open.includes('load'));
    target.querySelector('[data-calc="thermal"]').outerHTML = thermalBlock(open.includes('thermal'));
    const forces = window.FlangeCalculations.nodeForces(node,materials,standardsDb);
    target.querySelector('[data-calc="parameters"]').outerHTML = forcesBlock(forces,open.includes('parameters'));
    target.querySelector('[data-calc="tightness"]').outerHTML = tightnessBlock(forces,open.includes('tightness'));
    const limits = window.FlangeCalculations.nodeLimits(node,materials,standardsDb);
    target.querySelector('[data-calc="limits"]').outerHTML = limitsBlock(limits,open.includes('limits'));
    const strength = window.FlangeCalculations.nodeStrength(node,materials,standardsDb);
    target.querySelector('[data-calc="stud"]').outerHTML = strengthBlock(strength,open.includes('stud'));
    target.querySelector('[data-calc="thread"]').outerHTML = threadStrengthBlock(strength,open.includes('thread'));
    target.querySelector('[data-calc="flanges"]').outerHTML = flangeBlock(limits.flanges,open.includes('flanges'));
    const minimum = document.querySelector('.torque-value');
    minimum.textContent = forces.minimum.roundedTorqueNm === null ? 'Потрібні дані' : `${displayNumber(forces.minimum.roundedTorqueNm)} Н·м`;
    minimum.classList.toggle('calculated',forces.minimum.roundedTorqueNm !== null);
    minimum.title = 'Нижня межа за умовами прокладки, округлена вгору як P88 Excel.';
    const maximum = document.querySelectorAll('.torque-value')[1];
    maximum.textContent = limits.maximum.roundedTorqueNm === null ? 'Потрібні дані' : `${displayNumber(limits.maximum.roundedTorqueNm)} Н·м`;
    maximum.classList.toggle('calculated',limits.maximum.roundedTorqueNm !== null);
    maximum.title = 'Верхня межа за формулами кріплення та різьби Excel, округлена вниз. Міцність фланців ще не враховано; перевірте результати меж.';
    document.querySelectorAll('.torque-label')[1].textContent = limits.flanges.configured ? 'Максимальний момент' : limits.maximum.scope === 'fastener-thread-only' ? 'Максимум без фланців' : 'Попередній максимум';
    maximum.title = limits.flanges.configured ? 'Верхня межа за обмеженнями всіх заданих деталей. Перевірте контроль округлених меж.' : 'Застосовність фланців ще не визначена для обох деталей. Це попередня верхня межа.';
    target.querySelector('.calculation-notice span').textContent = Object.keys(limits.inputErrors).length ? 'Виправте позначені помилки введення в анкеті. Розрахунок не підтверджений.' : limits.rangePassed ? 'Усі задані перевірки округлених меж виконані за перенесеною методикою Excel.' : limits.maximum.omitted.length ? 'Межі визначені як в Excel. Внутрішню різьбу чавунного корпусу без Rp пропущено; її міцність не підтверджена.' : limits.flanges.configured ? 'Фланці включені за вибраною застосовністю. Перевірте дані, сумісність і контроль округлених меж: підтвердженого діапазону поки немає.' : 'Для повного розрахунку визначте застосовність фланцевих перевірок для деталей А та Б. Наявні обмеження враховані; округлені межі перевіряються окремо.';
    target.scrollTop = previous?.scroll || 0;
  }
  function forcesBlock(calculated,open) {
    const rows = [['initialSingle','Початкове зусилля одного кріплення F₀₁w'],['initialTotal','Сумарне початкове зусилля F₀w'],['sealing','Зусилля для герметичності Aпр·m·p'],['hydrostatic','Гідростатичне зусилля Fp / Fh'],['seating','Зусилля обтиснення F₀b'],['thermal','Температурне зусилля Ft'],['fastener','Сумарне зусилля в кріпленні Fw'],['gasket','Зусилля на прокладку Fqпр']];
    const complete = ['normal','hydro'].every(mode => rows.every(([key]) => calculated.states[mode].values[key] !== null));
    return `<details class="calc-block" data-calc="parameters" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахункові параметри<small>${complete ? 'Обчислено' : 'Потрібні дані'}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр, Н</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label]) => `<tr><td>${label}</td>${['normal','hydro'].map(mode=>`<td>${displayNumber(calculated.states[mode].values[key])}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><p>Заданий момент: ${displayNumber(currentNode.fastener.torqueNm)} Н·м; ζ₁ = ${displayNumber(calculated.friction)}. m: НУЕ — ${displayNumber(calculated.states.normal.mediumCoefficient)}; ГВ — ${displayNumber(calculated.states.hydro.mediumCoefficient)}.</p><p>F₀₁w = M·1000/(ζ₁·d); Fw = F₀w + χ·Fp + Ft; Fqпр = F₀w − (1−χ)·Fp + Ft.</p>${['normal','hydro'].map(mode=>calculated.states[mode].issues.length ? `<details><summary>${mode === 'normal' ? 'НУЕ' : 'ГВ'}: потрібні дані (${calculated.states[mode].issues.length})</summary>${calculated.states[mode].issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}${(calculated.states[mode].warnings || []).map(warning=>`<p>${esc(warning)}</p>`).join('')}</details>` : '').join('')}</div></details>`;
  }
  function tightnessBlock(calculated,open) {
    const rows = [['seating','Початкове обтиснення F₀w ≥ F₀b','Н'],['sealing','Герметичність F₀w ≥ Aпр·m·p + (1−χ)·Fp + Ft','Н'],['minimumPressure','Мінімальний тиск q ≥ qmin','МПа'],['maximumPressure','Максимальний тиск q ≤ qmax','МПа']];
    const allChecks = ['normal','hydro'].flatMap(mode=>Object.values(calculated.states[mode].checks));
    const status = allChecks.some(check=>check.passed === false) ? 'Є невиконані умови' : allChecks.some(check=>check.passed === null) ? 'Потрібні дані' : 'Умови прокладки виконані';
    return `<details class="calc-block" data-calc="tightness" ${open ? 'open' : ''}><summary>${icon('chevron')}Виконання умов герметичності<small>${status}</small></summary><table class="result-table checks-table"><thead><tr><th scope="col">Умова</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label,unit])=>`<tr><td>${label}<span>, ${unit}</span></td>${['normal','hydro'].map(mode=>{
      const check = calculated.states[mode].checks[key];
      return `<td><strong class="check-result ${check.passed === null ? 'pending' : check.passed ? 'passed' : 'failed'}">${check.passed === null ? 'Потрібні дані' : check.passed ? 'Виконано' : 'Не виконано'}</strong><small>${displayNumber(check.actual)} ${key === 'maximumPressure' ? '≤' : '≥'} ${displayNumber(check.required)}</small></td>`;
    }).join('')}</tr>`).join('')}</tbody></table><p class="calc-footer">Перевіряється заданий момент із блока «Кріплення». q = Fqпр/Aпр. Знак +Ft в умові герметичності збережено за I43 початкового Excel. Виконання цих умов не підтверджує міцність вузла.</p></details>`;
  }
  function limitsBlock(calculated,open) {
    const names = {seating:'Початкове обтиснення',sealingRequired:'Герметичність під тиском',pressureRequired:'Мінімальний питомий тиск'};
    const label = item => `${names[item.key]} · ${item.mode === 'normal' ? 'НУЕ' : 'ГВ'}`;
    const result = calculated.minimum;
    const upper = calculated.maximum;
    const upperNames = {axial:'Розтяг без температурного внеску σ₁',thermalAxial:'Обмеження σ₃ за Excel',fastenerNut:'Різьба кріплення з боку гайки',fastenerBody:'Різьба шпильки з боку корпусу',nut:'Внутрішня різьба гайки',body:'Внутрішня різьба корпусу'};
    const upperLabel = item => `${item.side ? `Фланець ${item.side === 'sideA' ? 'А' : 'Б'}, ${item.section}–${item.section}` : upperNames[item.key]} · ${item.mode === 'normal' ? 'НУЕ' : 'ГВ'}`;
    const maxLabel = calculated.flanges.configured ? 'Максимум' : 'Попередній максимум';
    const boundsFailed = Object.values(calculated.verification).some(checked=>checked?.failed.length);
    const status = calculated.roundedOverlap === null ? 'Потрібні дані' : !calculated.roundedOverlap ? 'Межі несумісні' : boundsFailed ? 'Є невиконані умови на межах' : upper.omitted.length ? 'Межі за Excel; є пропуски' : calculated.rangePassed ? 'Межі перевірено' : 'Попередні межі';
    const overlap = calculated.rawOverlap === false ? 'Нижня межа перевищує верхню: діапазон за цими обмеженнями порожній.' : calculated.roundedOverlap === false ? 'Після округлення діапазон порожній: немає цілого значення Н·м між межами.' : calculated.roundedOverlap === null ? 'Для порівняння меж потрібні всі активні обмеження НУЕ та ГВ.' : 'Межі за обчисленими обмеженнями сумісні. ' + (calculated.flanges.configured ? 'Результати контролю наведені нижче.' : 'Потрібно визначити застосовність фланців.');
    const checkNames = {gasket:{seating:'Обтиснення прокладки',sealing:'Герметичність під тиском',minimumPressure:'Мінімальний питомий тиск',maximumPressure:'Максимальний питомий тиск'},checks:{axial:'Розтяг σ₁',thermalAxial:'Розтяг σ₃',equivalent:'Приведені напруження σ₄',torsion:'Кручення'},threads:upperNames,flanges:{pressureA:'Фланець: σ₂ у А–А',pressureB:'Фланець: σ₂ у B–B',bendingA:'Фланець: σrv у A–A',bendingB:'Фланець: σrv у B–B',bendingC:'Фланець: σrv у C–C'}};
    const verification = ['minimum','maximum'].map(bound=>{
      const checked = calculated.verification[bound];
      const title = `${bound === 'minimum' ? 'Нижня' : 'Верхня'} округлена межа`;
      if (!checked) return `<p>${title}: перевірка недоступна — момент не визначений або від’ємний.</p>`;
      const state = checked.failed.length ? 'Є невиконані умови' : checked.pending.length ? 'Потрібні дані' : checked.omitted.length ? 'Є пропущені перевірки' : 'Наявні перевірки пройдено';
      return `<details><summary>${title}: ${displayNumber(checked.torqueNm)} Н·м — ${state}</summary><p>Виконано ${checked.checks.length-checked.failed.length-checked.pending.length-checked.omitted.length} із ${checked.checks.length} наявних перевірок. ${calculated.flanges.configured ? 'Враховані задані фланцеві перевірки.' : 'Застосовність фланців ще не визначена повністю.'}</p>${[...checked.failed,...checked.pending,...checked.omitted].map(check=>`<p>${check.omitted ? 'Пропущено як в Excel' : check.passed === false ? 'Не виконано' : 'Потрібні дані'}: ${esc(checkNames[check.group][check.key])} · ${check.mode === 'normal' ? 'НУЕ' : 'ГВ'}.</p>`).join('')}</details>`;
    }).join('');
    return `<details class="calc-block" data-calc="limits" ${open ? 'open' : ''}><summary>${icon('chevron')}Межі затягування<small>${status}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">Мінімум</th><th scope="col">${maxLabel}</th></tr></thead><tbody><tr><td>Сумарне початкове зусилля, Н</td><td>${displayNumber(result.force)}</td><td>${displayNumber(upper.force)}</td></tr><tr><td>Розрахунковий момент, Н·м</td><td>${displayNumber(result.torqueNm)}</td><td>${displayNumber(upper.torqueNm)}</td></tr><tr><td>Округлений момент, Н·м</td><td>${displayNumber(result.roundedTorqueNm)}</td><td>${displayNumber(upper.roundedTorqueNm)}</td></tr></tbody></table><div class="calc-footer"><p><strong>${overlap}</strong></p><p>Визначає мінімум: ${result.governing.length ? result.governing.map(label).join('; ') : 'потрібні дані'}.</p><p>Визначає ${maxLabel.toLocaleLowerCase('uk-UA')}: ${upper.governing.length ? upper.governing.map(upperLabel).join('; ') : 'потрібні дані'}.</p><details><summary>Умови нижньої межі</summary>${result.candidates.map(item=>`<p>${label(item)}: ${displayNumber(item.force)} Н.</p>`).join('')}</details><details><summary>Обмеження верхньої межі</summary>${upper.candidates.map(item=>`<p>${upperLabel(item)}: ${item.omittedFromMaximum ? 'пропущено як в Excel: відсутній Rp чавунного корпусу' : item.active ? `${displayNumber(item.force)} Н` : 'не застосовується'}.</p>`).join('')}${upper.issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}</details><p>Контроль округлених меж незалежний від заданого моменту анкети:</p>${verification}<details><summary>Формули та округлення</summary><p>Fmin = max п’яти умов прокладки; Fmax = min активних обмежень кріплення, різьби та підключених фланців. M = F·ζ₁·d/(z·1000). Мінімум округлюється вгору, максимум униз до цілого Н·м, як P88/P89 Excel.</p><p>Збережено N67: [σ]·Aгладк·z − χ·Fp + Ft та O67: [σ]·Aгладк·z − χ·Fp − Ft. Ці формули не замінено оберненням перевірки σ₃. Окремі обмеження для σ₄, кручення й qmax у переліку Excel відсутні — їх контролює перевірка округлених меж.</p></details><p>${calculated.rangePassed ? 'Усі задані перевірки округлених меж виконані за перенесеною методикою Excel.' : upper.omitted.length ? 'Межі за Excel містять пропущену перевірку внутрішньої різьби чавунного корпусу. Її міцність не підтверджена.' : calculated.flanges.configured ? 'Є неповні або невиконані умови. Повний діапазон не підтверджено.' : 'Застосовність фланців визначена не повністю: максимум попередній.'}</p></div></details>`;
  }
  function strengthStatus(checks) {
    const active = checks.filter(check=>check.active && !check.omittedFromMaximum);
    return active.some(check=>check.passed === false) ? 'Є невиконані умови' : active.some(check=>check.passed === null) ? 'Потрібні дані' : checks.some(check=>check.omittedFromMaximum) ? 'Є пропущені перевірки' : 'Умови блока виконані';
  }
  function flangeBlock(calculated,open) {
    const rows = [['pressureA','А–А: напруження від тиску σ₂'],['bendingA','А–А: приведені напруження σrv'],['pressureB','B–B: напруження від тиску σ₂'],['bendingB','B–B: приведені напруження σrv'],['bendingC','C–C: приведені напруження σrv']];
    const checks = Object.values(calculated.sides).flatMap(side=>Object.values(side.states).flatMap(state=>Object.values(state.checks)));
    const status = !calculated.configured ? 'Оберіть застосовність' : checks.length ? strengthStatus(checks) : 'Не застосовується';
    const geometryRows = [['e1','Плече e₁','мм'],['e2','Плече e₂','мм'],['e3','Плече e₃','мм'],['y','Координата y','мм'],['s0','Розрахункова товщина s₀','мм'],['allowable','Базове допустиме напруження','МПа'],['WA','Момент опору WA','мм³'],['WB','Момент опору WB','мм³'],['WC','Момент опору WC','мм³'],['moment','Згинальний момент','Н·м']];
    return `<details class="calc-block" data-calc="flanges" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахунок міцності фланців<small>${status}</small></summary>${Object.entries(calculated.sides).map(([side,part])=>`<div class="calc-footer"><strong>Деталь ${side === 'sideA' ? 'А' : 'Б'} · ${esc(part.name)}</strong>${part.mode === 'pending' ? '<p>Виберіть застосовність у налаштуваннях з’єднання.</p>' : part.mode === 'none' ? '<p>Перевірка фланця явно вимкнена для цієї деталі.</p>' : `<p>${part.states.normal.castIron ? 'Чавун: базове допустиме напруження та А–А/B–B НУЕ — Rm/2,2. Для C–C з боку А збережено вираз Rp/Rm, як W46 Excel.' : 'Допустимі напруження визначаються за Rm та Rp з явним резервним виразом Excel.'}</p>`}</div>${part.mode === 'flange' ? `<table class="result-table checks-table"><thead><tr><th scope="col">Переріз і перевірка</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label])=>`<tr><td>${label}</td>${['normal','hydro'].map(mode=>strengthCell(part.states[mode].checks[key])).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><details><summary>Геометрія та моменти опору</summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${geometryRows.map(([key,label,unit])=>`<tr><td>${label}, ${unit}</td>${['normal','hydro'].map(mode=>`<td>${displayNumber(part.states[mode].values[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></details>${['normal','hydro'].map(mode=>`<details><summary>Джерела та дані ${mode === 'normal' ? 'НУЕ' : 'ГВ'}</summary>${part.states[mode].sources.map(source=>`<p>${source.key === 'RTm' ? 'Rm' : 'Rp'}: ${displayNumber(source.valueMPa)} МПа при ${displayNumber(source.temperature)} °C.</p>`).join('')}${part.states[mode].issues.map(esc).map(issue=>`<p>${issue}</p>`).join('')}</details>`).join('')}<p>${part.states.normal.cExempt ? 'Для C–C виконано hf > s₂: окрема перевірка не потрібна за гілкою Excel.' : 'C–C перевіряється при hf ≤ s₂.'} Приведені напруження ГВ відсутні в вихідному Excel; σ₂ при ГВ перевіряється.</p></div>` : ''}`).join('')}<p class="calc-footer">Розміри фланця задаються окремо від висот, використаних для податливості пакета. Власний діаметр отвору не підміняється діаметром отворів прокладки.</p></details>`;
  }
  function strengthCell(check) {
    if (!check.active) return '<td><small>Не застосовується</small></td>';
    if (check.omittedFromMaximum) return `<td><strong class="check-result pending">Пропущено як в Excel</strong><small>Rp чавуну не задано</small><small>τр = ${displayNumber(check.actual)} МПа</small></td>`;
    return `<td><strong class="check-result ${check.passed === null ? 'pending' : check.passed ? 'passed' : 'failed'}">${check.passed === null ? 'Потрібні дані' : check.passed ? 'Виконано' : 'Не виконано'}</strong><small>${displayNumber(check.actual)} ≤ ${displayNumber(check.allowable)} МПа</small><small>n = ${check.actual === 0 && check.allowable !== null ? '∞ (навантаження 0)' : displayNumber(check.margin)}</small></td>`;
  }
  function strengthSources(calculated) {
    return ['normal','hydro'].map(mode=>`<details><summary>Входи міцності ${mode === 'normal' ? 'НУЕ' : 'ГВ'}</summary>${calculated.states[mode].sources.map(source=>`<p>${esc(source.name)}: Rp = ${displayNumber(source.valueMPa)} МПа при ${displayNumber(source.temperature)} °C.</p>`).join('') || '<p>Матеріали ще не задані.</p>'}${calculated.states[mode].issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}${(calculated.states[mode].warnings || []).map(warning=>`<p>${esc(warning)}</p>`).join('')}</details>`).join('');
  }
  function strengthBlock(calculated,open) {
    const rows = [['axial','Розтяг без температурного внеску σ₁'],['thermalAxial','Розтяг із температурним внеском σ₃'],['equivalent','Приведені напруження σ₄'],['torsion','Кручення τsw']];
    const checks = ['normal','hydro'].flatMap(mode=>Object.values(calculated.states[mode].checks));
    return `<details class="calc-block" data-calc="stud" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахунок міцності кріплення<small>${strengthStatus(checks)}</small></summary><table class="result-table checks-table"><thead><tr><th scope="col">Перевірка</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label])=>`<tr><td>${label}</td>${['normal','hydro'].map(mode=>strengthCell(calculated.states[mode].checks[key])).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><p>Як у Excel: σ₁ = (F₀w + χ·Fp)/(Aгладк·z); σ₃ = Fw/(Aгладк·z); σ₄ = √(σ₃² + 4τsw²). Використовується площа гладкого перерізу.</p><p>Для НУЕ допустимі σ₁, σ₃, σ₄: Rp/2, 1,3·Rp/2, 1,7·Rp/2. Для ГВ: σ₁ ≤ 0,7·Rp; перевірки σ₃ та σ₄ відсутні в Excel.</p><p>ζ = ${displayNumber(calculated.torsionFactor)}; момент кручення Mкр = F₀₁w·ζ·d₃ = ${displayNumber(calculated.states.normal.values.torsionMoment)} Н·мм. τsw = Mкр/[0,196·(d⁴−dотв⁴)/d], допустиме τsw = Rp/4 для обох режимів.</p>${strengthSources(calculated)}<p>Цей блок перевіряє заданий момент. Застосовність фланців та контроль меж показані в блоці «Межі затягування».</p></div></details>`;
  }
  function threadStrengthBlock(calculated,open) {
    const rows = [['fastenerNut','Різьба кріплення з боку гайки'],['fastenerBody','Різьба шпильки з боку корпусу'],['nut','Внутрішня різьба гайки'],['body','Внутрішня різьба корпусу']];
    const checks = ['normal','hydro'].flatMap(mode=>Object.values(calculated.states[mode].threads));
    return `<details class="calc-block" data-calc="thread" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахунок міцності різьбових з’єднань<small>${strengthStatus(checks)}</small></summary><table class="result-table checks-table"><thead><tr><th scope="col">Зріз різьби</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label])=>`<tr><td>${label}</td>${['normal','hydro'].map(mode=>strengthCell(calculated.states[mode].threads[key])).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><p>τр = Fw/(π·dрозр·h·z·K₁·Km). Для зовнішньої різьби dрозр = d₃, для внутрішньої — номінальний d.</p><p>Допустимі напруження: кріплення й гайка — 0,32·Rp для НУЕ, 0,25·Rp для ГВ; корпус — 0,32·Rp для обох режимів, як N/O45 Excel.</p><details><summary>Висоти та коефіцієнти різьби</summary>${rows.map(([key,label])=>{
      const part = calculated.states.normal.threads[key];
      return `<p>${label}: ${part.active ? `h = ${displayNumber(part.height)} мм; K₁ = ${displayNumber(part.k1)}; Km = ${displayNumber(part.km)}.` : 'не застосовується для наскрізного болта.'}</p>`;
    }).join('')}<p>Коефіцієнти перенесено з C43/C44, C78/C79, C96/C97 початкового Excel. Для ковпачкової гайки потрібна введена висота різьбової частини.</p></details>${strengthSources(calculated)}<p>Для наскрізного болта різьбова пара з корпусом не перевіряється. Відсутній Rp або потрібна висота дають стан «Потрібні дані». Виняток за рішенням користувача: внутрішню різьбу чавунного корпусу без таблиці Rp пропускаємо при визначенні максимуму, як Excel, із явною позначкою.</p></div></details>`;
  }
  function geometryBlock(open) {
    const calculated = window.FlangeCalculations.nodeGeometry(currentNode,standardsDb);
    const groups = [
      ['Прокладка',calculated.gasket,currentNode.gasket.mode === 'ring' ? [['width','Реальна ширина b₀','мм'],['effectiveWidth','Ефективна ширина b','мм'],['meanDiameter','Середній діаметр','мм'],...(currentNode.gasket.hasHoles ? [['holeWidth','Ширина по отвору','мм'],['effectiveHoleWidth','Ефективна ширина по отвору','мм']] : []),['effectiveArea','Ефективна площа Aпр','мм²'],['pressureArea','Площа дії гідростатичного зусилля A','мм²']] : [['effectiveArea','Ефективна площа Aпр (введено)','мм²'],['pressureArea','Площа дії гідростатичного зусилля A (введено)','мм²']]],
      ['Кріплення',calculated.thread,[['rootDiameter','Діаметр d₃','мм'],['meanDiameter','Середній діаметр d₂','мм'],['smoothArea','Площа гладкого перерізу','мм²'],['threadArea','Площа різьбового перерізу','мм²']]],
      ['Довжини пакета',calculated.lengths,[['smoothLength','Нерізьбова довжина L*','мм'],['threadedLength','Різьбова довжина L**','мм'],['totalLength','Сума L* + L**','мм']]]
    ];
    const complete = groups.every(([,result]) => !result.issues.length);
    return `<details class="calc-block" data-calc="geometry" ${open ? 'open' : ''}><summary>${icon('chevron')}Геометрія прокладки та кріплення<small>${complete ? 'Обчислено' : 'Потрібні дані'}</small></summary>${groups.map(([title,result,rows]) => `<table class="result-table geometry-table"><thead><tr><th scope="col">${title}</th><th scope="col">Значення</th></tr></thead><tbody>${rows.map(([key,label,unit]) => `<tr><td>${label}<span>, ${unit}</span></td><td>${displayNumber(result.values[key])}</td></tr>`).join('')}</tbody></table>${result.issues.length ? `<p class="calc-footer">${result.issues.map(esc).join(' ')}</p>` : ''}`).join('')}<div class="calc-footer"><p>При b₀ &gt; 15 мм: b = 3,8√b₀; інакше b = b₀.</p><details><summary>Склад різьбової та нерізьбової довжин</summary>${calculated.lengths.parts.map(part => `<p>${esc(part.name)}: ${displayNumber(part.height)} мм — ${part.threaded ? 'різьбова' : 'нерізьбова'} частина.</p>`).join('')}</details><p>Сума L* + L** — розрахункова довжина пакета, не готова замовна довжина кріплення.</p></div></details>`;
  }
  function complianceBlock(open) {
    const calculated = window.FlangeCalculations.nodeCompliance(currentNode,materials,standardsDb);
    const modes = [['normal','НУЕ'],['hydro','ГВ']];
    const rows = [['gasket','Податливість прокладки λпр'],['sideA','Податливість деталі А'],['sideB','Податливість деталі Б'],['washerA','Податливість шайб боку А'],['washerB','Податливість шайб боку Б'],['extras','Податливість додаткових елементів'],['smoothPart','Нерізьбова частина одного кріплення'],['threadedPart','Різьбова частина одного кріплення'],['threadJoint1','Поправка різьбової частини 1'],['threadJoint2','Поправка різьбової частини 2'],['fastener','Податливість комплекту кріплень λw'],['loadFactor','Коефіцієнт навантаження χ']];
    const format = (value,factor) => value === null ? '—' : value === 0 ? '0' : new Intl.NumberFormat('uk-UA',{notation:factor ? 'standard' : 'scientific',maximumFractionDigits:factor ? 6 : 5}).format(value);
    const complete = modes.every(([mode]) => calculated.states[mode].values.loadFactor !== null);
    return `<details class="calc-block" data-calc="load" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахунок коефіцієнта навантаження<small>${complete ? 'Обчислено' : 'Потрібні дані'}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label]) => `<tr><td>${label}${key === 'loadFactor' ? '' : '<span>, мм/Н</span>'}</td>${modes.map(([mode]) => `<td>${format(calculated.states[mode].values[key],key === 'loadFactor')}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><p>Перерізи деталей: А = ${displayNumber(calculated.areas.sideA)} мм²; Б = ${displayNumber(calculated.areas.sideB)} мм².</p>${modes.map(([mode,label]) => {
      const result = calculated.states[mode];
      return `<p>${label}: ${result.fastenerClass === 'short' ? 'коротке кріплення, L* &lt; 6d₀' : result.fastenerClass === 'long' ? 'довге кріплення, L* ≥ 6d₀' : 'тип кріплення ще не визначено'}.</p>${result.issues.length ? `<details><summary>${label}: дані для перевірки (${result.issues.length})</summary>${result.issues.map(issue => `<p>${esc(issue)}</p>`).join('')}</details>` : ''}<details><summary>Модулі E, використані для ${label}</summary>${result.sources.map(source => `<p>${esc(source.name)}: ${displayNumber(source.valueMPa)} МПа при ${displayNumber(source.temperature)} °C.</p>`).join('') || '<p>Дані ще не задані.</p>'}</details>`;
    }).join('')}<p>χ = λпр / (λпр + λдеталей + λшайб + λдодаткових + λw). Для довгого кріплення збережена гілка Excel λw = λнерізьбової / z.</p></div></details>`;
  }
  function thermalBlock(open) {
    const calculated = window.FlangeCalculations.nodeThermal(currentNode,materials,standardsDb);
    const rows = [['fastener','Розширення шпильки / болта'],['gasket','Розширення прокладки'],['sideA','Розширення деталі А'],['sideB','Деталь Б — для наскрізного болта'],['washerA','Розширення шайби А'],['washerB','Розширення шайби Б'],['extras','Додаткові елементи — тільки податливість'],['pack','Сумарне розширення пакета'],['force','Температурне зусилля Ft']];
    const format = value => value === null ? '—' : value === 0 ? '0' : new Intl.NumberFormat('uk-UA',{notation:Math.abs(value)<1e-4 ? 'scientific' : 'standard',maximumSignificantDigits:7}).format(value);
    const normal = calculated.normal;
    return `<details class="calc-block" data-calc="thermal" ${open ? 'open' : ''}><summary>${icon('chevron')}Лінійне розширення та температурне зусилля<small>${normal.values.force === null ? 'Потрібні дані НУЕ' : 'Обчислено'}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label]) => `<tr><td>${label}<span>, ${key === 'force' ? 'Н' : 'мм'}</span></td><td>${format(normal.values[key])}</td><td title="Консервативно прийнято 0">0</td></tr>`).join('')}</tbody></table><div class="calc-footer"><p>Температура відліку: 20 °C. Розширення кріплення в усіх режимах і температурний внесок ГВ консервативно прийняті нульовими.</p><p>Для НУЕ: Ft = (Δlпакета − 0) / Σλ. Проставки впливають на Σλ, їхній внесок у розширення не враховується.</p><p>α прокладки: точна або найближча вища таблична температура; вище останньої точки значення недоступне.</p>${normal.issues.length ? `<details><summary>Дані для перевірки НУЕ (${normal.issues.length})</summary>${normal.issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}</details>` : ''}<details><summary>Використані коефіцієнти α</summary>${normal.sources.map(source=>`<p>${esc(source.name)}: ${displayNumber(source.value)} × 10⁻⁶/К при ${displayNumber(source.temperature)} °C.</p>`).join('') || '<p>Дані ще не задані.</p>'}</details></div></details>`;
  }
  function updateStatuses() {
    const p = C.progress(currentNode,materials,standardsDb);
    document.querySelector('#progress-count').textContent = `${p.done} / ${p.total} блоків`;
    for (const key of C.sections) {
      const summary = document.querySelector(`[data-section="${key}"] summary .section-status`);
      if (summary) summary.outerHTML = statusMarkup(key,p.statuses[key]);
    }
    updateMaterialWarnings();
    const gasketPanel = document.querySelector('[data-gasket-reference]');
    if (gasketPanel) gasketPanel.outerHTML = gasketReference();
    for (const box of document.querySelectorAll('[data-standard-kind]')) box.outerHTML = standardBox(box.dataset.standardKind);
    const nutDiameter = document.querySelector('[data-section="nut"] .readonly-line strong');
    if (nutDiameter) nutDiameter.textContent = C.positive(currentNode.fastener.nominalDiameter) ? `М${displayNumber(currentNode.fastener.nominalDiameter)}` : '—';
    updateValidation();
  }
  function updateValidation() {
    const report = C.validateInputs(currentNode,standardsDb);
    let count = 0;
    for (const input of document.querySelectorAll('[data-field]')) {
      const output = input.closest('.field')?.querySelector('.field-error');
      if (!output) continue;
      const path = input.dataset.field;
      const message = report.errors[path] || (touchedFields.has(`${currentNode.id}:${path}`) ? report.missing[path] : '') || '';
      if (output.textContent !== message) output.textContent = message;
      output.hidden = !message;
      input.setAttribute('aria-invalid',String(!!message));
      if (message) count++;
    }
    const notice = document.querySelector('#input-validation');
    if (notice) {
      notice.hidden = !count;
      notice.innerHTML = count ? `<span>Помилки у полях: ${count}.</span><button data-action="first-input-error">Перейти до першої</button>` : '';
    }
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
    if (action === 'first-input-error') {
      const input = document.querySelector('[data-field][aria-invalid="true"]');
      if (input) { const section = input.closest('.settings-section'); if (section) section.open = true; input.focus(); }
    }
    else if (action === 'project-file') openProjectFile();
    else if (action === 'close-file') fileDialog.close();
    else if (action === 'save-project') {
      try { download(P.serialize(workspace),`Прокладки-${new Date().toISOString().slice(0,10)}.json`,'application/json'); }
      catch (error) { fileError(error); }
    }
    else if (action === 'download-before-import') download(localStorage.getItem(`${STORAGE_KEY}-before-import`),'Прокладки-до-відновлення.json','application/json');
    else if (action === 'apply-import') applyImport();
    else if (action === 'excel-export') openExcelExport(button.dataset.scope);
    else if (action === 'download-excel') exportExcel(button);
    else if (action === 'home') navigate();
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
    touchedFields.add(`${currentNode.id}:${input.dataset.field}`);
    if (input.dataset.field === 'fastener.nominalDiameter') {
      currentNode.fastener.pitch = '';
      currentNode.nut.threadedHeight = '';
    }
    changed();
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
    touchedFields.add(`${currentNode.id}:${input.dataset.field}`);
    if (input.dataset.field === 'fastener.threadStandardId') currentNode.fastener.pitch = '';
    if (['nut.standardId','nut.typeId'].includes(input.dataset.field)) currentNode.nut.threadedHeight = '';
    if (input.dataset.field === 'nut.standardId') currentNode.nut.typeId = 'A';
    // Execution 2 exists only for class A; keep selections compatible.
    if (input.dataset.field === 'washers.execution' && input.value === '2') currentNode.washers.accuracyClass = 'A';
    if (input.dataset.field === 'washers.accuracyClass' && input.value === 'C') currentNode.washers.execution = '1';
    changed(); renderEditor(true);
  });
  document.addEventListener('focusout',event => {
    if (!currentNode || !event.target.dataset.field) return;
    touchedFields.add(`${currentNode.id}:${event.target.dataset.field}`);
    updateValidation();
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
