# Довідник стандартів у «Прокладках» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Додати до робочого простору автономний довідник шести категорій з пошуком, таблицями, кресленнями та джерелами.

**Architecture:** Головний `app.js` додає гілку до чинної навігації з `#` і передає основну область контролеру довідника. Контролер читає один адаптер подання, а таблиця й креслення використовують один і той самий вибраний запис. Адаптер читає два чинні комплекти каталожних даних.

**Tech Stack:** Звичайні скрипти браузера з `defer`, HTML, чинні CSS-токени застосунку, SVG, Node.js `assert`, `vm` і `node:test`.

**Spec:** [Погоджена специфікація](../specs/2026-11-19-standards-reference-design.md).

## Global Constraints

- «Інтерфейс розрахований на настільні ПК й ноутбуки».
- «Навігація, каталоги та креслення працюють з `file://` без сервера й мережі».
- «Довідник призначений для перегляду. Вибір типорозміру в ньому не записує дані до анкети».
- «Табличні значення відображаються в тому вигляді, у якому їх містить каталог».
- «Довідник читає ті самі 925 позицій фланців, що й селектор».
- «`node scripts/check.cjs` завершується без помилок, із нульовими розбіжностями в чинній звірці контрольних клітинок Excel». Окремі чинні очікування для вузла №4 зберігаються.

## Review Focus

- Шайба М33, виконання 1, клас C має порожній `d₁`. Таблиця показує тире, картка пояснює відсутність ескізу. Завдання 1, 3 і 4.
- Зміна анкети без очікування автозбереження має бути доступна після переходу до довідника й повернення. Завдання 4.
- Ущільнювальна поверхня може зникнути після зміни DN або PN. Список і креслення оновлюються за дійсною комбінацією. Завдання 2 і 4.
- Той самий номер стандарту може бути введений з іншим дефісом і без префікса «ГОСТ». Невірний маршрут має показати категорії. Завдання 1 і 4.
- Таблиця з кількома інженерними колонками має зберігати читабельність на ноутбуці. Завдання 5.

## Файли

| Файл | Відповідальність |
| --- | --- |
| `standards-base/src/catalog-adapter.js` | Наявна нормалізація кріплення і різьб, індекс довідника, подання прокладок та моментів. |
| `standards-base/src/flange-reference.js` | Дані й фільтри карток фланців, зв’язок з 12815-80 і 12816-80 та походження полів. |
| `standards-base/src/drawing-engine.js`, `standards-base/src/drawing-templates.js` | Спільне оформлення SVG, перевірка достатності розмірів, профіль гайки типу Б та вибраний крок різьби. |
| `component-imported-styles.js` | Чинна геометрія гайки з можливістю явно передати профіль вибраного запису. |
| `flange-picker-drawing.js` | Чинна схема фланця з можливістю позначати походження підписаних розмірів. |
| `index.html`, `app.js` | Кнопка в шапці, збереження, розпізнавання маршруту довідника та повернення до чинних екранів. |
| `standards-base/src/app.js`, `standards-base/styles.css` | Контролер вбудованого екрана й локальні стилі таблиці, фільтрів та ескізу. |
| `standards-base/index.html` | Перехід зі старої адреси до `../index.html#standards`. |
| `tests/standards-reference.test.cjs`, `tests/app-files.cjs`, `tests/standards-base.test.cjs`, `tests/standards-base-assets.test.cjs`, `tests/flange-picker.cjs` | Перевірки даних, геометрії, маршруту, підключення файлів і сумісності селектора. `scripts/check.cjs` автоматично запускає файли `tests/*.cjs`. |

## Завдання 1. Індекс довідника й таблиці кріплення, різьб, прокладок і моментів

**Файли:** `standards-base/src/catalog-adapter.js`, `tests/standards-reference.test.cjs`, `tests/standards-base.test.cjs`.

