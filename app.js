(function () {
  'use strict';
  const C = window.FlangeCore;
  const materials = typeof materialsDB === 'undefined' ? [] : materialsDB;
  const standardsDb = window.FlangeStandardsDB || {washers: {}};
  const STORAGE_KEY = 'flange-workspace-v1';
  const main = document.querySelector('#main');
  const editDialog = document.querySelector('#edit-dialog');
  const materialDialog = document.querySelector('#material-dialog');
  const fileDialog = document.querySelector('#file-dialog');
  const P = window.FlangeProject;
  const media = ['Відсутнє','Рідина','Вода','Мастило','Олива','Розчин','Пар','Повітря','Водень','Гелій','Газ','Газ з високою проникною властивістю'];
  const sectionNames = { scheme:'Схема вузла', operating:'Технологічні параметри', fastener:'Кріплення', gasket:'Прокладка', connection:'Деталі з’єднання', nut:'Гайка', washers:'Шайба', extras:'Додаткові елементи' };
  const editorSteps = ['scheme','operating','fastener','gasket','nut','washers','connection','extras','results'];
  let editorStep = 'scheme';
  let connectionSide = 'sideA', connectionDimension = '', previewNut = 'nut';
  const visibleSteps = () => editorSteps.filter(key=>key !== 'nut' || C.mounting(currentNode).nuts.length);
  const paths = {
    plus:'M12 5v14M5 12h14', search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow:'m14 6-6 6 6 6', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', close:'m6 6 12 12M18 6 6 18',
    edit:'m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h6', copy:'M9 8h12v13H9zM15 8V3H3v13h6',
    move:'M3 5h7l2 3h9v12H3zM7 14h9m-3-3 3 3-3 3', folder:'M3 5h7l2 3h9v12H3z', check:'m5 12 4 4L19 6', info:'M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
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
  const displayNumber = C.formatNumber;
  const preciseNumber = new Intl.NumberFormat('uk-UA',{useGrouping:false,maximumSignificantDigits:21});
  const editableNumber = value => typeof value === 'number' && Number.isFinite(value)
    ? preciseNumber.format(value) : String(value ?? '').replaceAll('.', ',');
  const displayInputNumber = value => C.number(value) === null ? editableNumber(value) : displayNumber(value,{useGrouping:false});
  const plural = (value, words) => words[value % 10 === 1 && value % 100 !== 11 ? 0 : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? 1 : 2];
  const kindName = kind => ({'body-cover':'Кришка — корпус','flange-flange':'Фланець — фланець','flange-cover':'Фланець — кришка',custom:'Інше з’єднання'}[kind] || 'З’єднання');
  const date = value => { const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('uk-UA', {day:'2-digit',month:'2-digit',year:'numeric'}) : '—'; };
  let workspace = { version:1, folders:[], equipment:[], preferences:{ recent:[], favorites:[] } };
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
  let currentFolder = null;
  let foldersById = new Map();
  let draggedFolder = null;
  let dropCard = null;
  let currentEquipment = null;
  let currentNode = null;
  let editContext = null;
  let picker = null;
  let searchText = '';
  let sortBy = 'recent';
  let saveTimer;
  let calcDebounceTimer = null;
  function scheduleCalculationUpdate() {
    clearTimeout(calcDebounceTimer);
    calcDebounceTimer = setTimeout(() => {
      calcDebounceTimer = null;
      updateStatuses();
      refreshResults();
    }, 120);
  }
  function flushCalculationUpdate() {
    if (calcDebounceTimer) {
      clearTimeout(calcDebounceTimer);
      calcDebounceTimer = null;
      updateStatuses();
      refreshResults();
    }
  }
  let toastTimer;
  let saveFailed = false;
  let importedProject = null;
  let excelContext = null;
  let pendingField = null;

  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content],{type}));
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url),60000);
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
    fileShell('Файл проєкту',`<p>Збережіть папки, обладнання та анкети вузлів в окремий файл. Матеріали зберігаються як посилання на актуальну базу.</p><button class="button primary" data-action="save-project">${icon('save')}Зберегти JSON</button><hr><label class="field" for="project-upload"><strong>Відкрити резервну копію</strong><span>Спочатку покажемо вміст файла та спосіб відновлення.</span><input id="project-upload" type="file" accept=".json,application/json"></label><div id="import-preview" hidden></div>${backupAvailable ? '<button class="button secondary" data-action="download-before-import">Завантажити стан до останнього відновлення</button>' : ''}`);
  }
  fileDialog.addEventListener('change',async event => {
    if (event.target.dataset?.excelNodeSelect !== undefined) {
      const anyChecked = Boolean(fileDialog.querySelector('[data-excel-node-select]:checked'));
      const downloadBtn = fileDialog.querySelector('[data-action="download-excel"]');
      if (downloadBtn) downloadBtn.disabled = !anyChecked;
      return;
    }
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
      preview.innerHTML = `<div class="import-summary"><strong>${candidate.folders.length} ${plural(candidate.folders.length,['папка','папки','папок'])} · ${candidate.equipment.length} од. обладнання · ${count} вузлів</strong><ul>${candidate.equipment.map(item => `<li>${esc(item.name)} <span>(${item.nodes.length})</span></li>`).join('')}</ul></div><label class="import-choice"><input type="radio" name="import-mode" value="add" checked><span><strong>Додати папки й обладнання</strong><small>Поточні анкети залишаться. Імпортовані отримають нові ідентифікатори.</small></span></label><label class="import-choice"><input type="radio" name="import-mode" value="replace"><span><strong>Відновити весь проєкт із файла</strong><small>Замінить поточний простір. Попередній стан залишиться в резервній копії цього браузера.</small></span></label><button class="button primary" data-action="apply-import">Імпортувати</button>`;
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
  let excelTemplateLoadingPromise = null;
  function ensureExcelTemplate() {
    if (typeof window !== 'undefined' && window.FlangeExcelTemplate) {
      return Promise.resolve(window.FlangeExcelTemplate);
    }
    if (typeof globalThis !== 'undefined' && globalThis.FlangeExcelTemplate) {
      if (typeof window !== 'undefined') window.FlangeExcelTemplate = globalThis.FlangeExcelTemplate;
      return Promise.resolve(globalThis.FlangeExcelTemplate);
    }
    if (typeof document === 'undefined' || !document.head || typeof document.head.append !== 'function') {
      return Promise.resolve(null);
    }
    if (excelTemplateLoadingPromise) return excelTemplateLoadingPromise;
    excelTemplateLoadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="excel-template.bundle.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.FlangeExcelTemplate));
        existing.addEventListener('error', () => reject(new Error('Не вдалося завантажити шаблон Excel.')));
        return;
      }
      const script = document.createElement('script');
      script.src = 'excel-template.bundle.js';
      script.onload = () => resolve(window.FlangeExcelTemplate);
      script.onerror = () => reject(new Error('Не вдалося завантажити файл шаблону Excel.'));
      document.head.append(script);
    });
    return excelTemplateLoadingPromise;
  }
  function openExcelExport(scope) {
    if (!currentEquipment) return;
    const nodes = scope === 'equipment' ? currentEquipment.nodes : [currentNode];
    if (!nodes.length || !nodes[0]) { toast('Спочатку додайте вузол.'); return; }
    ensureExcelTemplate();
    excelContext = {equipment:JSON.parse(JSON.stringify(currentEquipment)),nodes:JSON.parse(JSON.stringify(nodes))};
    const reports = nodes.map(node => window.FlangeExcel.inspect(node,materials,standardsDb));
    const validCount = reports.filter(r => !r.errors.length).length;
    const blocked = validCount === 0;
    fileShell('Експорт у початковий Excel',`<p>${esc(currentEquipment.name)} · ${nodes.length} ${plural(nodes.length,['вузол','вузли','вузлів'])}. Кожен вузол матиме окремий редагований аркуш із формулами.</p><div class="export-nodes">${nodes.map((node,index) => {
      const report = reports[index];
      const hasErrors = report.errors.length > 0;
      const torque = C.number(node.fastener.torqueNm) ?? (report.limits.maximum.roundedTorqueNm >= 0 ? report.limits.maximum.roundedTorqueNm : '');
      const issue = hasErrors ? nextInputIssue(node,report.limits) : null;
      return `<section class="export-node"><div class="export-node-header"><label class="export-node-select"><input type="checkbox" data-excel-node-select="${index}" ${!hasErrors ? 'checked' : 'disabled'}><strong>${esc(node.name)}</strong></label>${hasErrors ? '<span class="status-badge error" style="font-size:11px;color:#b13d42;font-weight:600;">Потребує заповнення</span>' : ''}</div>${hasErrors ? `${issue ? issueMarkup(issue,node) + '<details class="export-diagnostics"><summary>Деталі перевірки</summary>' : ''}<ul class="dialog-error">${report.errors.map(error => `<li>${esc(error)}</li>`).join('')}</ul>${issue ? '</details>' : ''}` : `<div class="field"><label for="excel-torque-${index}">Момент перевірки, Н·м</label><input id="excel-torque-${index}" data-excel-torque="${index}" inputmode="decimal" value="${esc(displayInputNumber(torque))}" data-raw-value="${esc(editableNumber(torque))}" required><small>Для C6 у файлі. ${C.number(node.fastener.torqueNm) === null ? 'Запропоновано округлений максимум.' : 'Взято з анкети.'} Анкета не зміниться.</small></div>`}${report.warnings.map(warning => `<p class="file-warning">${esc(warning)}</p>`).join('')}</section>`;
    }).join('')}</div><p class="file-warning">Схеми й оформлення збережені з шаблону; зображення не перебудовуються за новими розмірами. Характеристики металів беруться з поточної бази на момент експорту. Excel перерахує формули при відкритті.</p>`, `<button class="button secondary" data-action="close-file">Закрити</button><button class="button primary" data-action="download-excel" ${blocked ? 'disabled' : ''}>${icon('file')}Завантажити XLSX</button>`);
  }
  async function exportExcel(button) {
    if (!excelContext) return;
    const context = excelContext;
    const checkboxList = [...fileDialog.querySelectorAll('[data-excel-node-select]')].filter(el => el.dataset?.excelNodeSelect !== undefined);
    const checkedList = [...fileDialog.querySelectorAll('[data-excel-node-select]:checked')].filter(el => el.dataset?.excelNodeSelect !== undefined && el.checked !== false);
    if (checkboxList.length > 0 && !checkedList.length) {
      fileError(new Error('Оберіть хоча б один валідний вузол для експорту.'));
      return;
    }
    let exportNodes = context.nodes;
    let exportTorques;
    if (checkboxList.length > 0 && checkedList.length > 0) {
      const selectedIndices = checkedList.map(cb => Number(cb.dataset.excelNodeSelect));
      exportNodes = selectedIndices.map(i => context.nodes[i]);
      exportTorques = selectedIndices.map(i => {
        const input = fileDialog.querySelector(`[data-excel-torque="${i}"]`);
        return C.number(input?.dataset?.rawValue ?? input?.value);
      });
    } else {
      exportTorques = [...fileDialog.querySelectorAll('[data-excel-torque]')].map(input => C.number(input.dataset?.rawValue ?? input.value));
    }
    if (exportTorques.some(value => value === null || value < 0)) {
      fileError(new Error('Вкажіть невід’ємний момент перевірки для кожного вузла.'));
      return;
    }
    button.disabled = true; button.textContent = 'Формую файл…';
    try {
      await ensureExcelTemplate();
      const result = await window.FlangeExcel.create({equipment: context.equipment, nodes: exportNodes, materials, catalog: standardsDb, torques: exportTorques});
      const label = `${context.equipment.name}${exportNodes.length === 1 ? ' — '+exportNodes[0].name : ''}`.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,160);
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
      const banner = document.querySelector('#storage-warning-banner');
      if (banner) banner.hidden = true;
    } catch (error) {
      if (!saveFailed) toast('Не вдалося зберегти зміни. Перевірте доступне місце та налаштування браузера.');
      saveFailed = true;
      setSaveStatus('Зміни не збережено', true);
      const banner = document.querySelector('#storage-warning-banner');
      if (banner) banner.hidden = false;
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
  function folderPath(folder) {
    const path = [];
    while (folder) {
      path.push(folder);
      folder = foldersById.get(folder.parentId);
    }
    return path.reverse();
  }
  function renderBreadcrumbs() {
    const links = [`<button data-action="home">Робочий стіл</button>`];
    for (const folder of folderPath(currentFolder)) {
      links.push(`${icon('chevron')}<button data-action="open-folder" data-id="${folder.id}" title="${esc(folder.name)}" ${folder === currentFolder && !currentEquipment ? 'aria-current="page"' : ''}>${esc(folder.name)}</button>`);
    }
    if (currentEquipment) links.push(`${icon('chevron','root-chevron')}<button data-action="open-equipment" data-id="${currentEquipment.id}" ${!currentNode ? 'aria-current="page"' : ''}>${esc(currentEquipment.name)}</button>`);
    if (currentNode) links.push(`${icon('chevron')}<span class="current" aria-current="page">${esc(currentNode.name)}</span>`);
    document.querySelector('#breadcrumbs').innerHTML = links.join('');
  }
  function renderRoute() {
    clearTimeout(calcDebounceTimer);
    calcDebounceTimer = null;
    const flangePicker = document.querySelector('#flange-picker-dialog');
    if (flangePicker?.open) flangePicker.close();
    endFolderDrag();
    if (materialDialog.open) materialDialog.close();
    if (editDialog.open) editDialog.close();
    const parts = location.hash.slice(1).split('/');
    foldersById = new Map(workspace.folders.map(folder => [folder.id,folder]));
    currentEquipment = ['node','equipment'].includes(parts[0]) ? workspace.equipment.find(item => item.id === parts[1]) || null : null;
    currentFolder = foldersById.get(parts[0] === 'folder' ? parts[1] : currentEquipment?.folderId) || null;
    currentNode = parts[0] === 'node' ? currentEquipment?.nodes.find(item => item.id === parts[2]) || null : null;
    searchText = '';
    renderBreadcrumbs();
    if (parts[0] === 'standards') {
      if (storageError) setSaveStatus('Не вдалося відкрити збереження', true);
      const title = window.StandardsReference?.render(main,parts.slice(1),{navigate,toast});
      if (!title) main.innerHTML = '<section class="desktop"><h1>Довідник стандартів</h1><p>Файли довідника не завантажено.</p></section>';
      document.title = `${title || 'Довідник стандартів'} — Прокладки`;
      pendingField = null;
      main.focus({preventScroll:true});
      return;
    }
    if (storageError) {
      setSaveStatus('Не вдалося відкрити збереження', true);
      main.innerHTML = `<section class="desktop"><h1>Збережені дані потребують перевірки</h1><p class="calculation-notice" style="margin-top:20px">Не вдалося прочитати робочий простір. Поточне збереження залишилося в браузері.</p><button class="button secondary" data-action="recover">Завантажити збережені дані</button><button class="button quiet" data-action="reset">Створити новий простір</button></section>`;
    } else if (currentNode) {
      renderEditor();
      if (pendingField?.nodeId === currentNode.id) focusInput(pendingField.path);
    }
    else renderDesktop();
    pendingField = null;
    document.title = `${currentNode?.name || currentEquipment?.name || currentFolder?.name || 'Робочий простір'} — Прокладки`;
  }

  const folderArt = `<svg class="folder-art" viewBox="0 0 76 58" fill="none" aria-hidden="true"><path d="M5 8a5 5 0 0 1 5-5h20l8 8h28a5 5 0 0 1 5 5v33H5V8Z" fill="var(--folder-back,#b9cceb)"/><path d="M12 12h49v34H12V12Z" fill="#f5f8ff"/><path d="M10 17h56v31H10V17Z" fill="var(--folder-sheet,#e7effc)"/><path d="M4 22a5 5 0 0 1 5-5h25l7 7h26a5 5 0 0 1 5 5l-3 23a4 4 0 0 1-4 3H9a4 4 0 0 1-4-4L2 28a5 5 0 0 1 2-6Z" fill="var(--folder-front,#d2e1fa)" stroke="var(--folder-edge,#91b0df)"/><path d="M13 35h20M13 40h13" stroke="var(--folder-lines,#87a9d9)" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  function emptyArt() {
    return `<svg viewBox="0 0 320 260" fill="none" aria-hidden="true"><path d="M45 64h230M45 194h230M90 30v200M230 30v200" stroke="#c8d7ed" stroke-dasharray="4 5"/><path d="M53 64v130M47 70l6-6 6 6M47 188l6 6 6-6M90 222h140M96 216l-6 6 6 6M224 216l6 6-6 6" stroke="#91aace"/><ellipse cx="160" cy="129" rx="69" ry="67" fill="#e4edfb" stroke="#7d9fd0" stroke-width="2"/><ellipse cx="160" cy="129" rx="42" ry="40" fill="#f6f9ff" stroke="#7d9fd0" stroke-width="2"/><g fill="#f6f9ff" stroke="#7d9fd0" stroke-width="1.6"><circle cx="160" cy="76" r="5"/><circle cx="197" cy="92" r="5"/><circle cx="214" cy="129" r="5"/><circle cx="197" cy="166" r="5"/><circle cx="160" cy="182" r="5"/><circle cx="123" cy="166" r="5"/><circle cx="106" cy="129" r="5"/><circle cx="123" cy="92" r="5"/></g><path d="M160 52v154M78 129h164" stroke="#245ed0" stroke-dasharray="8 4 2 4" opacity=".45"/><rect x="235" y="40" width="47" height="27" rx="5" fill="white" stroke="#d2dff1"/><path d="M247 54h22M258 47v14" stroke="#245ed0" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }
  function renderDesktop() {
    const equipment = currentEquipment;
    const parent = equipment ? currentFolder : foldersById.get(currentFolder?.parentId);
    const heading = equipment?.name || currentFolder?.name || 'Реєстр обладнання';
    main.innerHTML = `<section class="desktop register">
      ${equipment || currentFolder ? `<button class="back-button" data-action="${parent ? 'open-folder' : 'home'}" data-id="${parent?.id || ''}">${icon('arrow')}${esc(parent?.name || 'Робочий стіл')}</button>` : ''}
      <div class="page-heading"><div><h1>${esc(heading)}</h1>${equipment ? `<p>${esc(equipment.designation || 'Обладнання')} · ${equipment.nodes.length} ${plural(equipment.nodes.length,['вузол','вузли','вузлів'])}</p>` : ''}</div>
      <div class="heading-actions">${equipment ? '<button class="button secondary" data-action="excel-export" data-scope="equipment">Excel обладнання</button>' : `<button class="button secondary" data-action="new-folder">${icon('folder')}Нова папка</button>`}<button class="button primary" data-action="${equipment ? 'new-node' : 'new-equipment'}">${icon('plus')}${equipment ? 'Створити вузол' : 'Додати обладнання'}</button></div></div>
      ${equipment ? '' : `<div class="toolbar"><div class="search">${icon('search')}<input type="search" id="workspace-search" data-list-search placeholder="Пошук у всьому реєстрі…" aria-label="Пошук папок та обладнання у всьому реєстрі"></div><select aria-label="Сортування" data-list-sort><option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Спочатку останні</option><option value="name" ${sortBy === 'name' ? 'selected' : ''}>За назвою</option></select></div>`}
      <div id="desktop-content"></div><p class="workspace-footer">${icon('lock')}Дані зберігаються в цьому браузері на вашому комп’ютері.</p></section>`;
    renderDesktopContent();
  }
  function renderTorqueComparison(cMin, cMax, target, showCalculatedValues = true) {
    if (cMin === null || cMax === null) return '';
    const {minNm:tMin, maxNm:tMax} = target || {};
    const calcValues = showCalculatedValues ? `<span class="torque-val-group calc"><span class="legend-indicator calc"></span><small>Розрахунок:</small> <strong>${displayNumber(cMin)}–${displayNumber(cMax)}</strong> <span class="unit">Н·м</span></span>` : '';
    const targetValues = target ? `<span class="torque-val-group target" title="${esc(target.label)}"><span class="legend-indicator target"></span><small>ТУ:</small> <strong>${displayNumber(tMin)}–${displayNumber(tMax)}</strong> <span class="unit">Н·м</span></span>` : '';
    const values = [calcValues, targetValues].filter(Boolean).join('<span class="torque-val-sep">·</span>');
    const comparison = cMin > cMax ? {status:'neutral', label:'Межі несумісні'} :
      target ? C.compareTorqueRanges({calculatedMin:cMin, calculatedMax:cMax, targetMin:tMin, targetMax:tMax}) :
        {status:'neutral', label:'ТУ не вказано'};
    const statusIcon = {full:'check', partial:'info', none:'close'}[comparison.status];
    const summary = `<div class="torque-cell-top">${values ? `<div class="torque-cell-values">${values}</div>` : ''}<div class="torque-badge ${comparison.status}">${statusIcon ? icon(statusIcon) : ''}<span>${esc(comparison.label)}</span></div></div>`;
    if (cMin > cMax) return `<div class="node-torque-cell">${summary}</div>`;

    const valMin = Math.min(cMin, tMin ?? cMin);
    const valMax = Math.max(cMax, tMax ?? cMax);
    const pad = Math.max((valMax - valMin) * (target ? 0.12 : 0.15), 10);
    const axisMin = Math.max(0, Math.floor(valMin - pad));
    const axisMax = Math.ceil(valMax + pad);
    const axisTotal = Math.max(axisMax - axisMin, 1);
    const toPct = value => Math.max(4, Math.min(96, Math.round(((value - axisMin) / axisTotal) * 1000) / 10));
    const width = (left, right) => Math.max(2, toPct(right) - toPct(left));
    const marker = (kind, value, staggered = false) => `<span class="ruler-marker-label ${kind}${staggered ? ' staggered' : ''}" style="left:${toPct(value)}%;"><span class="m-txt">${displayNumber(value)}</span></span>`;
    const tick = (kind, value, label) => `<div class="ruler-tick ${kind}" style="left:${toPct(value)}%;" title="${label}: ${displayNumber(value)} Н·м"></div>`;
    const zone = (kind, min, max, title) => `<div class="ruler-zone ${kind}" style="left:${toPct(min)}%;width:${width(min,max)}%;" title="${esc(title)}"></div>`;
    const {overlapMin, overlapMax} = comparison;
    const targetZones = target ? [
      zone('tu-bracket',tMin,tMax,`Норматив за ТУ: ${displayNumber(tMin)}–${displayNumber(tMax)} Н·м`),
      overlapMin !== null ? zone(`overlap-zone ${comparison.status}`,overlapMin,overlapMax,`Робочий коридор затягування: ${displayNumber(overlapMin)}–${displayNumber(overlapMax)} Н·м`) : '',
      cMax < tMax ? zone('capped-zone',cMax,tMax,`Перевищує розрахункову міцність: затяг > ${displayNumber(cMax)} Н·м заборонено`) : '',
      cMin > tMin ? zone('capped-zone low',tMin,cMin,`Недостатній затяг для герметичності (потрібно ≥ ${displayNumber(cMin)} Н·м)`) : ''
    ].join('') : '';

    const tuCollide = target && (tMax !== tMin) && Math.abs(toPct(tMax) - toPct(tMin)) < 12;
    const calcCollide = (cMax !== cMin) && Math.abs(toPct(cMax) - toPct(cMin)) < 12;

    return `<div class="node-torque-cell"${comparison.description ? ` title="${esc(comparison.description)}"` : ''}>
      ${summary}
      <div class="torque-ruler-wrapper" aria-hidden="true">
        ${target ? `<div class="ruler-labels-track top ${tuCollide ? 'collision' : ''}">${marker('tu',tMin)}${tMax === tMin ? '' : marker('tu',tMax,tuCollide)}</div>` : ''}
        <div class="ruler-scale-track">
          ${zone('calc-zone',cMin,cMax,`Розрахунковий діапазон: ${displayNumber(cMin)}–${displayNumber(cMax)} Н·м`)}
          ${targetZones}
          ${tick('calc',cMin,'Мін. розрахунковий')}
          ${target ? tick('tu',tMin,'Мін. за ТУ') + tick('tu',tMax,'Макс. за ТУ') : ''}
          ${tick('calc',cMax,'Макс. розрахунковий')}
        </div>
        <div class="ruler-labels-track bottom ${calcCollide ? 'collision' : ''}">${marker('calc',cMin)}${cMax === cMin ? '' : marker('calc',cMax,calcCollide)}</div>
      </div>
    </div>`;
  }
  function renderNodeRow(node) {
    const limits = window.FlangeCalculations ? window.FlangeCalculations.nodeLimits(node, materials, standardsDb) : null;
    const calcMin = limits?.minimum?.roundedTorqueNm ?? null;
    const calcMax = limits?.maximum?.roundedTorqueNm ?? null;
    const target = C.effectiveTargetTorque(node, standardsDb);

    const fType = C.mounting(node).bolt ? 'Болт' : 'Шпилька';
    const countPart = C.positive(node.fastener.count) ? `, ${C.number(node.fastener.count)} шт.` : '';
    const fastenerTag = C.positive(node.fastener.nominalDiameter)
      ? `${fType} М${displayNumber(node.fastener.nominalDiameter)}${countPart}`
      : fType;

    let gasketTag = '';
    if (node.gasket.mode === 'ring') {
      if (C.positive(node.gasket.outerDiameter) && C.positive(node.gasket.innerDiameter)) {
        gasketTag = `Ø ${displayNumber(node.gasket.outerDiameter)} / ${displayNumber(node.gasket.innerDiameter)}${C.positive(node.gasket.thickness) ? ` × ${displayNumber(node.gasket.thickness)}` : ''} мм`;
      } else if (C.positive(node.gasket.thickness)) {
        gasketTag = `Кругла × ${displayNumber(node.gasket.thickness)} мм`;
      } else {
        gasketTag = 'Кругла прокладка';
      }
    } else {
      gasketTag = `Складна форма${C.positive(node.gasket.thickness) ? ` × ${displayNumber(node.gasket.thickness)} мм` : ''}`;
    }

    function formatCondition(modeData) {
      if (!modeData) return null;
      const p = C.positive(modeData.pressure) ? `${displayNumber(modeData.pressure)} МПа` : '';
      const t = (modeData.temperature !== '' && modeData.temperature !== null && modeData.temperature !== undefined) ? `${displayNumber(modeData.temperature)} °C` : '';
      if (!p && !t) return null;
      return [p, t].filter(Boolean).join(' · ');
    }
    const normalText = formatCondition(node.operating?.normal);
    const hydroText = formatCondition(node.operating?.hydro);

    let torqueHtml = renderTorqueComparison(calcMin,calcMax,target);
    const hasBounds = calcMin !== null && calcMax !== null;
    const issue = !limits?.complete ? nextInputIssue(node,limits) : null;
    if (!hasBounds) {
      const targetText = target ? `ТУ: ${displayNumber(target.minNm)}–${displayNumber(target.maxNm)} Н·м` : '';
      torqueHtml = `<div class="node-torque-cell pending"><div class="torque-cell-top pending-top"><div class="torque-badge neutral">${icon('info')}<span>Потрібні дані</span></div>${targetText ? `<span class="torque-expected-target">${esc(targetText)}</span>` : ''}</div>${issue ? issueMarkup(issue,node) : '<small>Перегляньте результати перевірок у вузлі.</small>'}</div>`;
    }

    return `<div class="node-row"><button class="node-open" data-action="open-node" data-id="${node.id}"><span class="file-icon">${icon('file')}</span><span class="node-title-group"><strong>${esc(node.name)}</strong><div class="node-params-grid"><div class="node-tag op-tag nue" title="Нормальні умови експлуатації"><strong class="op-k">НУЕ:</strong> <span>${normalText ? esc(normalText) : '—'}</span></div><div class="node-tag fastener-tag" title="Елементи кріплення">${esc(fastenerTag)}</div><div class="node-tag op-tag hv" title="Гідровипробування"><strong class="op-k">ГВ:</strong> <span>${hydroText ? esc(hydroText) : '—'}</span></div><div class="node-tag gasket-tag" title="Параметри прокладки">${esc(gasketTag)}</div></div></span></button><span class="node-kind">${kindName(node.connection.kind)}</span>${hasBounds && issue ? `<div class="node-torque-summary">${torqueHtml}${issueMarkup(issue,node)}</div>` : torqueHtml}<span class="node-date">${date(node.updatedAt)}</span><div class="card-actions"><button class="icon-button" data-action="edit-node" data-id="${node.id}" aria-label="Перейменувати ${esc(node.name)}" title="Перейменувати">${icon('edit')}</button><button class="icon-button" data-action="copy-node" data-id="${node.id}" aria-label="Дублювати ${esc(node.name)}" title="Дублювати">${icon('copy')}</button><button class="icon-button danger" data-action="delete-node" data-id="${node.id}" aria-label="Видалити ${esc(node.name)}" title="Видалити">${icon('trash')}</button></div></div>`;
  }
  function renderDesktopContent() {
    const target = document.querySelector('#desktop-content');
    if (!target) return;
    if (!currentEquipment) {
      renderRegister(target);
      return;
    }
    if (!currentEquipment.nodes.length) {
      target.innerHTML = `<div class="empty-workspace"><div class="empty-copy"><h2>Додайте перший вузол</h2><p>Кожне з’єднання має власні параметри роботи, прокладку та елементи кріплення.</p></div><div class="empty-illustration">${emptyArt()}</div></div>`;
      return;
    }
    const sorted = [...currentEquipment.nodes].sort((a,b) => a.name.localeCompare(b.name,'uk',{numeric:true}));
    target.innerHTML = `<div class="nodes-list"><div class="node-table-head"><span>Вузол і параметри</span><span>Тип з’єднання</span><span>Момент затягування (Розрахунок vs ТУ)</span><span>Змінено</span><span></span></div>${sorted.map(renderNodeRow).join('')}</div>`;
  }
  function folderHasContents(id) {
    return workspace.folders.some(folder => folder.parentId === id) || workspace.equipment.some(item => item.folderId === id);
  }
  function renderRegister(target) {
    const query = C.canonical(searchText);
    const parentId = currentFolder?.id ?? null;
    const cards = [];
    const childCounts = new Map();
    for (const folder of workspace.folders) childCounts.set(folder.parentId,(childCounts.get(folder.parentId) || 0) + 1);
    for (const item of workspace.equipment) childCounts.set(item.folderId,(childCounts.get(item.folderId) || 0) + 1);
    for (const [items,type] of [[workspace.folders,'folder'],[workspace.equipment,'equipment']]) {
      const isFolder = type === 'folder';
      const matches = items.filter(item => query
        ? C.canonical(`${item.name} ${item.designation || ''}`).includes(query)
        : (isFolder ? item.parentId : item.folderId ?? null) === parentId);
      matches.sort((a,b) => (sortBy === 'recent' && String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))) || a.name.localeCompare(b.name,'uk',{numeric:true}));
      for (const item of matches) {
        const parent = foldersById.get(isFolder ? item.parentId : item.folderId);
        const path = query ? ['Робочий стіл',...folderPath(parent).map(folder => folder.name)].join(' / ') : '';
        const count = isFolder ? childCounts.get(item.id) || 0 : item.nodes.length;
        const detail = `${count} ${plural(count,isFolder ? ['елемент','елементи','елементів'] : ['вузол','вузли','вузлів'])}`;
        const action = (verb,label,glyph) => `<button class="icon-button ${verb === 'delete' ? 'danger' : ''}" data-action="${verb}-${type}" data-id="${item.id}" title="${label}" aria-label="${label} · ${esc(item.name)}">${icon(glyph)}</button>`;
        cards.push(`<article class="equipment-card ${isFolder ? 'directory-card' : ''}" ${isFolder ? `data-folder-id="${item.id}"` : ''}>
          <button class="equipment-open" data-action="open-${type}" data-id="${item.id}" ${isFolder ? 'draggable="true" title="Відкрити папку або перетягнути в іншу папку"' : ''} aria-label="Відкрити ${isFolder ? 'папку' : 'обладнання'} ${esc(item.name)}">
            ${folderArt}<strong class="card-name">${esc(item.name)}</strong>
            <span class="designation">${isFolder ? 'Папка' : esc(item.designation || 'Обладнання')}</span>
            ${path ? `<small class="card-path">${esc(path)}</small>` : ''}
          </button>
          <div class="equipment-card-footer"><span title="Змінено ${date(item.updatedAt)}">${icon(isFolder ? 'folder' : 'file')}${detail}</span>
            <div class="card-actions">${action('edit','Редагувати','edit')}${action('move','Перемістити','move')}${action('delete','Видалити','trash')}</div>
          </div></article>`);
      }
    }
    if (cards.length) {
      target.innerHTML = `<div class="equipment-grid">${cards.join('')}${query ? '' : `<button class="create-card" data-action="new-equipment"><span>${icon('plus')}</span>Нове обладнання</button>`}</div>`;
    } else if (query) {
      target.innerHTML = '<div class="no-results">Збігів у реєстрі немає. Спробуйте іншу назву або позначення.</div>';
    } else {
      target.innerHTML = `<div class="empty-workspace"><div class="empty-copy"><h2>${currentFolder ? 'Папка порожня' : 'З чого почати реєстр?'}</h2><p>Створіть папку для станції, блока чи системи або одразу додайте обладнання.</p><button class="button secondary" data-action="new-folder">${icon('folder')}Створити папку</button></div><div class="empty-illustration">${emptyArt()}</div></div>`;
    }
  }

  const PRESSURE_UNITS = {
    MPa: { id: 'MPa', label: 'МПа', toMpa: 1, fromMpa: 1 },
    bar: { id: 'bar', label: 'bar', toMpa: 0.1, fromMpa: 10 },
    kgf: { id: 'kgf', label: 'кгс/см²', toMpa: 0.0980665, fromMpa: 1 / 0.0980665 }
  };
  function getPressureUnit(key) {
    return currentNode?.operating?.[key]?.pressureUnit || 'MPa';
  }
  function convertMpaToUnit(mpaValue, unit) {
    const num = C.number(mpaValue);
    if (num === null) return '';
    const factor = PRESSURE_UNITS[unit]?.fromMpa ?? 1;
    const val = num * factor;
    return Math.round(val * 10000) / 10000;
  }
  function convertUnitToMpa(unitValue, unit) {
    const num = C.number(unitValue);
    if (num === null) return '';
    const factor = PRESSURE_UNITS[unit]?.toMpa ?? 1;
    const mpa = num * factor;
    return String(Math.round(mpa * 1000000) / 1000000);
  }
  function pressureField(key, label) {
    const unit = getPressureUnit(key);
    const mpaValue = currentNode?.operating?.[key]?.pressure;
    const displayVal = convertMpaToUnit(mpaValue, unit);
    const path = `operating.${key}.pressure`;
    const fieldId = `field-operating-${key}-pressure`;
    return `<div class="field"><label for="${fieldId}">Тиск</label><div class="input-unit pressure-unit-group"><input id="${fieldId}" aria-describedby="${fieldId}-error" data-field="${path}" data-pressure-key="${key}" value="${esc(displayInputNumber(displayVal))}" data-raw-value="${esc(editableNumber(displayVal))}" inputmode="decimal" data-number="true" data-min="0" data-positive="false" autocomplete="off" placeholder="—"><select class="pressure-unit-select" data-pressure-unit="${key}" aria-label="Одиниця вимірювання тиску ${label}"><option value="MPa" ${unit === 'MPa' ? 'selected' : ''}>МПа</option><option value="bar" ${unit === 'bar' ? 'selected' : ''}>bar</option><option value="kgf" ${unit === 'kgf' ? 'selected' : ''}>кгс/см²</option></select></div><p id="${fieldId}-error" class="field-error" aria-live="polite" hidden></p></div>`;
  }

  function field(path, label, unit = '', settings = {}) {
    const rawValue = C.get(currentNode,path);
    const value = unit ? displayInputNumber(rawValue) : (rawValue ?? '');
    const fieldId = `field-${path.replaceAll('.','-')}`;
    return `<div class="field"><label for="${fieldId}">${label}</label><div class="input-unit"><input id="${fieldId}" aria-describedby="${fieldId}-error" data-field="${path}" value="${esc(value)}" ${unit ? `inputmode="${settings.integer ? 'numeric' : 'decimal'}" data-number="true" data-min="${settings.min ?? 0}" ${settings.positive !== false ? 'data-positive="true"' : ''} ${settings.integer ? 'data-integer="true"' : ''}` : 'maxlength="120"'} ${settings.readOnly ? 'readonly' : ''} autocomplete="off" placeholder="${esc(settings.placeholder || '—')}" ${unit === 'М' ? 'data-unit="М"' : ''}>${unit ? `<span ${unit === 'М' ? 'class="unit-prefix"' : ''}>${unit}</span>` : ''}</div>${settings.help ? `<p class="field-help">${settings.help}</p>` : ''}<p id="${fieldId}-error" class="field-error" aria-live="polite" hidden></p></div>`;
  }
  function selectField(path, label, options, selection = C.get(currentNode,path)) {
    const fieldId = `field-${path.replaceAll('.','-')}`;
    const selected = String(selection ?? '').trim() ? String(selection) : '';
    if (!selected && !options.some(([value])=>value === '')) options = [['','Оберіть…',true],...options];
    return `<div class="field"><label for="${fieldId}">${label}</label><select id="${fieldId}" aria-describedby="${fieldId}-error" data-field="${path}">${options.map(([value,text,disabled]) => `<option value="${esc(value)}" ${disabled ? 'disabled' : ''} ${selected === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select><p id="${fieldId}-error" class="field-error" aria-live="polite" hidden></p></div>`;
  }
  function materialField(path, label = 'Матеріал') {
    const ref = C.get(currentNode,path);
    const found = C.resolveMaterial(materials,ref);
    const description = found
      ? `${found.grade.kp ? `КП ${esc(found.grade.kp)} · ` : ''}${esc(C.cleanDescription(found.material.name,found.grade.description))}`
      : ref ? 'Виконання відсутнє в базі. Виберіть повторно.' : 'Матеріал не задано';
    return `<p class="sub-label">${esc(label)}</p><button type="button" class="material-card ${!ref ? 'missing' : !found ? 'invalid' : ''}" data-action="pick-material" data-path="${path}" data-label="${esc(label)}" aria-label="${esc(label)}: ${esc(ref?.name || 'вибрати матеріал (не задано)')}">${icon('material')}<span><strong>${esc(ref?.name || 'Вибрати матеріал')}</strong><small>${description}</small></span>${icon('chevron','chevron')}</button>`;
  }
  function inputLabel(path) {
    const [section,part] = path.split('.');
    const key = path.split('.').at(-1);
    const labels = {
      pressure:'Тиск', temperature:'Температура', medium:'Середовище', thickness:'Товщина',
      count:'Кількість кріплень', nominalDiameter:'Діаметр різьби', pitch:'Крок різьби',
      threadStandardId:'Стандарт різьби', axialHoleDiameter:'Поздовжній отвір', torqueNm:'Заданий момент',
      targetTorqueMinNm:'Мінімальний момент за ТУ', targetTorqueMaxNm:'Максимальний момент за ТУ',
      effectiveArea:'Ефективна площа', pressureArea:'Площа дії тиску', outerDiameter:'Зовнішній діаметр',
      innerDiameter:'Внутрішній діаметр', holeDiameter:'Діаметр отвору', height:'Висота', form:'Форма фланця',
      area:'Площа перерізу', boltCircle:'Діаметр кола кріплень', wallCylinder:'Товщина стінки',
      wallCone:'Товщина конуса', coneHeight:'Висота конуса', gasketDiameter:'Діаметр прокладки',
      engagement:'Довжина зачеплення', threadedHeight:'Висота різьбової частини', partitionWidth:'Ширина смуги перегородки',
      name:'Назва', mode:'Застосовність перевірки', standardId:'Стандарт', typeId:'Тип гайки', execution:'Виконання', accuracyClass:'Клас точності'
    };
    let context = section === 'nutB' ? 'Друга гайка' : sectionNames[section];
    if (section === 'operating') context = part === 'normal' ? 'НУЕ' : 'ГВ';
    if (section === 'connection' || section === 'flanges') context = `${section === 'flanges' ? 'Фланець' : 'Деталь'} ${part === 'sideA' ? 'А' : 'Б'}`;
    if (section === 'extras') context = `Елемент ${Number(part) + 1}`;
    return `${context} · ${labels[key] || key}`;
  }
  function nextInputIssue(node, limits) {
    const {errors,missing} = C.validateInputs(node,standardsDb);
    const path = Object.keys(errors)[0] || Object.keys(missing)[0];
    if (path) return {path, message:`${inputLabel(path)}. ${errors[path] || missing[path]}`, action:'Перейти до поля'};

    const mount = C.mounting(node);
    // Only highlight properties that feed an active calculation for this part and mode.
    const parts = [
      ['fastener.material','кріплення'],
      ['connection.sideA.material','деталі А'],
      ['connection.sideB.material','деталі Б']
    ];
    for (const key of mount.nuts) if (key === 'nut' || node.fastener.differentNuts) parts.push([key+'.material',key === 'nut' ? 'гайки' : 'другої гайки']);
    if (node.washers.placement !== 'none') parts.push(['washers.material','шайб']);
    node.extras.forEach((_,i) => parts.push([`extras.${i}.material`,`елемента ${i + 1}`]));
    for (const [path,part] of parts) {
      const ref = C.get(node,path);
      const action = `Переглянути матеріал ${part}`;
      if (!C.resolveMaterial(materials,ref)) {
        return {path,action,message:ref ? `Матеріал ${part}: виконання «${ref.name}» відсутнє в базі.` : `Оберіть матеріал ${part}.`};
      }
      const missing = C.missingMaterialProperties(node,materials,path);
      const missingByMode = ['normal','hydro'].flatMap(mode=>{
        const properties = missing.filter(item=>item.mode === mode);
        return properties.length ? [`${mode === 'normal' ? 'НУЕ' : 'ГВ'} (${displayNumber(node.operating[mode].temperature)} °C) — ${properties.map(item=>({RTp:'Rp',RTm:'Rm',Alpha:'α',E:'E'})[item.property]).join(', ')}`] : [];
      });
      if (missingByMode.length) return {path,action,message:`Для матеріалу ${part} «${ref.name}» бракує табличних даних: ${missingByMode.join('; ')}.`};
    }
    for (const key of mount.nuts) {
      const nut = C.nutAt(node,key);
      if (!C.nutDimensions(standardsDb,nut.standardId,node.fastener.nominalDiameter,nut.typeId)) return {path:(nut === node.nut ? 'nut' : 'nutB')+'.standardId',message:'Для вибраної гайки й діаметра кріплення в каталозі немає розмірів.',action:'Переглянути стандарт гайки'};
    }
    if (node.washers.placement !== 'none' && !C.washerDimensions(standardsDb,node.washers.standardId,node.fastener.nominalDiameter,node.washers.accuracyClass,node.washers.execution)) return {path:'washers.standardId',message:'Для вибраної шайби й діаметра кріплення в каталозі немає розмірів.',action:'Переглянути стандарт шайби'};
    return null;
  }
  function issueMarkup(issue,node) {
    return `<span class="input-issue"><span>${esc(issue.message)}</span><button type="button" class="issue-jump" data-action="focus-input" data-id="${esc(node.id)}" data-path="${esc(issue.path)}">${esc(issue.action)}</button></span>`;
  }
  function focusInput(path) {
    const selector = CSS.escape(path);
    const input = main.querySelector(`[data-field="${selector}"],[data-action="pick-material"][data-path="${selector}"]`);
    if (!input) return;
    const panel = input.closest('[data-connection-side]');
    if (panel) selectConnectionSide(panel.dataset.connectionSide);
    selectEditorStep(input.closest('.settings-section').dataset.section);
    input.closest('.settings-section').open = true;
    input.focus();
    input.scrollIntoView({block:'nearest'});
  }
  function updateMaterialWarnings() {
    const labels = { RTm:'Rm', RTp:'Rp', E:'E', Alpha:'α' };
    for (const button of document.querySelectorAll('.material-card')) {
      const path = button.dataset.path;
      if (!path) continue;
      const missing = C.missingMaterialProperties(currentNode,materials,path);
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
    const mount = currentNode ? C.mounting(currentNode) : null;
    const nutNotNeeded = key === 'nut' && mount && !mount.nuts.length;
    const isComplete = Boolean(complete || nutNotNeeded);
    const optional = key === 'extras' && !currentNode.extras.length ? 'Не додано' : key === 'washers' && currentNode.washers.placement === 'none' ? 'Не потрібні' : nutNotNeeded ? 'Не потрібна' : 'Заповнено';
    return `<span class="section-status ${isComplete ? 'ready' : ''}">${isComplete ? icon('check') : ''}${isComplete ? optional : 'Заповнити'}</span>`;
  }
  function section(key, body, open, statuses) {
    const d = C.number(currentNode?.fastener?.nominalDiameter);
    let title = sectionNames[key] || '';
    if (key === 'fastener') {
      const typeName = C.mounting(currentNode).bolt ? 'Болт' : 'Шпилька';
      title = d ? `${typeName} М${displayNumber(d)}` : typeName;
    } else if (key === 'nut') {
      const mount = C.mounting(currentNode);
      title = !mount.nuts.length ? 'Гайка (не потрібна)' : d ? `Гайка М${displayNumber(d)}` : 'Гайка';
    } else if (key === 'washers' && d && currentNode?.washers?.placement !== 'none') {
      title = `Шайба М${displayNumber(d)}`;
    }
    return `<details class="settings-section" data-section="${key}" ${open ? 'open' : ''}><summary>${icon(key)}${title}${statusMarkup(key,statuses[key])}${icon('down','section-chevron')}</summary><div class="section-body">${body}</div></details>`;
  }
  function nutChoiceMessage(selection,d) {
    if (!(d > 0)) return 'Оберіть діаметр різьби на кроці «Кріплення».';
    const record = standardsDb.nuts?.[selection.standardId];
    if (!record) return 'Оберіть стандарт гайки зі списку.';
    const diameter = 'М'+displayNumber(d);
    if (record.sizes?.[d]) return `Для ${diameter} за ${record.document} виберіть доступний тип гайки.`;
    const sizes = Object.keys(record.sizes || {}).map(Number);
    const min = Math.min(...sizes), max = Math.max(...sizes);
    const range = d < min ? ` Розміри в каталозі починаються з М${displayNumber(min)}.` :
      d > max ? ` Найбільший розмір у каталозі — М${displayNumber(max)}.` : '';
    const available = Object.values(standardsDb.nuts).some(item=>item.sizes?.[d]);
    return `У каталозі ${record.document} немає гайки ${diameter}.${range} ` +
      (available ? 'Виберіть доступний стандарт гайки.' : 'Змініть діаметр різьби на кроці «Кріплення».');
  }
  function standardBox(kind) {
    if (kind === 'washers') {
      const selection = currentNode.washers;
      const record = standardsDb.washers?.[selection.standardId];
      const diameter = C.number(currentNode.fastener.nominalDiameter);
      const dimensions = C.washerDimensions(standardsDb, selection.standardId, diameter, selection.accuracyClass, selection.execution);
      const label = record?.document || 'Стандарт шайб не знайдено';
      const widthMm = dimensions ? (dimensions.outerDiameterMm - dimensions.innerDiameterMm) / 2 : null;
      const meanDiameterMm = dimensions ? (dimensions.outerDiameterMm + dimensions.innerDiameterMm) / 2 : null;
      const rows = dimensions ? [
        ['Товщина s', `${displayNumber(dimensions.thicknessMm)} мм`],
        ['Зовнішній діаметр d₂', `${displayNumber(dimensions.outerDiameterMm)} мм`],
        ['Внутрішній діаметр d₁', `${displayNumber(dimensions.innerDiameterMm)} мм`],
        ['Ширина шайби b', `${displayNumber(widthMm)} мм`],
        ['Середній діаметр dср', `${displayNumber(meanDiameterMm)} мм`]
      ] : [];
      const note = diameter === null ? 'Спочатку вкажіть номінальний діаметр різьби.' : !record ? 'Відсутні дані вибраного стандарту.' : `Немає нормативних розмірів для М${displayNumber(diameter)}, виконання ${esc(selection.execution)}, класу ${esc(selection.accuracyClass)}.`;
      return `<div class="standard-box"><span>${icon('file')}${esc(label)} · виконання ${esc(selection.execution)}, клас ${esc(selection.accuracyClass)}</span>${rows.length ? rows.map(([name,value]) => `<div class="readonly-line"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('') : note}</div>`;
    }
    if (kind === 'nuts' || kind === 'nutB') {
      const selection = kind === 'nutB' ? currentNode.nutB : currentNode.nut;
      const record = standardsDb.nuts?.[selection.standardId];
      const diameter = C.number(currentNode.fastener.nominalDiameter);
      const dimensions = C.nutDimensions(standardsDb, selection.standardId, diameter, selection.typeId || 'A');
      const label = record?.document || 'Стандарт гайок не знайдено';
      const eDiameter = dimensions?.acrossFlatsMm ? Math.round(dimensions.acrossFlatsMm * (2 / Math.sqrt(3)) * 10) / 10 : null;
      const rows = dimensions ? [
        [`${dimensions.heightLabel} ${dimensions.heightSymbol}`, `${displayNumber(dimensions.heightMm)} мм`],
        dimensions.acrossFlatsMm ? ['Розмір під ключ S', `${displayNumber(dimensions.acrossFlatsMm)} мм`] : null,
        eDiameter ? ['Описане коло e (габарит)', `${displayNumber(eDiameter)} мм`] : null
      ].filter(Boolean) : [];
      const note = dimensions ? '' : esc(nutChoiceMessage(selection,diameter));
      return `<div class="standard-box"><span>${icon('file')}${esc(label)}</span>${rows.length
        ? `${rows.map(([name,value]) => `<div class="readonly-line"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')}${dimensions.nonPreferred ? '<p class="field-help">Розмір у ГОСТ наведено в дужках; за можливості не застосовувати.</p>' : ''}${dimensions.typeId === 'B' ? '<p class="field-help">Для ковпачкової гайки l₁ — загальна висота, а не довжина зачеплення різьби чи висота опорної частини.</p>' : ''}`
        : note}</div>`;
    }
    return '';
  }
  function operatingCoefficients(mode) {
    if (!mode || !currentNode?.operating?.[mode]) return '';
    const referenceId = currentNode.gasket?.referenceId || C.DEFAULT_GASKET_REFERENCE_ID;
    const {medium,temperature} = currentNode.operating[mode];
    const m = C.gasketMediumCoefficient(standardsDb,referenceId,medium);
    const a = C.gasketExpansionAt(standardsDb,referenceId,temperature);
    return `<dl class="operating-coefficients" data-operating-coefficients="${mode}">
      <div class="readonly-line"><dt>Коефіцієнт середовища m (табл. Б.1)</dt><dd><strong>${m ? displayNumber(m.value) : '—'}</strong></dd></div>
      <div class="readonly-line"><dt>Коефіцієнт розширення α (табл. Б.2)</dt><dd><strong>${a ? `${displayNumber(a.value)} × 10⁻⁶/°C` : '—'}</strong></dd></div>
    </dl>`;
  }
  function gasketReference() {
    const referenceId = currentNode.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID;
    const record = standardsDb.gaskets?.[referenceId];
    if (!record) return `<div class="standard-box" data-gasket-reference><span>${icon('file')}Характеристики графітової прокладки</span>Нормативні дані недоступні. Перевірте файл standards.bundle.js.</div>`;
    const od = C.number(currentNode.gasket.outerDiameter);
    const id = C.number(currentNode.gasket.innerDiameter);
    let ringGeometryRows = [];
    if (currentNode.gasket.mode === 'ring' && od > 0 && id > 0 && od > id) {
      const b0 = (od - id) / 2;
      const b = b0 > 15 ? Math.round(3.8 * Math.sqrt(b0) * 10) / 10 : b0;
      const dMid = (od + id) / 2;
      ringGeometryRows = [
        ['Реальна ширина b₀', `${displayNumber(b0)} мм`],
        ['Розрахункова ширина b', `${displayNumber(b)} мм`],
        ['Середній діаметр Dср', `${displayNumber(dMid)} мм`]
      ];
    }
    const scalarRows = [
      ['Модуль Юнга Eпр', `${displayNumber(record.elasticModulusMPa)} МПа`],
      ['Питомий тиск обтиснення q₀', `${displayNumber(record.seatingPressureMPa)} МПа`],
      ['Мінімальний питомий тиск qmin', `${displayNumber(record.minimumPressureMPa)} МПа`],
      ['Максимальний питомий тиск qmax', `${displayNumber(record.maximumPressureMPa)} МПа`]
    ];
    const cases = [['normal','НУЕ'],['hydro','ГВ']];
    const stateRows = cases.map(([mode,label]) => {
      const state = currentNode.operating[mode];
      const m = C.gasketMediumCoefficient(standardsDb, referenceId, state.medium);
      const a = C.gasketExpansionAt(standardsDb, referenceId, state.temperature);
      const temp = C.number(state.temperature);
      return `<div class="readonly-line"><span>m, ${label} (${esc(state.medium || 'середовище не задано')})</span><strong>${m ? displayNumber(m.value) : '—'}</strong></div><div class="readonly-line"><span>α, ${label} (${temp === null ? 'T не задано' : `${displayNumber(temp)} °C`})</span><strong>${a ? `${displayNumber(a.value)} × 10⁻⁶/°C` : '—'}</strong></div>`;
    }).join('');
    const alphaRows = Object.entries(record.expansionMicroPerCByTemperatureC || {}).map(([temp,value]) => `<div class="readonly-line"><span>${displayNumber(temp)} °C</span><strong>${displayNumber(value)} × 10⁻⁶/°C</strong></div>`).join('');
    const widthHelp = currentNode.gasket.mode === 'ring' && od > 0 && id > 0 && od > id
      ? '<p class="field-help">У розрахунку застосовано погоджене зменшення: b = 3,8√b₀ при b₀ &gt; 15 мм; інакше b = b₀.</p>'
      : '';
    return `<div class="standard-box" data-gasket-reference><span>${icon('file')}${esc(record.document || record.name)}</span>${ringGeometryRows.map(([name,value]) => `<div class="readonly-line"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')}${widthHelp}${scalarRows.map(([name,value]) => `<div class="readonly-line"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')}${stateRows}<p class="field-help">Для α береться точна або найближча вища доступна таблична температура.</p><details><summary>Таблиця Б.2 — всі значення α</summary>${alphaRows}</details></div>`;
  }
  function gasketSketch() {
    return `<svg viewBox="0 0 70 66" fill="none" aria-hidden="true"><circle cx="34" cy="32" r="26" fill="#e7effb" stroke="#91acd0"/><circle cx="34" cy="32" r="17" fill="#f5f8fd" stroke="#91acd0"/><circle cx="34" cy="10" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="56" cy="32" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="34" cy="54" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><circle cx="12" cy="32" r="2.4" fill="#f5f8fd" stroke="#91acd0"/><path d="M34 2v60M3 32h62" stroke="#a6bad7" stroke-dasharray="3 3"/></svg>`;
  }
  function flangeAdvisoryMarkup(side, node = currentNode) {
    if (!node || node.flanges?.[side]?.mode !== 'flange') return '';
    const autoHole = C.automaticHoleDiameter?.(node.fastener?.nominalDiameter);
    const flange = node.flanges[side];
    const holeValue = String(flange.holeDiameter ?? '').trim() === '' ? autoHole : flange.holeDiameter;
    const advisories = (window.FlangeCalculations?.flangeGeometryAdvisories || C.flangeGeometryAdvisories)?.({
      boltCircle: flange.boltCircle,
      count: node.fastener?.count,
      holeDiameter: holeValue,
      outerDiameter: flange.outerDiameter,
      innerDiameter: flange.innerDiameter
    });
    if (!advisories || advisories.boltPitch === null) return '';
    const pitchText = `Крок кріплень t_b = ${displayNumber(Math.round(advisories.boltPitch * 10) / 10)} мм${advisories.pitchRatio ? ` (${displayNumber(Math.round(advisories.pitchRatio * 100) / 100)} d₀)` : ''}`;
    const warnText = advisories.warnings.length ? `<div class="field-help warning" style="color:#b25e00;margin-top:4px;">${advisories.warnings.map(esc).join('<br>')}</div>` : '';
    return `<p class="field-help" style="margin:0;color:#334b6b;"><strong>${pitchText}</strong></p>${warnText}`;
  }
  function schemeMismatch(node) {
    if (node.connection.kind === 'custom') return false;
    const body = C.mounting(node).body;
    return ['flange-flange','flange-cover'].includes(node.connection.kind) ? Boolean(body) : body !== 'sideB';
  }
  function setFastenerArrangement(bolt,tapped) {
    currentNode.fastener.type = tapped ? (bolt ? 'body-bolt' : 'stud') : (bolt ? 'bolt' : 'through-stud');
    if (currentNode.connection.kind === 'body-cover') currentNode.fastener.reversed = false;
    if (!tapped) return;
    currentNode.fastener.engagement ??= '';
    const bodySide = C.mounting(currentNode).body === 'sideA' ? 'a' : 'b';
    if ([bodySide,'both'].includes(currentNode.washers.placement)) {
      currentNode.washers.placement = currentNode.washers.placement === 'both' ? (bodySide === 'a' ? 'b' : 'a') : 'none';
      toast('Шайбу з вкрученого кінця вилучено.');
    }
  }
  function settingsContent(openSections) {
    const node = currentNode;
    const statuses = C.sectionStatus(node,materials,standardsDb);
    const mount = C.mounting(node);
    function schemeSelect(key,label,options,value) {
      return `<div class="field"><label for="scheme-${key}">${label}</label><select id="scheme-${key}" data-scheme="${key}">${options.map(([id,text])=>`<option value="${id}" ${id === value ? 'selected' : ''}>${text}</option>`).join('')}</select></div>`;
    }
    const nutCount = mount.nuts.length;
    const custom = node.connection.kind === 'custom';
    const expectedBody = node.connection.kind === 'body-cover';
    const mismatch = schemeMismatch(node);
    const mountingChoice = custom
      ? schemeSelect('mounting','Як проходить кріплення?',[['through','Наскрізь обидві деталі'],['body','Вкручується в одну з деталей']],mount.body ? 'body' : 'through')
      : `<div class="field"><label>Спосіб встановлення</label><div class="scheme-fixed">${mount.body ? 'Вкручується в деталь '+(mount.body === 'sideA' ? 'А' : 'Б') : 'Наскрізь обидві деталі'}</div></div>`;
    function mediumOptions(saved) {
      const options = media.filter(item=>C.gasketMediumCoefficient(standardsDb,node.gasket.referenceId || C.DEFAULT_GASKET_REFERENCE_ID,item)).map(item=>[item,item]);
      if (saved && !options.some(([value])=>value === saved)) options.push([saved,saved+' · немає коефіцієнта']);
      return [['','Оберіть…'],...options];
    }
    const operating = `<div class="case-grid">${[['normal','НУЕ'],['hydro','ГВ']].map(([key,label]) => `<div><p class="case-title ${key === 'hydro' ? 'hydro' : ''}"><span></span>${label}</p>${pressureField(key,label)}${field(`operating.${key}.temperature`,'Температура','°C',{min:-273.15,positive:false})}${selectField(`operating.${key}.medium`,'Середовище',mediumOptions(node.operating[key].medium))}${operatingCoefficients(key)}</div>`).join('')}</div>`;
    const gasket = `<p class="section-intro">Графітова прокладка · параметри з таблиць Б.1–Б.2 застосовуються автоматично.</p><div class="choice-group" role="group" aria-label="Спосіб задання прокладки"><button data-action="gasket-mode" data-value="ring" aria-pressed="${node.gasket.mode === 'ring'}">Кільцева</button><button data-action="gasket-mode" data-value="area" aria-pressed="${node.gasket.mode === 'area'}">Задати площі</button></div>${field('gasket.thickness','Товщина прокладки','мм')}${node.gasket.mode === 'ring' ? `<div class="field-row">${field('gasket.outerDiameter','Зовнішній Ø','мм')}${field('gasket.innerDiameter','Внутрішній Ø','мм')}</div><label class="check-label"><input type="checkbox" data-field="gasket.hasHoles" ${node.gasket.hasHoles ? 'checked' : ''}>Отвори під кріплення</label>${node.gasket.hasHoles ? field('gasket.holeDiameter','Діаметр отвору','мм',{help:'Кількість отворів дорівнює кількості кріплень.'}) : ''}` : `${field('gasket.effectiveArea','Ефективна площа перерізу Aпр','мм²')}${field('gasket.pressureArea','Площа дії гідростатичного зусилля A','мм²')}<div class="gasket-help">${gasketSketch()}<span>Це дві різні площі. Введіть готові значення для нестандартної форми прокладки.</span></div>`}`;
    const threadStandardOptions = Object.values(standardsDb.threads || {}).map(item => [item.id, `${item.document} — ${item.title}`]);
    const selectedThreadStandard = standardsDb.threads?.[node.fastener.threadStandardId];
    const nominalThreadDiameter = C.number(node.fastener.nominalDiameter);
    const diameterOptions = [['','Оберіть діаметр…'], ...Object.keys(selectedThreadStandard?.sizes || {}).sort((a,b) => Number(a)-Number(b)).map(value => [value,`М${displayNumber(value)}`])];
    const savedDiameter = String(node.fastener.nominalDiameter ?? '');
    if (savedDiameter && !diameterOptions.some(([value]) => value === savedDiameter)) diameterOptions.push([savedDiameter,`М${displayInputNumber(savedDiameter)} · поза каталогом`]);
    const threadSize = nominalThreadDiameter === null ? null : selectedThreadStandard?.sizes?.[String(nominalThreadDiameter)];
    const pitchOptions = threadSize ? [
      ['', threadSize.coarsePitchMm === null ? 'Оберіть крок різьби…' : `Великий крок (авто): ${displayNumber(threadSize.coarsePitchMm)} мм`],
      ...threadSize.pitchesMm.map(pitch => [String(pitch), `P = ${displayNumber(pitch)} мм${pitch === threadSize.coarsePitchMm ? ' · великий' : ''}${threadSize.nonPreferredPitchesMm?.includes(pitch) ? ' · нерекомендований' : ''}`])
    ] : [['','Спочатку вкажіть діаметр з довідника']];
    const resolvedPitch = C.threadPitch(standardsDb,node.fastener.threadStandardId,nominalThreadDiameter,node.fastener.pitch);
    const pitchHelp = resolvedPitch?.nonPreferred
      ? '<p class="field-help">Крок наведений у ГОСТ 8724 у дужках; за можливості не застосовувати.</p>'
      : !resolvedPitch
        ? (threadSize ? '<p class="field-help">Для цього діаметра немає великого кроку. Оберіть допустимий крок вручну.</p>' : '<p class="field-help">Крок буде доступний після введення стандартного номінального діаметра.</p>')
        : '';
    const scheme = `${selectField('connection.kind','Що з’єднуємо?',[['flange-flange','Фланець — фланець'],['flange-cover','Фланець — кришка'],['body-cover','Кришка — корпус'],['custom','Інша конструкція']])}
      ${mountingChoice}
      ${mismatch ? `<div class="scheme-mismatch" role="status"><p>У збереженому вузлі інша схема кріплення. Для цього шаблону ${expectedBody ? 'кріплення вкручується в корпус Б' : 'потрібне наскрізне кріплення'}.</p><button type="button" class="button secondary" data-action="align-fastener">Узгодити кріплення</button></div>` : ''}
      ${schemeSelect('fastener','Чим стягуємо?',[['stud','Шпилькою'],['bolt','Болтом']],mount.bolt ? 'bolt' : 'stud')}
      <p class="scheme-outcome" role="status">${esc(mount.label)}<span data-fastener-summary hidden></span><span>${nutCount ? `Гайок на одне кріплення — ${nutCount}.` : 'Гайки не потрібні.'}</span></p>
      ${custom || !expectedBody ? `<label class="check-label"><input type="checkbox" data-field="fastener.reversed" ${node.fastener.reversed ? 'checked' : ''}>Поміняти боки кріплення А і Б</label>` : ''}`;
    const targetMin = node.fastener.targetTorqueMinNm ?? '';
    const targetMax = node.fastener.targetTorqueMaxNm ?? '';
    const stdTorque = C.standardTorque(standardsDb, node.fastener.nominalDiameter);
    let targetHint = '';
    if (stdTorque) {
      const isCustom = (targetMin && Number(targetMin) !== stdTorque.minNm) || (targetMax && Number(targetMax) !== stdTorque.maxNm);
      targetHint = `<div class="target-torque-hint"><span>Стандарт (${stdTorque.title}): <strong>${displayNumber(stdTorque.minNm)} – ${displayNumber(stdTorque.maxNm)} Н·м</strong></span>${isCustom ? `<button type="button" class="link-button" data-action="apply-standard-torque">Скинути до стандарту</button>` : ''}</div>`;
    }
    const axialHole = field('fastener.axialHoleDiameter','Поздовжній отвір у кріпленні','мм',{positive:false,help:'Для суцільної шпильки або болта — 0.'});
    const torque = field('fastener.torqueNm','Заданий момент затягування','Н·м',{positive:false,help:'Для перевірки конкретного затягу. Нижня межа обчислюється незалежно від цього поля.'});
    const engagement = mount.body ? field('fastener.engagement','Зачеплення в деталі '+(mount.body === 'sideA' ? 'А' : 'Б'),'мм',{placeholder:node.fastener.engagement === undefined ? mount.engagement ? displayInputNumber(mount.engagement) : 'За висотою деталі' : ''}) : '';
    const fastener = `${selectField('fastener.threadStandardId','Стандарт різьби',threadStandardOptions)}
      <div class="field-row">${selectField('fastener.nominalDiameter','Діаметр різьби',diameterOptions)}${field('fastener.count','Кількість','шт.',{integer:true})}</div>
      ${selectField('fastener.pitch','Крок різьби P',pitchOptions)}${pitchHelp}
      ${engagement}${materialField('fastener.material','Матеріал кріплення')}
      <div class="field-row"><label class="check-label"><input type="checkbox" data-field="fastener.lubricated" ${node.fastener.lubricated ? 'checked' : ''}>Мащення є</label></div>${axialHole}
      <hr><p class="sub-label">Момент затягування</p>
      <div class="field-row">${field('fastener.targetTorqueMinNm','Мінімальний за ТУ','Н·м',{min:0,placeholder:stdTorque ? displayInputNumber(stdTorque.minNm) : '—'})}${field('fastener.targetTorqueMaxNm','Максимальний за ТУ','Н·м',{min:0,placeholder:stdTorque ? displayInputNumber(stdTorque.maxNm) : '—'})}</div>
      ${targetHint}${torque}`;
    const nutStandardOptions = Object.values(standardsDb.nuts || {}).map(item => {
      const supported = !nominalThreadDiameter || item.sizes?.[String(nominalThreadDiameter)];
      return [item.id, supported ? `${item.document} — ${item.title}` : `${item.document} · немає М${displayNumber(nominalThreadDiameter)}`, !supported];
    });
    function nutFields(key) {
      const selection = node[key], standard = standardsDb.nuts?.[selection.standardId];
      const typeOptions = Object.entries(standard?.types || {}).map(([id,type]) => {
        const unavailable = nominalThreadDiameter > 0 &&
          !C.nutDimensions(standardsDb,selection.standardId,nominalThreadDiameter,id);
        const label = unavailable ? type.label+` · немає для М${displayNumber(nominalThreadDiameter)}` : type.label;
        return [id,label,unavailable];
      });
      const types = typeOptions.length ? selectField(key+'.typeId','Тип гайки',typeOptions) : '';
      const threaded = standard?.types && selection.typeId === 'B' ? field(key+'.threadedHeight','Висота різьбової частини','мм') : '';
      return materialField(key+'.material','Матеріал гайки')+selectField(key+'.standardId','Стандарт',nutStandardOptions)+types+threaded+standardBox(key==='nut' ? 'nuts' : key);
    }
    const sideLetter = key=>mount.a === key ? 'А' : 'Б';
    const pair = mount.nuts.length === 2;
    let nut = mount.nuts.length ? nutFields('nut') : '<p class="section-intro">У цьому вузлі гайка не застосовується (болт вкручується в нарізний корпус).</p>';
    if (pair) {
      const different = node.fastener.differentNuts;
      nut = `${different ? `<div class="choice-group" role="group" aria-label="Гайка на кресленні">${[['nut',sideLetter('nut')],['nutB',sideLetter('nutB')]].map(([key,side])=>`<button type="button" data-action="nut-view" data-nut="${key}" aria-pressed="${previewNut === key}">Гайка · бік ${side}</button>`).join('')}</div>` : ''}<p class="sub-label">${different ? 'Гайка · бік '+sideLetter('nut') : 'Однакові гайки з обох боків'}</p>${nut}
        <label class="check-label"><input type="checkbox" data-field="fastener.differentNuts" ${different ? 'checked' : ''}>Інша гайка на боці ${sideLetter('nutB')}</label>${different ? nutFields('nutB') : ''}`;
    }
    const washerStandardOptions = Object.values(standardsDb.washers || {}).map(item => [item.id, `${item.document} — ${item.scope}`]);
    const washerRecord = standardsDb.washers?.[node.washers.standardId];
    const executions = Object.keys(washerRecord?.executions || {});
    const classes = washerRecord?.accuracyClasses || [];
    const washerOptions = (values,current,label) => [
      ...(!values.includes(current) && current ? [[current,label(current)+' · поза стандартом']] : []),
      ...values.map(value=>[value,label(value)])
    ];
    const placements = [['none','Шайб немає'],['a','Тільки з боку А'],['b','Тільки з боку Б'],['both','З обох боків']].filter(([value])=>
      !mount.body || value === 'none' || value === (mount.a === 'body' ? 'b' : 'a') || value === node.washers.placement);
    const washers = `${selectField('washers.placement','Розташування',placements)}${node.washers.placement !== 'none' ? `${selectField('washers.standardId','Стандарт',washerStandardOptions)}<div class="field-row">${selectField('washers.execution','Виконання',washerOptions(executions,node.washers.execution,v=>'Виконання '+v))}${selectField('washers.accuracyClass','Клас точності',washerOptions(classes,node.washers.accuracyClass,v=>v === 'A' ? 'А' : v === 'C' ? 'С' : v))}</div>${materialField('washers.material','Матеріал шайб')}${node.washers.placement === 'both' ? '<p class="section-intro">З обох боків використовуються однакові шайби.</p>' : ''}${standardBox('washers')}` : '<p class="section-intro">У цьому з’єднанні шайби не використовуються.</p>'}`;
    const extras = `<p class="section-intro">Проставки та інші деталі, що впливають на податливість з’єднання.</p>${node.extras.map((item,index) => `<div class="extra-card"><div class="extra-card-heading"><span>Елемент ${index + 1}</span><button class="icon-button danger" data-action="remove-extra" data-id="${item.id}" aria-label="Видалити додатковий елемент ${index + 1}">${icon('close')}</button></div>${field(`extras.${index}.name`,'Назва')}${materialField(`extras.${index}.material`,'Матеріал елемента')}<div class="field-row">${field(`extras.${index}.thickness`,'Товщина','мм')}${field(`extras.${index}.area`,'Площа перерізу','мм²')}</div></div>`).join('')}<button class="add-extra" data-action="add-extra">${icon('plus')}Додати елемент</button>`;
    function flangeFields(side) {
      const path = `flanges.${side}`;
      const form = C.flangeForm(node.flanges[side]);
      const formField = selectField(path+'.form','Форма фланця',[['flat','Плоский — без конічної частини'],['conical','З конічною частиною']],form);
      const autoHole = C.automaticHoleDiameter?.(node.fastener.nominalDiameter);
      const holePlaceholder = autoHole ? `Авто (${displayNumber(autoHole)} мм)` : 'Авто';
      const advContent = flangeAdvisoryMarkup(side, node);
      const advisoryHtml = node.flanges[side].mode === 'flange' ? `<div class="advisory-box" data-flange-advisory="${side}" style="margin:8px 0 12px;padding:8px 12px;background:#f8faff;border:1px solid #dce5f2;border-radius:6px;${advContent ? '' : 'display:none;'}">${advContent}</div>` : '';
      const canPickFlange = (node.connection.kind === 'flange-flange' || (node.connection.kind === 'flange-cover' && side === 'sideA')) && node.flanges[side].mode !== 'none';
      return `<h3 class="part-section-title">Геометрія фланця</h3>${canPickFlange ? `<button type="button" class="button secondary fp-entry" data-action="open-flange-picker" data-side="${side}">Підібрати з каталогу</button>` : ''}${selectField(path+'.mode',`Перевірка фланця ${side === 'sideA' ? 'А' : 'Б'}`,[['pending','Оберіть застосовність…'],['flange','Розраховувати як фланець'],['none','Ця перевірка не застосовується']])}${node.flanges[side].mode === 'flange' ? `${formField}<div class="field-row">${field(path+'.innerDiameter','Внутрішній діаметр D','мм')}${field(path+'.boltCircle','Коло кріплень Dw','мм')}</div><div class="field-row">${field(path+'.outerDiameter','Зовнішній діаметр Df','мм')}${field(path+'.holeDiameter','Отвір під кріплення d₀','мм',{placeholder:holePlaceholder,help:'Порожнє поле — автоматично за діаметром кріплення.'})}</div>${advisoryHtml}<div class="field-row">${field(path+'.height','Товщина диска hf','мм')}${field(path+'.coneHeight','Висота конуса h₂','мм',{positive:form === 'conical',readOnly:form === 'flat'})}</div><p class="field-help">hf — товщина диска біля ущільнювальної поверхні. h₂ — висота конічної частини; для плоского фланця — 0.</p><div class="field-row">${field(path+'.wallCylinder','Товщина стінки s₁','мм')}${field(path+'.wallCone',form === 'conical' ? 'Товщина конуса s₂' : 'Товщина s₂','мм')}</div>${node.gasket.mode === 'area' ? field(path+'.gasketDiameter','Розрахунковий діаметр Dm','мм',{help:'Для ручних площ задайте діаметр, потрібний для плеча e₂.'}) : '<p class="field-help">Dm береться за середнім діаметром кільцевої прокладки. Матеріал — із відповідної деталі з’єднання.</p>'}` : ''}`;
    }

    const connection = `<div class="connection-tabs" role="tablist" aria-label="Деталі з’єднання">${['sideA','sideB'].map((side,index)=>
      `<button type="button" role="tab" id="tab-${side}" aria-controls="panel-${side}" aria-selected="${connectionSide === side}" tabindex="${connectionSide === side ? 0 : -1}" data-action="connection-side" data-side="${side}"><span>${index ? 'Б' : 'А'}</span><span class="connection-tab-name">${esc(node.connection[side].name || 'Деталь '+(index ? 'Б' : 'А'))}</span></button>`).join('')}</div>
      ${['sideA','sideB'].map((side,index)=>{
        const path = 'connection.'+side, letter = index ? 'Б' : 'А', target = index ? 'А' : 'Б';
        return `<div role="tabpanel" id="panel-${side}" aria-labelledby="tab-${side}" data-connection-side="${side}" ${connectionSide === side ? '' : 'hidden'}>
          ${field(path+'.name','Назва деталі')}${materialField(path+'.material','Матеріал')}
          <h3 class="part-section-title">Ділянка у пакеті</h3>
          ${field(path+'.height','Товщина деталі у пакеті H','мм',{help:'Розмір уздовж осі кріплення для розрахунку податливості та довжин.'})}
          ${field(path+'.area','Площа перерізу','мм²',{placeholder:'Авто',help:node.gasket.mode === 'ring' ? 'Порожнє поле — за кільцевим полем прокладки. Власне значення можна ввести вручну.' : 'Для прокладки, заданої площами, введіть площу перерізу цієї деталі.'})}
          ${flangeFields(side)}
          ${node.connection.kind === 'flange-flange' ? `<button type="button" class="button secondary copy-part" data-action="copy-connection-side" data-side="${side}" title="Замінити матеріал і розміри деталі ${target} параметрами деталі ${letter}">Скопіювати параметри ${letter} в ${target}</button>` : ''}
        </div>`;
      }).join('')}`;
    let partitions = '';
    if (node.gasket.mode === 'ring') {
      partitions = selectField('gasket.partitionPattern','Схема перегородок',Object.entries(C.gasketPartitions));
      if ((node.gasket.partitionPattern ?? 'none') !== 'none') {
        partitions += field('gasket.partitionWidth','Ширина смуги w','мм',{help:'Висота смуги дорівнює товщині прокладки.'});
        partitions += `<div class="scheme-mismatch" role="status"><p>${esc(C.gasketCalculationNote(node))}</p><button type="button" class="button secondary" data-action="gasket-mode" data-value="area">Задати перевірені площі</button></div>`;
      }
    }
    return Object.entries({scheme,operating,fastener,gasket:gasket + partitions + gasketReference(),...(mount.nuts.length ? {nut} : {}),washers,connection,extras}).map(([key,body]) => section(key,body,openSections.includes(key),{...statuses,scheme:!mismatch})).join('');
  }
  function setupEditorSteps() {
    const body = main.querySelector('.editor-body');
    for (const summary of body.querySelectorAll('.settings-section > summary')) {
      summary.tabIndex = -1;
      summary.addEventListener('click',event => event.preventDefault());
    }
    const nav = document.createElement('nav');
    nav.className = 'node-steps';
    nav.setAttribute('aria-label','Кроки створення вузла');
    nav.innerHTML = visibleSteps().map((key,index) => `<button type="button" data-action="editor-step" data-step="${key}"><span>${index+1}.</span>${sectionNames[key] || 'Розрахунок'}<span class="step-badge" data-step-badge="${key}"></span></button>`).join('');
    body.prepend(nav);
    const preview = document.createElement('section');
    preview.id = 'component-preview';
    preview.className = 'component-preview';
    preview.innerHTML = '<header class="preview-heading"><h2 id="preview-title"></h2></header><div id="component-scene"></div>';
    body.append(preview);
    const controls = document.createElement('div');
    controls.className = 'step-controls';
    controls.innerHTML = '<button class="button secondary" data-action="editor-previous">Назад</button><button class="button primary" data-action="editor-next">Далі</button>';
    body.querySelector('.settings').append(controls);
    selectEditorStep(visibleSteps().includes(editorStep) ? editorStep : 'fastener');
  }
  function selectConnectionSide(side) {
    connectionSide = side;
    connectionDimension = '';
    for (const tab of main.querySelectorAll('[data-action="connection-side"]')) {
      const selected = tab.dataset.side === side;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of main.querySelectorAll('[data-connection-side]')) panel.hidden = panel.dataset.connectionSide !== side;
    main.querySelector('.settings').scrollTop = 0;
    refreshComponentPreview();
  }
  function selectEditorStep(key) {
    if (!visibleSteps().includes(key)) return;
    editorStep = key;
    const calculation = key === 'results';
    const operating = key === 'operating';
    main.querySelector('.editor-body').classList.toggle('show-calculation',calculation);
    main.querySelector('.editor-body').classList.toggle('show-operating',operating);
    for (const section of main.querySelectorAll('.settings-section')) {
      section.hidden = section.dataset.section !== key;
      section.open = !section.hidden;
    }
    for (const button of main.querySelectorAll('.node-steps button')) button.setAttribute('aria-current',button.dataset.step === key ? 'step' : 'false');
    main.querySelector('.settings').hidden = calculation;
    main.querySelector('#results').hidden = !calculation;
    main.querySelector('#component-preview').hidden = calculation || operating;
    main.querySelectorAll('[data-action="editor-previous"]').forEach(btn => { btn.disabled = key === editorSteps[0]; });
    main.querySelector('[data-action="editor-next"]').textContent = key === 'extras' ? 'До розрахунку' : 'Далі';
    main.querySelector('.settings').scrollTop = 0;
    refreshComponentPreview();
  }
  function washerVisual(node,d) {
    const {standardId,accuracyClass,execution} = node.washers;
    const size = C.washerDimensions(standardsDb,standardId,d,accuracyClass,execution);
    if (!size) return null;
    const spring = standardId === 'gost-6402-70';
    return {name:spring ? 'Пружинна шайба' : 'Шайба',diameter:d,spring,execution,
      outer:size.outerDiameterMm,inner:size.innerDiameterMm,h:size.thicknessMm};
  }
  function assemblyPanel(node,scope) {
    const mount = C.mounting(node), parts = [];
    const d = C.number(node.fastener.nominalDiameter);
    const pitch = C.threadPitch(standardsDb,node.fastener.threadStandardId,d,node.fastener.pitch)?.pitchMm;
    const count = C.number(node.fastener.count);
    function end(code,upper) {
      if (code === 'body') return;
      if (code === 'head') {
        parts.push({kind:'head',upper,name:'Головка болта'});
        return;
      }
      const config = C.nutAt(node,code);
      const size = C.nutDimensions(standardsDb,config.standardId,d,config.typeId);
      const capped = config.typeId === 'B' && Boolean(standardsDb.nuts[config.standardId]?.types?.B);
      const dimensions = size ? [`${size.heightSymbol} = ${displayNumber(size.heightMm)}`, size.acrossFlatsMm && `S = ${displayNumber(size.acrossFlatsMm)}`].filter(Boolean).join(' · ')+' мм' : '';
      const detail = [dimensions, Number.isInteger(count) && count > 0 && displayNumber(count)+' шт.'].filter(Boolean).join(' · ');
      parts.push({kind:'nut',upper,capped,height:size?.heightMm,acrossFlats:size?.acrossFlatsMm,detail,
        name:(capped ? 'Ковпачкова гайка' : 'Гайка')+(mount.nuts.length === 2 ? ', бік '+(upper ? 'А' : 'Б') : '')});
    }
    function side(key,letter) {
      const member = node.connection[key], flange = node.flanges?.[key];
      const active = flange?.mode === 'flange';
      const dims = [];
      if (active) {
        for (const [field,label] of [['outerDiameter','Ø зовн.'],['innerDiameter','Ø внутр.'],['boltCircle','Ø кола'],['height','h']]) {
          if (C.positive(flange[field])) dims.push(label+' '+displayNumber(flange[field]));
        }
      }
      const tapped = mount.body === key;
      if (tapped && C.positive(mount.engagement)) dims.push('Зачеплення '+displayNumber(mount.engagement));
      const role = node.connection.kind === 'body-cover' ? (key === 'sideA' ? 'cover' : 'body') : node.connection.kind === 'flange-cover' ? (key === 'sideA' ? 'flange' : 'cover') : node.connection.kind === 'flange-flange' ? 'flange' : 'part';
      parts.push({kind:'side',side:key,role,upper:key === 'sideA',tapped,engagement:tapped ? C.number(mount.engagement) : null,
        memberHeight:C.number(member.height),flanged:active || (node.connection.kind === 'flange-cover' ? key === 'sideA' : node.connection.kind === 'flange-flange'),
        flange:active ? {...Object.fromEntries(['outerDiameter','innerDiameter','boltCircle','coneHeight','wallCylinder','wallCone','holeDiameter','gasketDiameter'].map(k=>[k,C.number(flange[k])])),form:C.flangeForm(flange)} : null,
        thickness:(active && C.number(flange.height)) || C.number(member.height),
        name:letter+' · '+(member.name || (active ? 'Фланець' : 'Деталь')),detail:dims.length ? dims.join(' · ')+' мм' : ''});
    }
    const placement = node.washers.placement;
    const washer = placement === 'none' ? null : washerVisual(node,d);
    function addWasher(side,letter) {
      if (![side,'both'].includes(placement)) return;
      parts.push({...washer,kind:'washer',name:(washer?.name || 'Шайба')+', бік '+letter,
        detail:washer ? standardsDb.washers[node.washers.standardId].document : 'Розміри не визначено'});
    }
    end(mount.a,true);
    addWasher('a','А');
    side('sideA','А');
    parts.push({kind:'gasket',name:'Прокладка',full:node.gasket.mode === 'ring' && node.gasket.hasHoles,
      outer:node.gasket.mode === 'ring' && C.number(node.gasket.outerDiameter),
      inner:node.gasket.mode === 'ring' && C.number(node.gasket.innerDiameter),thickness:C.number(node.gasket.thickness)});
    for (const extra of node.extras) parts.push({kind:'extra',name:extra.name || 'Додатковий елемент',thickness:C.number(extra.thickness)});
    side('sideB','Б');
    addWasher('b','Б');
    end(mount.b,false);
    const fastener = mount.label + (d > 0 ? ' · М'+displayNumber(d) : '');
    return `<div class="assembly-panel assembly-passport"><div class="assembly-caption"><strong>Осьовий розріз з’єднання</strong><span>${fastener}${C.positive(node.fastener.count) ? ' · '+displayNumber(node.fastener.count)+' шт.' : ''}</span></div>
      <div class="assembly-scroll">${window.FlangeComponentVisuals.assembly(parts,{bolt:mount.bolt,diameter:d,pitch,axialHole:C.number(node.fastener.axialHoleDiameter),
        activeSide:scope === 'preview' && editorStep === 'connection' ? connectionSide : null,dimension:connectionDimension},scope)}</div>
      <ol class="assembly-key">${parts.map(p=>`<li ${scope === 'preview' && editorStep === 'connection' && p.side === connectionSide ? 'class="assembly-key-active"' : ''}>${esc(p.name)}${p.detail ? '<small>'+esc(p.detail)+'</small>' : ''}</li>`).join('')}</ol></div>`;
  }
  function refreshComponentPreview() {
    const scene = main.querySelector('#component-scene');
    if (!scene || !currentNode || scene.parentElement.hidden) return;
    const node = currentNode;
    const visual = window.FlangeComponentVisuals;
    main.querySelector('#preview-title').textContent = sectionNames[editorStep];
    if (editorStep === 'connection') {
      const name = node.connection[connectionSide].name || 'Деталь';
      const field = main.querySelector(`[data-field="${connectionDimension}"]`);
      const label = field?.closest('.field')?.querySelector('label')?.textContent;
      main.querySelector('#preview-title').textContent = name+' · '+(connectionSide === 'sideA' ? 'А' : 'Б')+(label ? ' / '+label : '');
    }
    scene.className = 'component-scene passport';
    const message = text => { scene.innerHTML = `<p class="preview-empty">${esc(text)}</p>`; };
    const d = C.number(node.fastener.nominalDiameter);
    const pitch = C.threadPitch(standardsDb,node.fastener.threadStandardId,d,node.fastener.pitch)?.pitchMm;
    const geometry = window.FlangeCalculations.nodeGeometry(node,standardsDb);
    let key,part;
    if (editorStep === 'fastener') {
      if (!(d > 0 && pitch > 0)) { message('Задайте діаметр і допустимий крок різьби.'); return; }
      key = 'stud';
      part = {name:C.mounting(node).bolt ? 'Болт' : 'Шпилька',diameter:d,outer:d,inner:0,h:d*4.7,spec:`М${displayNumber(d)} × ${displayNumber(pitch)}`,count:C.number(node.fastener.count),bolt:C.mounting(node).bolt,axialHole:C.number(node.fastener.axialHoleDiameter)};
      if (part.axialHole >= geometry.thread.values.rootDiameter || part.axialHole < 0) { message('Уточніть діаметр поздовжнього отвору.'); return; }
    } else if (editorStep === 'gasket') {
      if (node.gasket.mode === 'area') {
        scene.innerHTML = `<div class="preview-metrics"><h3>Прокладка з довільною формою</h3><dl><dt>Ефективна площа Aпр</dt><dd>${displayNumber(node.gasket.effectiveArea)} мм²</dd><dt>Площа дії тиску A</dt><dd>${displayNumber(node.gasket.pressureArea)} мм²</dd><dt>Товщина</dt><dd>${displayNumber(node.gasket.thickness)} мм</dd></dl></div>`;
        return;
      }
      if (geometry.gasket.issues.length || !C.positive(node.gasket.thickness)) { message(geometry.gasket.issues[0] || 'Задайте товщину прокладки.'); return; }
      key = 'gasket';
      part = {name:'Прокладка',outer:C.number(node.gasket.outerDiameter),inner:C.number(node.gasket.innerDiameter),h:C.number(node.gasket.thickness),hasHoles:node.gasket.hasHoles,holeDiameter:C.number(node.gasket.holeDiameter),count:C.number(node.fastener.count)};
      part.partitionPattern = node.gasket.partitionPattern ?? 'none';
      if (part.partitionPattern !== 'none') {
        const issue = C.validateInputs(node,standardsDb).errors['gasket.partitionWidth'];
        if (issue || !C.positive(node.gasket.partitionWidth)) { message(issue || 'Вкажіть ширину смуги перегородки.'); return; }
        part.partitionWidth = C.number(node.gasket.partitionWidth);
      }
      if (part.hasHoles && part.count > 240) { message('Розміри прокладки задано. Кількість отворів завелика для детального попереднього перегляду.'); return; }
      if (part.hasHoles) {
        const circles = [node.flanges.sideA,node.flanges.sideB].filter(side => side.mode === 'flange')
          .map(side => C.number(side.boltCircle)).filter(value => value > 0);
        const circle = circles[0];
        if (circles.length && circles.every(value => value === circle) &&
            circle - part.holeDiameter >= part.inner && circle + part.holeDiameter <= part.outer) part.pitchCircle = circle;
      }
    } else if (editorStep === 'nut') {
      const mount = C.mounting(node), separate = mount.nuts.length === 2 && node.fastener.differentNuts;
      const selection = separate && previewNut === 'nutB' ? node.nutB : node.nut;
      const dimensions = C.nutDimensions(standardsDb,selection.standardId,d,selection.typeId);
      for (const button of main.querySelectorAll('[data-action="nut-view"]')) button.setAttribute('aria-pressed',String(button.dataset.nut === previewNut));
      if (!dimensions) { message(nutChoiceMessage(selection,d)); return; }
      key = 'nut';
      part = {name:'Гайка',diameter:d,outer:d*1.75,inner:d,h:dimensions.heightMm,heightSymbol:dimensions.heightSymbol,acrossFlats:dimensions.acrossFlatsMm,capped:dimensions.typeId === 'B',spec:'М'+displayNumber(d)};
      main.querySelector('#preview-title').textContent = 'Гайка М'+displayNumber(d)+(separate ? ' · бік '+(mount.a === previewNut ? 'А' : 'Б') : '');
    } else if (editorStep === 'washers') {
      if (node.washers.placement === 'none') { message('У цьому вузлі шайби не застосовуються.'); return; }
      part = washerVisual(node,d);
      if (!part) { message('Оберіть сумісні діаметр, виконання та клас точності шайби.'); return; }
      key = 'washer';
      main.querySelector('#preview-title').textContent = part.name+' · '+standardsDb.washers[node.washers.standardId].document;
    } else if (editorStep === 'connection' || editorStep === 'scheme') {
      scene.innerHTML = assemblyPanel(node,'preview');
      return;
    } else {
      const rows = node.extras.map(item => [item.name,item.thickness,item.area]);
      scene.innerHTML = `<div class="preview-metrics">${rows.map(([name,height,area]) => `<h3>${esc(name || 'Додаткова деталь')}</h3><dl><dt>Висота</dt><dd>${displayNumber(height)} мм</dd><dt>Площа перерізу</dt><dd>${C.positive(area) ? displayNumber(area)+' мм²' : 'За геометрією прокладки'}</dd></dl>`).join('') || '<p>Додайте деталі, що входять до пакета з’єднання.</p>'}</div>`;
      return;
    }
    part.spec ||= `Ø ${displayNumber(part.outer)} × Ø ${displayNumber(part.inner)} × ${displayNumber(part.h)}`;
    part.detail = {stud:'Профіль різьби',nut:'Внутрішня різьба',gasket:'Кромка прокладки',washer:'Кромка отвору'}[key];
    scene.replaceChildren(visual.create('passport',key,part,pitch || 1));
  }
  function renderEditor(preserve = false) {
    if (!preserve) {editorStep = 'scheme'; connectionSide = 'sideA'; connectionDimension = ''; previewNut = 'nut';}
    const oldSettings = document.querySelector('.settings');
    const scroll = preserve ? oldSettings?.scrollTop || 0 : 0;
    const openSections = preserve ? [...document.querySelectorAll('.settings-section[open]')].map(item => item.dataset.section) : ['scheme'];
    const oldResults = preserve ? resultsState() : null;
    const node = currentNode;
    main.innerHTML = `<section class="editor"><div class="node-topbar"><div class="node-title"><button class="icon-button" data-action="open-equipment" data-id="${currentEquipment.id}" aria-label="Назад до вузлів">${icon('arrow')}</button><span class="file-icon">${icon('file')}</span><div><h1>${esc(node.name)}</h1><p>${esc(currentEquipment.name)} · ${kindName(node.connection.kind)}</p></div><button class="icon-button" data-action="edit-node" data-id="${node.id}" aria-label="Перейменувати вузол">${icon('edit')}</button></div><div class="torque-bar" role="group" aria-label="Межі моменту затягування"><div class="torque-comparison"></div><div class="torque-item"><div class="torque-label">Мінімальний момент</div><div class="torque-value">Ще не розраховано</div></div><div class="torque-item"><div class="torque-label">Максимальний момент</div><div class="torque-value">Ще не розраховано</div></div></div></div><div class="editor-body"><aside class="settings" aria-label="Налаштування вузла"><div class="settings-heading"><div>${icon('settings')}Параметри вузла</div><small id="progress-count"></small></div><div id="input-validation" class="input-validation" role="status" hidden></div>${settingsContent(openSections)}</aside><div class="results" id="results"></div></div></section>`;
    const nextSettings = document.querySelector('.settings');
    if (nextSettings) nextSettings.scrollTop = scroll;
    setupEditorSteps();
    refreshResults(oldResults);
    updateStatuses();
  }
  function resultsState() {
    return { open:[...document.querySelectorAll('.calc-block[open]')].map(item => item.dataset.calc), scroll:document.querySelector('#results')?.scrollTop || 0 };
  }
  function refreshResults(previous = resultsState()) {
    refreshComponentPreview();
    const target = document.querySelector('#results');
    if (!target) return;
    const node = currentNode;
    const p = C.progress(node,materials,standardsDb);
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
    target.innerHTML = `<div class="results-title"><div class="results-title-group"><button class="button secondary" data-action="editor-previous">${icon('arrow')}Назад до параметрів</button><h2>Розрахунок вузла</h2></div><div class="results-title-actions"><button class="button secondary" data-action="excel-export" data-scope="node">Експорт Excel</button><span class="outline-badge">${p.done === p.total ? 'Анкета заповнена' : 'Анкета в роботі'}</span></div></div><p class="calculation-notice">${icon('info')}<span>Розрахунок геометрії, навантаження, температурних зусиль, міцності кріплення та рекомендованих меж моменту затягування.</span></p>${assemblyPanel(node,'results')}${blocks.map(([key,title,rows]) => `<details class="calc-block" data-calc="${key}" ${open.includes(key) ? 'open' : ''}><summary>${icon('chevron')}${title}<small>Ще не розраховано</small></summary>${rows.length ? `<table class="result-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([label,unit]) => `<tr><td>${label}${unit ? `<span>, ${unit}</span>` : ''}</td><td aria-label="Не розраховано">—</td><td aria-label="Не розраховано">—</td></tr>`).join('')}</tbody></table>` : '<p class="calc-footer">Геометрію фланців і перевірки перерізів А–А, В–В та С–С додаємо наступним етапом.</p>'}</details>`).join('')}<p class="results-end">${icon('file')}Редагований Excel із формулами — кнопка «Експорт Excel» над розрахунком.</p>`;
    target.querySelector('.assembly-panel').insertAdjacentHTML('afterend',geometryBlock(open.includes('geometry')));
    target.querySelector('[data-calc="load"]').outerHTML = complianceBlock(open.includes('load'));
    target.querySelector('[data-calc="thermal"]').outerHTML = thermalBlock(open.includes('thermal'));
    const limits = window.FlangeCalculations.nodeLimits(node,materials,standardsDb);
    const forces = limits.forces;
    const strength = limits.strength;
    target.querySelector('[data-calc="parameters"]').outerHTML = forcesBlock(forces,open.includes('parameters'));
    target.querySelector('[data-calc="tightness"]').outerHTML = tightnessBlock(forces,open.includes('tightness'));
    target.querySelector('[data-calc="limits"]').outerHTML = limitsBlock(limits,open.includes('limits'),node,standardsDb);
    target.querySelector('[data-calc="stud"]').outerHTML = strengthBlock(strength,open.includes('stud'));
    target.querySelector('[data-calc="thread"]').outerHTML = threadStrengthBlock(strength,open.includes('thread'));
    target.querySelector('[data-calc="flanges"]').outerHTML = flangeBlock(limits.flanges,open.includes('flanges'));
    const minimum = document.querySelector('.torque-value');
    minimum.textContent = limits.minimum.roundedTorqueNm === null ? 'Потрібні дані' : `${displayNumber(limits.minimum.roundedTorqueNm)} Н·м`;
    minimum.classList.toggle('calculated',limits.minimum.roundedTorqueNm !== null);
    minimum.title = 'Нижня межа за умовами прокладки, округлена вгору як P88 Excel.';
    const maximum = document.querySelectorAll('.torque-value')[1];
    maximum.textContent = limits.maximum.roundedTorqueNm === null ? 'Потрібні дані' : `${displayNumber(limits.maximum.roundedTorqueNm)} Н·м`;
    maximum.classList.toggle('calculated',limits.maximum.roundedTorqueNm !== null);
    maximum.title = 'Верхня межа за формулами кріплення та різьби Excel, округлена вниз. Міцність фланців ще не враховано; перевірте результати меж.';
    document.querySelectorAll('.torque-label')[1].textContent = limits.flanges.configured ? 'Максимальний момент' : limits.maximum.scope === 'fastener-thread-only' ? 'Максимум без фланців' : 'Попередній максимум';
    maximum.title = limits.flanges.configured ? 'Верхня межа за обмеженнями всіх заданих деталей. Перевірте контроль округлених меж.' : 'Застосовність фланців ще не визначена для обох деталей. Це попередня верхня межа.';
    const comparison = document.querySelector('.torque-comparison');
    comparison.innerHTML = renderTorqueComparison(
      limits.minimum.roundedTorqueNm, limits.maximum.roundedTorqueNm, C.effectiveTargetTorque(node,standardsDb), false
    );
    if (limits.roundedOverlap && !limits.rangePassed) {
      comparison.insertAdjacentHTML('beforeend','<small class="torque-comparison-note">Межі розрахунку не підтверджено</small>');
    }
    target.querySelector('.calculation-notice span').textContent = Object.keys(limits.inputErrors).length ? 'Виправте позначені помилки введення в анкеті. Розрахунок не підтверджений.' : limits.rangePassed ? 'Усі задані перевірки округлених меж виконані за перенесеною методикою Excel.' : limits.maximum.omitted.length ? 'Межі визначені як в Excel. Внутрішню різьбу чавунного корпусу без Rp пропущено; її міцність не підтверджена.' : limits.flanges.configured ? 'Фланці включені за вибраною застосовністю. Перевірте дані, сумісність і контроль округлених меж: підтвердженого діапазону поки немає.' : 'Для повного розрахунку визначте застосовність фланцевих перевірок для деталей А та Б. Наявні обмеження враховані; округлені межі перевіряються окремо.';
    if (!limits.complete) {
      const issue = nextInputIssue(node,limits);
      if (issue) {
        const notice = target.querySelector('.calculation-notice span');
        if (limits.maximum.omitted.length) notice.insertAdjacentHTML('beforeend',issueMarkup(issue,node));
        else notice.innerHTML = issueMarkup(issue,node);
      }
    }
    if (window.FlangeExcel.pendingReference(node)) {
      target.querySelector('.calculation-notice span').prepend(window.FlangeExcel.pendingMessage+' ');
    }
    const gasketNote = C.gasketCalculationNote(node);
    if (gasketNote) target.querySelector('.calculation-notice span').prepend(gasketNote+' ');
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
  function limitsBlock(calculated,open,node = currentNode,catalog = standardsDb) {
    const names = {seating:'Початкове обтиснення',sealingRequired:'Герметичність під тиском',pressureRequired:'Мінімальний питомий тиск'};
    const label = item => `${names[item.key]} · ${item.mode === 'normal' ? 'НУЕ' : 'ГВ'}`;
    const result = calculated.minimum;
    const upper = calculated.maximum;
    const upperNames = {axial:'Розтяг без температурного внеску σ₁',thermalAxial:'Обмеження σ₃ за Excel',fastenerNut:'Різьба кріплення з боку гайки',fastenerBody:'Різьба кріплення з боку корпусу',nut:'Внутрішня різьба гайки',body:'Внутрішня різьба корпусу'};
    const upperLabel = item => `${item.side ? `Фланець ${item.side === 'sideA' ? 'А' : 'Б'}, ${item.section}–${item.section}` : upperNames[item.key]} · ${item.mode === 'normal' ? 'НУЕ' : 'ГВ'}`;
    const maxLabel = calculated.flanges.configured ? 'Максимум' : 'Попередній максимум';
    const boundsFailed = Object.values(calculated.verification).some(checked=>checked?.failed.length);
    const status = calculated.roundedOverlap === null ? 'Потрібні дані' : !calculated.roundedOverlap ? 'Межі несумісні' : boundsFailed ? 'Є невиконані умови на межах' : upper.omitted.length ? 'Межі за Excel; є пропуски' : calculated.rangePassed ? 'Межі перевірено' : 'Попередні межі';
    const overlap = calculated.rawOverlap === false ? 'Нижня межа перевищує верхню: діапазон за цими обмеженнями порожній.' : calculated.roundedOverlap === false ? 'Після округлення діапазон порожній: немає цілого значення Н·м між межами.' : calculated.roundedOverlap === null ? 'Для порівняння меж потрібні всі активні обмеження НУЕ та ГВ.' : 'Межі за обчисленими обмеженнями сумісні. ' + (calculated.flanges.configured ? 'Результати контролю наведені нижче.' : 'Потрібно визначити застосовність фланців.');

    const diag = (window.FlangeCalculations?.tighteningLimitsDiagnostic && node && calculated.roundedOverlap === false)
      ? window.FlangeCalculations.tighteningLimitsDiagnostic(calculated, node, catalog)
      : null;
    const bottleneckLabels = {
      'thread shear': 'Міцність різьби на зріз',
      'stud tensile strength': 'Міцність кріплення на розтяг (шпильки/болти)',
      'flange bending': 'Опір тарілки/втулки фланця вигину',
      'gasket dimensions/material': 'Параметри / площа контакту прокладки',
      'rounding': 'Крок цілочисельного округлення (інтервал < 1 Н·м)',
      'none': 'Не визначено'
    };
    let diagnosticMarkup = '';
    if (diag && (diag.status === 'conflict' || diag.status === 'rounding_conflict')) {
      const isSevere = diag.status === 'conflict';
      const badgeIcon = isSevere ? 'close' : 'info';
      const badgeText = isSevere ? 'Конфлікт меж затягування (Mmin > Mmax)' : 'Конфлікт цілочисельного округлення меж';
      const bottleneckText = bottleneckLabels[diag.bottleneck] || diag.bottleneck;
      diagnosticMarkup = `<div class="limits-diagnostic ${isSevere ? 'conflict' : 'warning'}" role="alert" data-diagnostic-status="${esc(diag.status)}">`
        + `<div class="limits-diagnostic-header">`
        + `<span class="limits-diagnostic-badge ${isSevere ? 'conflict' : 'warning'}">${icon(badgeIcon)}<span>${badgeText}</span></span>`
        + (diag.bottleneck && diag.bottleneck !== 'none' ? `<span class="limits-diagnostic-bottleneck" data-bottleneck="${esc(diag.bottleneck)}">Вузьке місце: <strong>${esc(bottleneckText)}</strong></span>` : '')
        + `</div>`
        + `<p class="limits-diagnostic-reason">${esc(diag.reason)}</p>`
        + (diag.recommendations.length ? `<div class="limits-diagnostic-recs">`
          + `<span class="limits-diagnostic-recs-title">Рекомендовані інженерні дії для коригування:</span>`
          + `<ul class="limits-diagnostic-list">${diag.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`
          + `</div>` : '')
        + `</div>`;
    }

    const checkNames = {gasket:{seating:'Обтиснення прокладки',sealing:'Герметичність під тиском',minimumPressure:'Мінімальний питомий тиск',maximumPressure:'Максимальний питомий тиск'},checks:{axial:'Розтяг σ₁',thermalAxial:'Розтяг σ₃',equivalent:'Приведені напруження σ₄',torsion:'Кручення'},threads:upperNames,flanges:{pressureA:'Фланець: σ₂ у А–А',pressureB:'Фланець: σ₂ у B–B',bendingA:'Фланець: σrv у A–A',bendingB:'Фланець: σrv у B–B',bendingC:'Фланець: σrv у C–C'}};
    const verification = ['minimum','maximum'].map(bound=>{
      const checked = calculated.verification[bound];
      const title = `${bound === 'minimum' ? 'Нижня' : 'Верхня'} округлена межа`;
      if (!checked) return `<p>${title}: перевірка недоступна — момент не визначений або від’ємний.</p>`;
      const state = checked.failed.length ? 'Є невиконані умови' : checked.pending.length ? 'Потрібні дані' : checked.omitted.length ? 'Є пропущені перевірки' : 'Наявні перевірки пройдено';
      return `<details><summary>${title}: ${displayNumber(checked.torqueNm)} Н·м — ${state}</summary><p>Виконано ${checked.checks.length-checked.failed.length-checked.pending.length-checked.omitted.length} із ${checked.checks.length} наявних перевірок. ${calculated.flanges.configured ? 'Враховані задані фланцеві перевірки.' : 'Застосовність фланців ще не визначена повністю.'}</p>${[...checked.failed,...checked.pending,...checked.omitted].map(check=>`<p>${check.omitted ? 'Пропущено як в Excel' : check.passed === false ? 'Не виконано' : 'Потрібні дані'}: ${esc(checkNames[check.group][check.key])} · ${check.mode === 'normal' ? 'НУЕ' : 'ГВ'}.</p>`).join('')}</details>`;
    }).join('');
    return `<details class="calc-block" data-calc="limits" ${open ? 'open' : ''}><summary>${icon('chevron')}Межі затягування<small class="${calculated.roundedOverlap === false ? 'error' : ''}">${status}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">Мінімум</th><th scope="col">${maxLabel}</th></tr></thead><tbody><tr><td>Сумарне початкове зусилля, Н</td><td>${displayNumber(result.force)}</td><td>${displayNumber(upper.force)}</td></tr><tr><td>Розрахунковий момент, Н·м</td><td>${displayNumber(result.torqueNm)}</td><td>${displayNumber(upper.torqueNm)}</td></tr><tr><td>Округлений момент, Н·м</td><td>${displayNumber(result.roundedTorqueNm)}</td><td>${displayNumber(upper.roundedTorqueNm)}</td></tr></tbody></table><div class="calc-footer">${diagnosticMarkup}${!diagnosticMarkup ? `<p><strong>${overlap}</strong></p>` : ''}<p>Визначає мінімум: ${result.governing.length ? result.governing.map(label).join('; ') : 'потрібні дані'}.</p><p>Визначає ${maxLabel.toLocaleLowerCase('uk-UA')}: ${upper.governing.length ? upper.governing.map(upperLabel).join('; ') : 'потрібні дані'}.</p><details><summary>Умови нижньої межі</summary>${result.candidates.map(item=>`<p>${label(item)}: ${displayNumber(item.force)} Н.</p>`).join('')}</details><details><summary>Обмеження верхньої межі</summary>${upper.candidates.map(item=>`<p>${upperLabel(item)}: ${item.omittedFromMaximum ? 'пропущено як в Excel: відсутній Rp чавунного корпусу' : item.active ? `${displayNumber(item.force)} Н` : 'не застосовується'}.</p>`).join('')}${upper.issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}</details><p>Контроль округлених меж незалежний від заданого моменту анкети:</p>${verification}<details><summary>Формули та округлення</summary><p>Fmin = max п’яти умов прокладки; Fmax = min активних обмежень кріплення, різьби та підключених фланців. M = F·ζ₁·d/(z·1000). Мінімум округлюється вгору, максимум униз до цілого Н·м, як P88/P89 Excel.</p><p>Збережено N67: [σ]·Aгладк·z − χ·Fp + Ft та O67: [σ]·Aгладк·z − χ·Fp − Ft. Ці формули не замінено оберненням перевірки σ₃. Окремі обмеження для σ₄, кручення й qmax у переліку Excel відсутні — їх контролює перевірка округлених меж.</p></details><p>${calculated.rangePassed ? 'Усі задані перевірки округлених меж виконані за перенесеною методикою Excel.' : upper.omitted.length ? 'Межі за Excel містять пропущену перевірку внутрішньої різьби чавунного корпусу. Її міцність не підтверджена.' : calculated.flanges.configured ? 'Є неповні або невиконані умови. Повний діапазон не підтверджено.' : 'Застосовність фланців визначена не повністю: максимум попередній.'}</p></div></details>`;
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
    const rows = [['fastenerNut','Різьба кріплення з боку гайки'],['fastenerBody','Різьба кріплення з боку корпусу'],['nut','Внутрішня різьба гайки'],['body','Внутрішня різьба корпусу']];
    if (calculated.states.normal.threads.nutB) rows.push(['fastenerNutB','Різьба кріплення біля другої гайки'],['nutB','Внутрішня різьба другої гайки']);
    const checks = ['normal','hydro'].flatMap(mode=>Object.values(calculated.states[mode].threads));
    return `<details class="calc-block" data-calc="thread" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахунок міцності різьбових з’єднань<small>${strengthStatus(checks)}</small></summary><table class="result-table checks-table"><thead><tr><th scope="col">Зріз різьби</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label])=>`<tr><td>${label}</td>${['normal','hydro'].map(mode=>strengthCell(calculated.states[mode].threads[key])).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><p>τр = Fw/(π·dрозр·h·z·K₁·Km). Для зовнішньої різьби dрозр = d₃, для внутрішньої — номінальний d.</p><p>Допустимі напруження: кріплення й гайка — 0,32·Rp для НУЕ, 0,25·Rp для ГВ; корпус — 0,32·Rp для обох режимів, як N/O45 Excel.</p><details><summary>Висоти та коефіцієнти різьби</summary>${rows.map(([key,label])=>{
      const part = calculated.states.normal.threads[key];
      return `<p>${label}: ${part.active ? `h = ${displayNumber(part.height)} мм; K₁ = ${displayNumber(part.k1)}; Km = ${displayNumber(part.km)}.` : 'не застосовується.'}</p>`;
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
    const format = (value,factor) => displayNumber(value,{scientific:!factor});
    const complete = modes.every(([mode]) => calculated.states[mode].values.loadFactor !== null);
    return `<details class="calc-block" data-calc="load" ${open ? 'open' : ''}><summary>${icon('chevron')}Розрахунок коефіцієнта навантаження<small>${complete ? 'Обчислено' : 'Потрібні дані'}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label]) => `<tr><td>${label}${key === 'loadFactor' ? '' : '<span>, мм/Н</span>'}</td>${modes.map(([mode]) => `<td>${format(calculated.states[mode].values[key],key === 'loadFactor')}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="calc-footer"><p>Перерізи деталей: А = ${displayNumber(calculated.areas.sideA)} мм²; Б = ${displayNumber(calculated.areas.sideB)} мм².</p>${modes.map(([mode,label]) => {
      const result = calculated.states[mode];
      return `<p>${label}: ${result.fastenerClass === 'short' ? 'коротке кріплення, L* &lt; 6d₀' : result.fastenerClass === 'long' ? 'довге кріплення, L* ≥ 6d₀' : 'тип кріплення ще не визначено'}.</p>${result.issues.length ? `<details><summary>${label}: дані для перевірки (${result.issues.length})</summary>${result.issues.map(issue => `<p>${esc(issue)}</p>`).join('')}</details>` : ''}<details><summary>Модулі E, використані для ${label}</summary>${result.sources.map(source => `<p>${esc(source.name)}: ${displayNumber(source.valueMPa)} МПа при ${displayNumber(source.temperature)} °C.</p>`).join('') || '<p>Дані ще не задані.</p>'}</details>`;
    }).join('')}<p>χ = λпр / (λпр + λдеталей + λшайб + λдодаткових + λw). Для довгого кріплення збережена гілка Excel λw = λнерізьбової / z.</p></div></details>`;
  }
  function thermalBlock(open) {
    const calculated = window.FlangeCalculations.nodeThermal(currentNode,materials,standardsDb);
    const rows = [['fastener','Розширення шпильки / болта'],['gasket','Розширення прокладки'],['sideA','Розширення деталі А'],['sideB','Деталь Б — для наскрізного болта'],['washerA','Розширення шайби А'],['washerB','Розширення шайби Б'],['extras','Додаткові елементи — тільки податливість'],['pack','Сумарне розширення пакета'],['force','Температурне зусилля Ft']];
    const normal = calculated.normal;
    return `<details class="calc-block" data-calc="thermal" ${open ? 'open' : ''}><summary>${icon('chevron')}Лінійне розширення та температурне зусилля<small>${normal.values.force === null ? 'Потрібні дані НУЕ' : 'Обчислено'}</small></summary><table class="result-table compliance-table"><thead><tr><th scope="col">Параметр</th><th scope="col">НУЕ</th><th scope="col">ГВ</th></tr></thead><tbody>${rows.map(([key,label]) => `<tr><td>${label}<span>, ${key === 'force' ? 'Н' : 'мм'}</span></td><td>${displayNumber(normal.values[key])}</td><td title="Консервативно прийнято 0">0</td></tr>`).join('')}</tbody></table><div class="calc-footer"><p>Температура відліку: 20 °C. Розширення кріплення в усіх режимах і температурний внесок ГВ консервативно прийняті нульовими.</p><p>Для НУЕ: Ft = (Δlпакета − 0) / Σλ. Проставки впливають на Σλ, їхній внесок у розширення не враховується.</p><p>α прокладки: точна або найближча вища таблична температура; вище останньої точки значення недоступне.</p>${normal.issues.length ? `<details><summary>Дані для перевірки НУЕ (${normal.issues.length})</summary>${normal.issues.map(issue=>`<p>${esc(issue)}</p>`).join('')}</details>` : ''}<details><summary>Використані коефіцієнти α</summary>${normal.sources.map(source=>`<p>${esc(source.name)}: ${displayNumber(source.value)} × 10⁻⁶/К при ${displayNumber(source.temperature)} °C.</p>`).join('') || '<p>Дані ще не задані.</p>'}</details></div></details>`;
  }
  function updateStatuses() {
    const p = C.progress(currentNode,materials,standardsDb);
    document.querySelector('#progress-count').textContent = `${p.done} / ${p.total} блоків`;
    const fastenerSummary = main.querySelector('[data-fastener-summary]');
    const diameter = C.number(currentNode.fastener.nominalDiameter);
    const count = C.number(currentNode.fastener.count);
    const dimensions = [];
    if (diameter > 0) dimensions.push(`М${displayNumber(diameter)}`);
    if (count > 0 && Number.isInteger(count)) dimensions.push(`${displayNumber(count)} шт.`);
    fastenerSummary.textContent = dimensions.join(' · ');
    fastenerSummary.hidden = !dimensions.length;
    for (const key of C.sections) {
      const summary = document.querySelector(`[data-section="${key}"] summary .section-status`);
      if (summary) summary.outerHTML = statusMarkup(key,p.statuses[key]);
    }
    const mount = C.mounting(currentNode);
    for (const key of editorSteps) {
      const badge = document.querySelector(`.node-steps button[data-step="${key}"] .step-badge`);
      if (!badge) continue;
      let done = false;
      if (key === 'scheme') {
        done = !schemeMismatch(currentNode);
      } else if (key === 'results') {
        done = p.done === p.total;
      } else if (key === 'nut' && !mount.nuts.length) {
        done = true;
      } else {
        done = !!p.statuses[key];
      }
      badge.className = `step-badge ${done ? 'done' : 'pending'}`;
      badge.textContent = done ? '✓' : '•';
      badge.title = done ? 'Секція заповнена' : 'Очікує заповнення';
    }
    updateMaterialWarnings();
    for (const coefficients of main.querySelectorAll('[data-operating-coefficients]')) {
      coefficients.outerHTML = operatingCoefficients(coefficients.dataset.operatingCoefficients);
    }
    const gasketPanel = document.querySelector('[data-gasket-reference]');
    if (gasketPanel) gasketPanel.outerHTML = gasketReference();
    for (const box of document.querySelectorAll('[data-standard-kind]')) box.outerHTML = standardBox(box.dataset.standardKind);
    for (const side of ['sideA','sideB']) {
      const tabName = main.querySelector(`#tab-${side} .connection-tab-name`);
      if (tabName) tabName.textContent = currentNode.connection[side].name || 'Деталь '+(side === 'sideA' ? 'А' : 'Б');
      const box = document.querySelector(`[data-flange-advisory="${side}"]`);
      if (box) {
        const content = flangeAdvisoryMarkup(side, currentNode);
        box.innerHTML = content;
        box.style.display = content ? '' : 'none';
      }
      const autoHole = C.automaticHoleDiameter?.(currentNode.fastener?.nominalDiameter);
      const holePlaceholder = autoHole ? `Авто (${displayNumber(autoHole)} мм)` : 'Авто';
      const input = document.querySelector(`input[data-field="flanges.${side}.holeDiameter"]`);
      if (input && input.placeholder !== holePlaceholder) input.placeholder = holePlaceholder;
    }
    updateValidation();
  }
  function updateValidation() {
    const {errors,missing} = C.validateInputs(currentNode,standardsDb);
    let count = 0;
    for (const input of document.querySelectorAll('[data-field]')) {
      const output = input.closest('.field')?.querySelector('.field-error');
      if (!output) continue;
      const path = input.dataset.field;
      const error = errors[path];
      const isMissing = Boolean(!error && !input.readOnly && missing[path]);
      const message = error || (isMissing ? missing[path] : '');
      input.classList.toggle('missing',isMissing);
      output.classList.toggle('missing',isMissing);
      if (output.textContent !== message) output.textContent = message;
      output.hidden = !message;
      input.setAttribute('aria-invalid',String(!!error));
      if (error) count++;
    }
    const notice = document.querySelector('#input-validation');
    if (notice) {
      notice.hidden = !count;
      if (!notice.firstElementChild) notice.innerHTML = '<span></span><button data-action="first-input-error">Перейти до першої</button>';
      notice.querySelector('span').textContent = `Помилки у полях: ${count}.`;
    }
  }

  let confirmCallback = null;
  function openConfirmDialog({title, message, confirmText = 'Підтвердити', onConfirm}) {
    if (!editDialog || typeof editDialog.showModal !== 'function') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(message)) onConfirm();
      } else {
        onConfirm();
      }
      return;
    }
    confirmCallback = onConfirm;
    editDialog.innerHTML = `<div class="dialog-header"><h2 id="edit-title">${esc(title)}</h2><button class="icon-button" type="button" data-action="close-edit" aria-label="Закрити">${icon('close')}</button></div><div class="dialog-body"><p class="delete-description">${esc(message)}</p></div><div class="dialog-footer"><button class="button secondary" type="button" data-action="close-edit">Скасувати</button><button class="button primary" type="button" data-action="confirm-action">${esc(confirmText)}</button></div>`;
    editDialog.showModal();
    editDialog.querySelector('[data-action="confirm-action"]')?.focus();
  }

  function openEdit(type, targetId) {
    const [verb,kind] = type.split('-');
    const equipment = kind === 'equipment' ? workspace.equipment.find(item => item.id === targetId) : currentEquipment;
    const node = kind === 'node' ? currentEquipment.nodes.find(item => item.id === targetId) : null;
    const folder = kind === 'folder' ? foldersById.get(targetId) : null;
    const item = folder || node || equipment;
    editContext = { type, equipment, node, folder };
    const deleting = verb === 'delete';
    const moving = verb === 'move';
    const noun = {folder:'папку',equipment:'обладнання',node:'вузол'}[kind];
    const title = `${{new:'Створити',edit:kind === 'equipment' ? 'Редагувати' : 'Перейменувати',move:'Перемістити',delete:'Видалити'}[verb]} ${noun}${deleting ? '?' : ''}`;
    let body;
    let blocked = false;
    if (moving) {
      const parentId = kind === 'folder' ? folder.parentId : equipment.folderId ?? null;
      const destinations = workspace.folders.map(candidate => ({id:candidate.id,path:folderPath(candidate)}))
        .filter(candidate => !folder || !candidate.path.includes(folder))
        .map(candidate => ({id:candidate.id,label:candidate.path.map(part => part.name).join(' / ')}))
        .sort((a,b) => a.label.localeCompare(b.label,'uk',{numeric:true}));
      destinations.unshift({id:null,label:'Робочий стіл'});
      const options = destinations.filter(candidate => candidate.id !== parentId);
      blocked = !options.length;
      body = `<p class="edit-subject">${esc(item.name)}</p>${blocked ? '<p>Спочатку створіть папку призначення.</p>' : `<div class="field"><label for="edit-destination">Куди перемістити</label><select id="edit-destination" name="destination">${options.map(option => `<option value="${option.id || ''}">${esc(option.label)}</option>`).join('')}</select></div>`}`;
    } else if (deleting) {
      blocked = kind === 'folder' && folderHasContents(folder.id);
      body = blocked ? `<p>Папка «${esc(folder.name)}» містить обладнання або вкладені папки. Перемістіть їх перед видаленням.</p>`
        : `<p class="delete-description">«${esc(item.name)}»${kind === 'equipment' && equipment.nodes.length ? ` та всі його вузли (${equipment.nodes.length})` : ''} буде видалено з робочого простору.</p>`;
    } else {
      const label = {folder:'Назва папки',equipment:'Назва обладнання',node:'Назва вузла'}[kind];
      const example = {folder:'Наприклад, ХАЕС',equipment:'Наприклад, насос 600В-1,6/100',node:'Наприклад, кришка — корпус'}[kind];
      body = `<div class="field"><label for="edit-name">${label}</label><input id="edit-name" name="name" required maxlength="120" value="${esc(verb === 'new' ? '' : item.name)}" placeholder="${example}" autocomplete="off"></div>`;
      if (kind === 'equipment') body += `<div class="field"><label for="edit-designation">Позначення / позиція (необов’язково)</label><input id="edit-designation" name="designation" maxlength="120" value="${esc(equipment?.designation)}" placeholder="Наприклад, Н-101" autocomplete="off"></div>`;

    }
    editDialog.innerHTML = `<form id="edit-form"><div class="dialog-header"><h2 id="edit-title">${title}</h2><button class="icon-button" type="button" data-action="close-edit" aria-label="Закрити">${icon('close')}</button></div><div class="dialog-body">${body}<p class="dialog-error" id="edit-error" role="alert" hidden></p></div><div class="dialog-footer"><button class="button secondary" type="button" data-action="close-edit">${blocked ? 'Закрити' : 'Скасувати'}</button>${blocked ? '' : `<button class="button ${deleting ? 'danger' : 'primary'}" type="submit">${{delete:'Видалити',new:'Створити',edit:'Зберегти',move:'Перемістити'}[verb]}</button>`}</div></form>`;
    editDialog.showModal();
    if (deleting || blocked) editDialog.querySelector('[data-action="close-edit"]').focus();
    else document.querySelector(moving ? '#edit-destination' : '#edit-name').focus();
  }
  editDialog.addEventListener('submit', event => {
    event.preventDefault();
    const { type, equipment, node, folder } = editContext;
    const form = new FormData(event.target);
    const name = String(form.get('name') || '').trim();
    if ((type.startsWith('new') || type.startsWith('edit')) && !name) {
      document.querySelector('#edit-error').textContent = 'Вкажіть назву.';
      document.querySelector('#edit-error').hidden = false;
      return;
    }
    let nextHash;
    if (type.startsWith('move-')) {
      if (!form.has('destination')) return;
      const destination = form.get('destination') || null;
      if (destination && !foldersById.has(destination)) return;
      if (folder) {
        if (!moveFolder(folder,destination)) return;
      } else {
        equipment.folderId = destination;
        equipment.updatedAt = C.timestamp();
      }
      nextHash = destination ? `folder/${destination}` : '';
    } else if (type === 'new-folder') {
      const created = {id:C.id(),name,parentId:currentFolder?.id ?? null,updatedAt:C.timestamp()};
      workspace.folders.push(created);
      nextHash = `folder/${created.id}`;
    } else if (type === 'edit-folder') {
      folder.name = name;
      folder.updatedAt = C.timestamp();
    } else if (type === 'delete-folder') {
      if (folderHasContents(folder.id)) return;
      workspace.folders = workspace.folders.filter(item => item.id !== folder.id);
    } else if (type === 'new-equipment') {
      const created = C.createEquipment(name,String(form.get('designation') || ''));
      created.folderId = currentFolder?.id ?? null;
      workspace.equipment.push(created);
      nextHash = `equipment/${created.id}`;
    } else if (type === 'edit-equipment') {
      equipment.name = name;
      equipment.designation = String(form.get('designation') || '').trim();
      equipment.updatedAt = C.timestamp();
    } else if (type === 'delete-equipment') {
      workspace.equipment = workspace.equipment.filter(item => item.id !== equipment.id);
    } else if (type === 'new-node') {
      const created = C.createNode(name);
      created.fastener.engagement = '';
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
  editDialog.addEventListener('close', () => { confirmCallback = null; });

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

  function canMoveFolder(folder,destination) {
    return folder && destination !== folder.parentId && (destination === null ||
      (foldersById.has(destination) && !folderPath(foldersById.get(destination)).includes(folder)));
  }
  function moveFolder(folder,destination) {
    if (!canMoveFolder(folder,destination)) return false;
    folder.parentId = destination;
    folder.updatedAt = C.timestamp();
    return true;
  }
  function markDropCard(card) {
    if (dropCard === card) return;
    dropCard?.classList.remove('drop-target');
    dropCard = card;
    dropCard?.classList.add('drop-target');
  }
  function endFolderDrag() {
    draggedFolder = null;
    markDropCard(null);
  }
  main.addEventListener('dragstart', event => {
    const button = event.target.closest('[draggable="true"][data-action="open-folder"]');
    if (!button) return;
    draggedFolder = foldersById.get(button.dataset.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-flange-folder',button.dataset.id);
  });
  main.addEventListener('dragover', event => {
    if (!draggedFolder) return;
    const card = event.target.closest('[data-folder-id]');
    const allowed = card && canMoveFolder(draggedFolder,card.dataset.folderId);
    markDropCard(allowed ? card : null);
    if (allowed) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  });
  main.addEventListener('dragleave', event => {
    if (dropCard?.contains(event.target) && !dropCard.contains(event.relatedTarget)) markDropCard(null);
  });
  main.addEventListener('dragend',endFolderDrag);
  main.addEventListener('drop', event => {
    const card = event.target.closest('[data-folder-id]');
    const folder = draggedFolder;
    endFolderDrag();
    if (!folder || !card || event.dataTransfer.getData('application/x-flange-folder') !== folder.id) return;
    event.preventDefault();
    if (!moveFolder(folder,card.dataset.folderId)) return;
    save();
    renderDesktopContent();
    if (!saveFailed) toast(`«${folder.name}» переміщено в «${foldersById.get(folder.parentId).name}».`);
  });

  document.addEventListener('click', event => {
    if (event.target.matches?.('.skip-link')) {
      event.preventDefault();
      main.focus();
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'open-standards') navigate('standards');
    else if (action === 'open-flange-picker') {
      const node = currentNode;
      if (node?.connection.kind !== 'flange-flange' && !(node?.connection.kind === 'flange-cover' && button.dataset.side === 'sideA')) return;
      const opened = window.FlangePicker?.openPicker({
        node, side: button.dataset.side,
        isCurrent: () => currentNode === node,
        onApplied: (result, target) => {
          if (target !== 'both') connectionSide = target;
          connectionDimension = '';
          changed();
          renderEditor(true);
          const side = target === 'both' ? button.dataset.side : target;
          main.querySelector(`[data-action="open-flange-picker"][data-side="${side}"]`)?.focus();
          toast(`Розміри з каталогу перенесено. Заповнено полів: ${result.count}.`);
        }
      });
      if (!opened) toast('Каталог фланців недоступний. Перевірте файли поряд з анкетою.');
    }
    else if (action === 'editor-step') selectEditorStep(button.dataset.step);
    else if (action === 'nut-view') {
      previewNut = button.dataset.nut;
      focusInput(previewNut+'.standardId');
    }
    else if (action === 'align-fastener') {
      setFastenerArrangement(C.mounting(currentNode).bolt,currentNode.connection.kind === 'body-cover');
      changed(); renderEditor(true);
    }
    else if (action === 'connection-side') {
      selectConnectionSide(button.dataset.side);
    }
    else if (action === 'copy-connection-side') {
      const source = button.dataset.side, target = source === 'sideA' ? 'sideB' : 'sideA';
      const sourceLetter = source === 'sideA' ? 'А' : 'Б';
      const targetLetter = target === 'sideA' ? 'А' : 'Б';
      openConfirmDialog({
        title: 'Підтвердження копіювання',
        message: `Замінити матеріал і геометричні розміри деталі ${targetLetter} параметрами деталі ${sourceLetter}? Введені дані деталі ${targetLetter} будуть перезаписані.`,
        confirmText: 'Скопіювати',
        onConfirm: () => {
          const name = currentNode.connection[target].name;
          currentNode.connection[target] = {...structuredClone(currentNode.connection[source]), name};
          currentNode.flanges[target] = structuredClone(currentNode.flanges[source]);
          connectionSide = target;
          connectionDimension = '';
          changed(); renderEditor(true);
          main.querySelector(`#tab-${target}`)?.focus();
          toast(`Параметри деталі ${sourceLetter} скопійовано в деталь ${targetLetter}.`);
        }
      });
    }
    else if (action === 'editor-next' || action === 'editor-previous') {
      const steps = visibleSteps();
      selectEditorStep(steps[steps.indexOf(editorStep)+(action === 'editor-next' ? 1 : -1)]);
    }
    else if (action === 'focus-input') {
      if (fileDialog.open) fileDialog.close();
      if (currentNode?.id === button.dataset.id) focusInput(button.dataset.path);
      else if (currentEquipment?.nodes.some(node => node.id === button.dataset.id)) {
        pendingField = {nodeId:button.dataset.id,path:button.dataset.path};
        navigate(`node/${currentEquipment.id}/${pendingField.nodeId}`);
      }
    }
    else if (action === 'first-input-error') {
      const input = document.querySelector('[data-field][aria-invalid="true"]');
      if (input) focusInput(input.dataset.field);
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
    else if (action === 'apply-standard-torque') {
      const std = C.standardTorque(standardsDb, currentNode.fastener.nominalDiameter);
      if (std) {
        currentNode.fastener.targetTorqueMinNm = String(std.minNm);
        currentNode.fastener.targetTorqueMaxNm = String(std.maxNm);
        changed(); updateStatuses(); refreshResults(); renderEditor(true);
      }
    }
    else if (action === 'home') navigate();
    else if (action === 'open-folder') navigate(`folder/${button.dataset.id}`);
    else if (action === 'open-equipment') navigate(`equipment/${button.dataset.id}`);
    else if (action === 'open-node') navigate(`node/${currentEquipment.id}/${button.dataset.id}`);
    else if (['new-folder','edit-folder','delete-folder','move-folder','move-equipment','new-equipment','new-node','edit-equipment','edit-node','delete-equipment','delete-node'].includes(action)) openEdit(action,button.dataset.id);
    else if (action === 'confirm-action') {
      if (typeof editDialog.close === 'function') editDialog.close();
      if (confirmCallback) {
        const cb = confirmCallback;
        confirmCallback = null;
        cb();
      }
    }
    else if (action === 'close-edit') {
      confirmCallback = null;
      if (typeof editDialog.close === 'function') editDialog.close();
    }
    else if (action === 'copy-node') {
      const source = currentEquipment.nodes.find(node => node.id === button.dataset.id);
      const clone = JSON.parse(JSON.stringify(source));
      clone.id = C.id(); clone.name = `${source.name} (копія)`; clone.createdAt = clone.updatedAt = C.timestamp();
      clone.extras.forEach(item => { item.id = C.id(); });
      currentEquipment.nodes.push(clone); currentEquipment.updatedAt = C.timestamp();
      save(); renderDesktop();
      const searchEl = document.querySelector('#workspace-search');
      if (searchEl) searchEl.value = searchText;
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
      link.download = 'prokladky-recovery.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href),60000);
    } else if (action === 'reset' && window.confirm('Завантажте збережені дані перед скиданням. Створити порожній робочий простір?')) {
      try { localStorage.removeItem(STORAGE_KEY); location.reload(); }
      catch (error) { toast('Браузер не дозволяє змінити збережені дані.'); }
    }
  });
  document.addEventListener('input', event => {
    const input = event.target;
    if (input.matches?.('[data-list-search]')) { searchText = input.value; renderDesktopContent(); return; }
    if (input.id === 'material-search') { picker.query = input.value; updateMaterialList(); return; }
    if (input.dataset.excelTorque !== undefined) { input.dataset.rawValue = input.value; return; }
    if (!currentNode || !input.dataset.field || input.type === 'checkbox' || input.tagName === 'SELECT') return;
    if (input.dataset.number && input.value.includes('.')) {
      const start = input.selectionStart, end = input.selectionEnd;
      input.value = input.value.replaceAll('.', ',');
      if (start !== null && end !== null) input.setSelectionRange(start, end);
    }
    if (input.dataset.pressureKey) {
      const key = input.dataset.pressureKey;
      const unit = getPressureUnit(key);
      const mpa = convertUnitToMpa(input.value, unit);
      C.set(currentNode, input.dataset.field, mpa);
      input.dataset.rawValue = input.value;
    } else {
      C.set(currentNode,input.dataset.field,input.value);
    }
    changed();
    scheduleCalculationUpdate();
  });
  document.addEventListener('change', event => {
    const input = event.target;
    flushCalculationUpdate();
    if (input.dataset.pressureUnit) {
      const key = input.dataset.pressureUnit;
      const newUnit = input.value;
      if (currentNode?.operating?.[key]) {
        currentNode.operating[key].pressureUnit = newUnit;
        const mpa = currentNode.operating[key].pressure;
        const converted = convertMpaToUnit(mpa, newUnit);
        const pressureInput = document.querySelector(`[data-pressure-key="${key}"]`);
        if (pressureInput) {
          pressureInput.value = displayInputNumber(converted);
          pressureInput.dataset.rawValue = editableNumber(converted);
        }
        changed();
        updateStatuses();
        refreshResults();
      }
      return;
    }
    if (input.matches?.('[data-list-sort]')) { sortBy = input.value; renderDesktopContent(); return; }
    if (input.id === 'material-select') { picker.materialIndex = Number(input.value); picker.gradeIndex = 0; renderGradePicker(); return; }
    if (currentNode && input.dataset.field === 'fastener.nominalDiameter') {
      const oldStd = C.standardTorque(standardsDb,currentNode.fastener.nominalDiameter);
      const isAuto = (!currentNode.fastener.targetTorqueMinNm && !currentNode.fastener.targetTorqueMaxNm) ||
        (oldStd && Number(currentNode.fastener.targetTorqueMinNm) === oldStd.minNm && Number(currentNode.fastener.targetTorqueMaxNm) === oldStd.maxNm);
      currentNode.fastener.nominalDiameter = input.value;
      currentNode.fastener.pitch = '';
      currentNode.nut.threadedHeight = '';
      if (currentNode.nutB) currentNode.nutB.threadedHeight = '';
      const numD = Number(input.value);
      if (numD > 48) {
        if (currentNode.nut?.standardId === 'gost-5915-70') currentNode.nut.standardId = 'gost-9064-75';
        if (currentNode.nutB?.standardId === 'gost-5915-70') currentNode.nutB.standardId = 'gost-9064-75';
      }
      const newStd = C.standardTorque(standardsDb,input.value);
      if (newStd && isAuto) {
        currentNode.fastener.targetTorqueMinNm = String(newStd.minNm);
        currentNode.fastener.targetTorqueMaxNm = String(newStd.maxNm);
      }
      changed(); renderEditor(true); return;
    }
    if (currentNode && input.dataset.scheme) {
      const mount = C.mounting(currentNode);
      const bolt = input.dataset.scheme === 'fastener' ? input.value === 'bolt' : mount.bolt;
      const tapped = currentNode.connection.kind === 'custom'
        ? (input.dataset.scheme === 'mounting' ? input.value === 'body' : Boolean(mount.body))
        : currentNode.connection.kind === 'body-cover';
      setFastenerArrangement(bolt,tapped);
      changed(); renderEditor(true); return;
    }
    if (!currentNode || !input.dataset.field || (input.tagName !== 'SELECT' && input.type !== 'checkbox')) return;
    if (input.dataset.field === 'connection.kind') {
      const old = currentNode.connection.kind;
      const namesByKind = {
        'flange-flange': ['Фланець 1','Фланець 2'],
        'flange-cover': ['Фланець','Кришка'],
        'body-cover': ['Кришка','Корпус'],
        'custom': ['Деталь А','Деталь Б']
      };
      const previous = namesByKind[old] || ['Деталь А','Деталь Б'];
      const next = namesByKind[input.value] || ['Деталь А','Деталь Б'];
      ['sideA','sideB'].forEach((side,index) => { if (currentNode.connection[side].name === previous[index]) currentNode.connection[side].name = next[index]; });
    }
    if (input.dataset.field === 'fastener.differentNuts' && input.checked) currentNode.nutB ??= structuredClone(currentNode.nut);
    if (input.dataset.field === 'fastener.differentNuts') previewNut = input.checked ? 'nutB' : 'nut';
    if (input.dataset.field.startsWith('nut.') || input.dataset.field.startsWith('nutB.')) previewNut = input.dataset.field.split('.')[0];
    if (input.dataset.field === 'fastener.reversed') {
      const placement = currentNode.washers.placement;
      if (placement === 'a' || placement === 'b') currentNode.washers.placement = placement === 'a' ? 'b' : 'a';
    }
    C.set(currentNode,input.dataset.field,input.type === 'checkbox' ? input.checked : input.value);
    if (input.dataset.field === 'connection.kind' && input.value !== 'custom') {
      setFastenerArrangement(C.mounting(currentNode).bolt,input.value === 'body-cover');
    }
    if (/^flanges\.(sideA|sideB)\.form$/.test(input.dataset.field)) {
      const [,side] = input.dataset.field.split('.');
      const flange = currentNode.flanges[side];
      if (input.value === 'flat') flange.coneHeight = '0';
      else if (!(C.number(flange.coneHeight) > 0)) flange.coneHeight = '';
      connectionDimension = '';
    }
    if (input.dataset.field === 'fastener.threadStandardId') currentNode.fastener.pitch = '';
    if (['nut.standardId','nut.typeId'].includes(input.dataset.field)) currentNode.nut.threadedHeight = '';
    if (input.dataset.field === 'nut.standardId') currentNode.nut.typeId = 'A';
    if (['nutB.standardId','nutB.typeId'].includes(input.dataset.field)) currentNode.nutB.threadedHeight = '';
    if (input.dataset.field === 'nutB.standardId') currentNode.nutB.typeId = 'A';
    if (input.dataset.field === 'washers.standardId') {
      const selection = currentNode.washers;
      const executions = standardsDb.washers[selection.standardId]?.executions;
      if (executions) {
        if (!executions[selection.execution]) selection.execution = Object.keys(executions)[0];
        const classes = executions[selection.execution];
        if (!classes.includes(selection.accuracyClass)) selection.accuracyClass = classes[0];
      }
    }
    // Execution 2 exists only for class A; keep selections compatible.
    if (input.dataset.field === 'washers.execution' && input.value === '2') currentNode.washers.accuracyClass = 'A';
    if (input.dataset.field === 'washers.accuracyClass' && input.value === 'C') currentNode.washers.execution = '1';
    changed(); renderEditor(true);
  });
  document.addEventListener('focusin',event => {
    const input = event.target;
    const path = input.dataset.field || input.dataset.path || '';
    if (input.dataset.excelTorque !== undefined) input.value = editableNumber(input.dataset.rawValue);
    if (currentNode && input.dataset.number && !input.readOnly) {
      if (input.dataset.pressureKey) {
        const key = input.dataset.pressureKey;
        const unit = getPressureUnit(key);
        const converted = convertMpaToUnit(C.get(currentNode, path), unit);
        input.value = editableNumber(converted);
      } else {
        input.value = editableNumber(C.get(currentNode,path));
      }
    }
    if ((input.dataset.number || input.dataset.excelTorque !== undefined || input.inputMode === 'decimal' || input.type === 'number') && !input.readOnly) {
      if (typeof input.select === 'function') input.select();
    }
    if (currentNode && editorStep === 'nut' && (path.startsWith('nut.') || path.startsWith('nutB.'))) {
      const key = path.split('.')[0];
      if (previewNut !== key) {previewNut = key; refreshComponentPreview();}
    }
    if (!currentNode || editorStep !== 'connection' || !event.target.closest('[data-connection-side]')) return;
    connectionDimension = event.target.dataset.field || '';
    refreshComponentPreview();
  });
  document.addEventListener('focusout',event => {
    const input = event.target;
    flushCalculationUpdate();
    if (!input.isConnected) return;
    if (input.dataset.excelTorque !== undefined) input.value = displayInputNumber(input.dataset.rawValue);
    if (!currentNode || !input.dataset.field) return;
    if (input.dataset.number) {
      if (input.dataset.pressureKey) {
        const key = input.dataset.pressureKey;
        const unit = getPressureUnit(key);
        const converted = convertMpaToUnit(C.get(currentNode, input.dataset.field), unit);
        input.value = displayInputNumber(converted);
      } else {
        input.value = displayInputNumber(C.get(currentNode,input.dataset.field));
      }
    }
    updateValidation();
  });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-action="connection-side"]');
    if (tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      const side = event.key === 'Home' ? 'sideA' : event.key === 'End' ? 'sideB' : connectionSide === 'sideA' ? 'sideB' : 'sideA';
      selectConnectionSide(side);
      main.querySelector(`#tab-${side}`).focus();
      return;
    }
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