**Інтерфейс.** `StandardsCatalogAdapter.listReferenceCategories()` повертає `{ id, title }[]` з ID `nuts`, `washers`, `threads`, `flanges`, `gaskets`, `torques` у цьому порядку. `listReferenceEntries(db, flangeEntries)` повертає `{ id, categoryId, document, title, range, aliases }[]`, де `range` є рядком або `null`. `searchReferenceEntries(entries, query)` повертає записи, що збігаються за номером або назвою. `getReferenceCard(db, id, filters = {})` повертає `null` для невідомого ID або `{ entry, filters, tables, drawingKind, sources, notes }`. Фільтр має поля `{ key, label, value, options }`. `options` є масивом `{ value, label }` або `null` для текстового поля. Таблиця має `{ id, title, columns, rows }`, колонки `{ key, label, unit }`, а рядок — стабільний `id` і типізовані значення за ключами колонок. `sources` містить об’єкти з полем `label` та відомими метаданими `url`, `kind`, `documentId`, `edition`, `section`. `notes` містить рядки. `drawingKind` є одним із `hex_nut`, `capped_nut`, `washer`, `spring_washer`, `thread`, `flange` або `null`.

- [ ] **Написати тести індексу та таблиць.** Використати реальні JSON або об’єкт, зчитаний з `standards.bundle.js` у `vm`. Додати до `tests/standards-reference.test.cjs` такі перевірки.

  ```js
  assert.deepEqual(categories.map(category => category.id),
    ['nuts', 'washers', 'threads', 'flanges', 'gaskets', 'torques']);
  assert.equal(entries.filter(entry => entry.categoryId === 'nuts').length, 5);
  assert.equal(searchReferenceEntries(entries, '9064–75')[0].id, 'gost-9064-75');
  assert.equal(searchReferenceEntries(entries, '  ГОСТ 9064-75  ')[0].id, 'gost-9064-75');
  assert.ok(searchReferenceEntries(entries, 'графітові').some(entry => entry.id === 'graphite-annex-b1-b2-unidentified'));
  assert.deepEqual([nut24B.bodyDiameterMm, nut24B.headHeightMm, nut24B.boreDepthMm], [40, 16, 40]);
  assert.equal(washer24A.innerDiameterMm, 25);
  assert.equal(washer24C.innerDiameterMm, 26);
  assert.equal(washer33C.innerDiameterMm, null);
  assert.deepEqual(execution2ClassOptions.map(option => option.value), ['A']);
  assert.deepEqual(thread24.pitchesMm, [3, 2, 1.5, 1, 0.75]);
  assert.deepEqual([torque24.minNm, torque24.maxNm, torque24.minKgfM, torque24.maxKgfM], [320, 360, 32, 36]);
  assert.equal(gasketExpansion400.value, 1.61);
  ```

  Перевірити також `gasket.sources` на `documentId: null` і `torque.sources` на `kind: 'user_supplied_table'`.
- [ ] **Запустити новий тест.** `node tests/standards-reference.test.cjs` має падати на відсутньому API чи нових даних картки.
- [ ] **Реалізувати API в адаптері.** Повторно використати `getStandardDetails`, `getTableData` і `filterRows` для наявних категорій. Розгорнути `capProfile` лише для типу Б і взяти варіанти виконання шайб із джерела. Для явного `null` не підставляти інший клас. Визначати діапазони з фактичних рядків. Для графітових прокладок створити таблиці властивостей, груп середовищ і температурних значень з одиницями `МПа`, `°C` і `10⁻⁶/°C`; включити правило вибору температури як примітку. Для моментів залишити в картці чотири числові колонки в `Н·м` і `кгс·м`. Нормалізувати регістр, пробіли та види дефіса в пошуку.
- [ ] **Перевірити.** `node tests/standards-reference.test.cjs` та `node tests/standards-base.test.cjs` проходять.
- [ ] **Закомітити** адаптер та його тести з повідомленням `feat: expose digitized standards for the reference`.

## Завдання 2. Картки фланців і походження даних

**Файли:** створити `standards-base/src/flange-reference.js`, доповнити `tests/standards-reference.test.cjs`.

**Інтерфейс.** `StandardsFlangeReference.listEntries(catalog)` повертає записи для індексу з ID `gost-12820-80`, `gost-12821-80`, `gost-12815-80`, `gost-12816-80`. `getCard(catalog, id, filters = {}, selectedId = null)` повертає картку узгодженої форми із завдання 1 та додатковими `selectedRow`, `face` і `dimensionOrigins`. `selectedRow` є посиланням на початковий рядок `catalog.rows` або `null`; `face` є доступним номером поверхні в цьому рядку або `null`. `dimensionOrigins` передає відоме походження за ключем розміру, зокрема ознаку `calculated` для величини, отриманої за чинним правилом. Для довідкових карток 12815-80 і 12816-80 `drawingKind` дорівнює `null`.

- [ ] **Додати тести реального комплекту.** Після завантаження `flange-catalog.bundle.js` зіставити об’єднані ID карток 12820 та 12821 з усіма `catalog.rows`, перевірити довжину 925 та відсутність дублікатів. Для `12820:0.1:600:-:1` і поверхні 4 перевірити `D3` у таблиці та обидва джерельні значення.

  ```js
  assert.equal(card.selectedRow.id, '12820:0.1:600:-:1');
  assert.equal(card.selectedRow.faces[card.face].D3, 631);
  assert.equal(card.selectedRow.differences.D3.kompas, 531);
  assert.equal(card.selectedRow.differences.D3.standard, '12815');
  assert.notEqual(neckCard.face, '999');
  assert.ok(Object.hasOwn(neckCard.selectedRow.faces, neckCard.face));
  ```

  У тесті `neckCard` задати 12821, `dn: 50`, `pressure: 0.1`, `face: '999'` і ID попереднього плоского фланця. Перевірити коректний вибір нового рядка, редакції 12815-80/12816-80, правило п. 1.9 і результати пошуку для обох джерел. Значення `D3` у табличному поданні має дорівнювати 631 та мати походження з ГОСТ.
- [ ] **Запустити тест.** `node tests/standards-reference.test.cjs` має падати на відсутньому `StandardsFlangeReference`.
- [ ] **Реалізувати картки.** Брати DN, PN, ряд і варіант під трубу з `catalog.rows`; обмежити номери поверхонь ключами `selectedRow.faces`. Черговість фільтрів `dn`, `pressure`, `series`, `pipe`, `face`. При зміні попереднього фільтра очистити несумісний вибір наступного; дійсний вибір зберігати. Для карток джерел використати редакції й ролі з `docs/superpowers/specs/2026-11-17-gost-flange-catalog-design.md`, відомі `refs`, `differences`, `corrections`, `notes` і `catalog.sources`. Для 12816-80 пояснити чинне правило щодо товщини, а для 12815-80 показати посилання на конструктивні картки. Для основних карток формувати розміри з `row.dimensions` і вибраної `row.faces[face]`, з окремими одиницями для кількості отворів і різьби. Класифікувати розраховане походження лише за наявного запису або чинного правила обчислення.
- [ ] **Перевірити.** `node tests/standards-reference.test.cjs` і `node tests/flange-picker.cjs` проходять.
- [ ] **Закомітити** картки та тести з повідомленням `feat: add flange reference cards and sources`.

## Завдання 3. Креслення за дійсними розмірами

**Файли:** `standards-base/src/drawing-engine.js`, `standards-base/src/drawing-templates.js`, `component-imported-styles.js`, `flange-picker-drawing.js`, `tests/standards-base.test.cjs`, `tests/standards-reference.test.cjs`, `tests/flange-picker.cjs`.

**Інтерфейс.** `StandardsDrawingEngine.renderReference({ standardId, type, row, pitchMm, execution, accuracyClass })` повертає `{ svg, callout }` або `null` за недостатньої геометрії. `FlangePickerDrawing.drawCandidate(row, face, active, dimensionOrigins)` зберігає чинні аргументи. Четвертий аргумент необов’язковий і підтримує прапорець `calculated` за ключем розміру.

- [ ] **Додати тести SVG.** Для М24 типу Б завантажити профіль `PassportProfiles` і рушій креслень у спільному браузерному `vm`, як у `tests/component-graphics.cjs` та `tests/standards-base.test.cjs`. Перевірити три підписи в міліметрах і розріз із глухим отвором. Для типу А перевірити висоту 24 мм і контур наскрізної гайки. Для шайби М33 класу C перевірити `renderReference(...) === null`. Для М24 ГОСТ 24705-2004 подати `pitchMm: 1.5` і перевірити, що підпис і SVG відрізняються від варіанта з кроком 3 мм. Для фланця перевірити на синтетичній ознаці `b: { calculated: true }`, що підпис існуючого розміру містить «Розраховано» тільки коли ознаку передано.

  ```js
  assert.match(capDrawing.svg, /діаметр корпусу[\s\S]*?40\s*мм/i);
  assert.match(capDrawing.svg, /висота головки[\s\S]*?16\s*мм/i);
  assert.match(capDrawing.svg, /глибина (?:глухого )?отвору[\s\S]*?40\s*мм/i);
  assert.doesNotMatch(capDrawing.svg, /NaN|undefined/);
  assert.notEqual(fineThread.svg, coarseThread.svg);
  assert.match(fineThread.callout, /1[,.]5/);
  ```

  У тесті приймати інженерні символи в підписі, якщо відповідний параметр та одиниця однозначно підписані в SVG для читачів і в доступній назві.
- [ ] **Запустити тести.** `node tests/standards-reference.test.cjs` і `node tests/flange-picker.cjs` мають показати відсутній метод або підпис походження.
- [ ] **Реалізувати ескізи.** Перед викликом наявного `render` перевіряти наявність необхідних розмірів, оскільки він має демонстраційні значення за замовчуванням. Для геометрії типу Б повторно використати `PassportProfiles.buildHexNutMetrics` та профіль із `component-imported-styles.js`. Передавати `spec.capProfile` із вибраного рядка, залишивши пошук у каталозі за діаметром для чинних викликів без цього параметра. Позначити три розміри через чинні SVG-функції. За відсутнього `capProfile` `renderReference` повертає `null`. У шаблоні різьби використати вибраний крок для профілю, підпису й позначення, а великий крок зберегти в даних таблиці. Для фланця повторно використати `drawCandidate` та її три наявні проєкції. Позначку походження передавати до конкретної розмірної лінії. Чинні виклики селектора працюють із трьома аргументами.
- [ ] **Перевірити.** `node tests/standards-reference.test.cjs`, `node tests/standards-base.test.cjs`, `node tests/flange-picker.cjs` і `node --test tests/component-graphics.cjs` проходять. Зберегти числові перевірки раніше оцифрованих типорозмірів.
- [ ] **Закомітити** зміни з повідомленням `feat: render reference drawings from the selected dimensions`.

## Завдання 4. Навігація та вбудований екран

**Файли:** `app.js`, `index.html`, `standards-base/src/app.js`, `standards-base/index.html`, `standards-base/styles.css`, `tests/app-files.cjs`, `tests/standards-reference.test.cjs`, `tests/standards-base.test.cjs`, `tests/standards-base-assets.test.cjs`.

**Інтерфейс.** `StandardsReference.render(main, parts, { navigate, toast })` отримує частини маршруту після `standards`, оновлює `main` і повертає заголовок сторінки. Маршрути мають вигляд `#standards`, `#standards/<category>` і `#standards/<category>/<id>`. Для тестів `StandardsReference.resolveRoute(parts, entries)` повертає `{ categoryId, entryId }` із `null` для відсутніх сегментів. `navigate` отримує рядок без початкового `#` і належить головному застосунку. Пошук, фільтри, вибір рядка й поверхні мають керування всередині кореневого елемента довідника.

- [ ] **Написати тести маршрутів та збігу показаних даних.** У VM-стенді `tests/app-files.cjs` відкрити вузол, змінити `gasket.thickness` на `'4'` і натиснути `open-standards` без виконання таймера. Імітувати `hashchange` для довідника, категорії, картки і повернення до вузла. Перевірити збережений JSON, відновлений вузол і його поле.

  ```js
  assert.equal(state.location.hash, '#standards');
  assert.equal(savedNode.gasket.thickness, '4');
  assert.match(state.elements.get('#main').innerHTML, /Кришка/);
  assert.deepEqual(resolveRoute(['unknown'], entries), { categoryId: null, entryId: null });
  assert.deepEqual(resolveRoute(['nuts', 'gost-9064-75'], entries),
    { categoryId: 'nuts', entryId: 'gost-9064-75' });
  ```

  У тесті контролера з тим самим реальним завантаженням каталогів перевірити, що зміна рядка змінює таблицю, ескіз і позначення; для М24 типу Б усі три числа є в обох поданнях. Для М33 класу C перевірити тире й текст про відсутню геометрію. Для фланця перевірити оновлення поверхні після зміни DN/PN. Для порожнього результату перевірити дію скидання. У тестах HTML перевірити єдиний вхід із шапки, локальні `defer`-скрипти та перенаправлення старої адреси; перевірки старої скляної розмітки замінити перевірками нових точок підключення і зберегти тести SVG.
- [ ] **Запустити тести.** `node tests/app-files.cjs` і `node tests/standards-reference.test.cjs` мають падати на нових сценаріях.
- [ ] **Підключити навігацію.** Замість «База стандартів» додати кнопку з `data-action="open-standards"`, яка викликає `navigate('standards')`. У гілці `renderRoute()` передати підмаршрут контролеру, оновити заголовок і шлях навігації. Повернення на маршрут анкети обробляє чинний `hashchange`. Використати `../index.html#standards` у локальному перенаправленні та його звичайному посиланні.
- [ ] **Зібрати екран.** Використати розмітку `#main`, наявні `.button`, стилі полів і таблиць, зі scoped-правилами в `standards-base/styles.css`. Показати категорії, пошук, список з діапазонами, шлях навігації, фільтри, таблицю, джерела, примітки й креслення. Застосувати кнопки для клавіатурного вибору рядка й керування фільтрами. Оновлення рядка не має забирати фокус із поточного контролу. Відображати порожні значення як тире, відсутнє креслення як пояснення, а прокладки й моменти як таблиці з одиницями. Перенести копіювання позначення з резервним способом для локального файла й експорт придатного SVG з наявного контролера. Відображати «Розраховано» біля відповідних значень, а джерельні посилання, редакції та розбіжності — поруч із таблицею. Відокремити CSS для довідника селектором його кореневого елемента.
- [ ] **Перевірити.** `node tests/app-files.cjs`, `node tests/standards-reference.test.cjs`, `node tests/standards-base.test.cjs`, `node tests/standards-base-assets.test.cjs` і `node scripts/check.cjs` проходять. Підтвердити повний сценарій збереження значення до відпрацювання таймера та відсутність запису до анкети від фільтрації у довіднику.
- [ ] **Закомітити** вбудований екран і тести з повідомленням `feat: integrate the standards reference in the workspace`.

## Завдання 5. Приймання на десктопі та ноутбуці

**Файли:** за потреби точкові виправлення в `standards-base/styles.css` та тестах, які відтворюють знайдений дефект.

- [ ] **Перевірити локальний сценарій.** Відкрити кореневий `index.html` як `file://` у справжньому десктопному браузері без мережі. Пройти сценарії приймання 1–4 зі специфікації. Окремо перевірити стару адресу, навігацію клавіатурою, копіювання позначення, відкриття експортованого SVG і відсутність помилок завантаження в консолі.
- [ ] **Перевірити компонування.** На настільному ПК і ноутбуці переглянути М24 типу Б та широку таблицю фланців. Таблиця має власне горизонтальне прокручування за потреби, ескіз не виходить за межі панелі, а розмірні підписи читаються. За браку другого фізичного пристрою відтворити відповідний розмір вікна в десктопному браузері й явно зазначити це у звіті про приймання.
- [ ] **Виправити підтверджені дефекти.** Для помилки в даних або навігації спочатку додати перевірку, що відтворює її. Для компонування повторити перевірку в тому самому браузері й розмірі вікна після зміни CSS.
- [ ] **Повторити повний набір.** `node scripts/check.cjs` має завершитися з кодом 0 і 0 помилок. У звіті підтвердити нуль розбіжностей у порівнюваних контрольних клітинках Excel та окремий чинний результат вузла №4. За наявності виправлень закомітити тільки їх з повідомленням `fix: address standards reference acceptance findings`.
