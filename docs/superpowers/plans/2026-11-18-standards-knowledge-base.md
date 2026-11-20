# Standards Knowledge Base (StandardsBase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Створити автономну базу знань нормативних стандартів кріпильних виробів (`standards-base/`) на основі верифікованих даних `FlangeStandardsDB` із дизайном Modern Engineering Glass 2.0 (`SuperBase`), інтерактивними таблицями розмірів та динамічними 2D-кресленнями з виносними лініями.

**Architecture:** Модульний застосунок на нативному ES6/JS без сторонніх бандлерів і зовнішніх CDN-залежностей. `standards-base/index.html` підключає спільний `../standards.bundle.js` як єдине джерело правди. Модулі `catalog-adapter.js`, `drawing-templates.js`, `drawing-engine.js` та `app.js` забезпечують розділення відповідальності між нормативними даними, кресленнями та інтерфейсом.

**Tech Stack:** Vanilla JavaScript (ES6+), Local Tailwind CSS v3 (`assets/tailwind-local.css`), Modern Engineering Glass 2.0 CSS, SVG Vector Graphics, Node.js CommonJS для тестів (`tests/standards-base.test.cjs`).

**Spec:** [docs/superpowers/specs/2026-11-18-standards-knowledge-base-design.md](file:///d:/%D0%A0%D0%BE%D0%B7%D1%80%D0%BE%D0%B1%D0%BA%D0%B0/%D0%9F%D1%80%D0%BE%D0%BA%D0%BB%D0%B0%D0%B4%D0%BA%D0%B8/docs/superpowers/specs/2026-11-18-standards-knowledge-base-design.md)

## Global Constraints

- Desktop-only інтерфейс для інженерів-розрахунcountчиків (жодної мобільної оптимізації згідно з AGENTS.md).
- Жодної зміни або регресії в існуючих розрахункових файлах (`node scripts/check.cjs` має повертати 0 помилок).
- 100% автономність (жодних запитів до Google Fonts або зовнішніх CDN у робочому режимі).
- Відсутність білого спалаху при завантаженні темної теми (скрипт проти FOUC в `<head>`).

---

### Task 1: Scaffolding директорії, локальні ресурси та стилі Glass 2.0

**Files:**
- Create: `standards-base/assets/tailwind-local.css` (копіювання з `D:\Розробка\SuperBase\assets\tailwind-local.css`)
- Create: `standards-base/assets/favicon.png` (копіювання з `D:\Розробка\SuperBase\favicon.png`)
- Create: `standards-base/styles.css`
- Test: `tests/standards-base-assets.test.cjs`

**Interfaces:**
- Produces: Директорія `standards-base/` з валідними активами стилів та темами креслень (CAD Light / Blueprint Dark).

- [ ] **Step 1: Write test for assets and CSS classes existence**

```javascript
// tests/standards-base-assets.test.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = path.resolve(__dirname, '..', 'standards-base');
assert.ok(fs.existsSync(path.join(baseDir, 'assets', 'tailwind-local.css')), 'tailwind-local.css must exist');
assert.ok(fs.existsSync(path.join(baseDir, 'assets', 'favicon.png')), 'favicon.png must exist');
assert.ok(fs.existsSync(path.join(baseDir, 'styles.css')), 'styles.css must exist');

const cssContent = fs.readFileSync(path.join(baseDir, 'styles.css'), 'utf8');
assert.ok(cssContent.includes('.glass-panel'), 'styles.css must define .glass-panel');
assert.ok(cssContent.includes('.fluent-card'), 'styles.css must define .fluent-card');
assert.ok(cssContent.includes('.cad-canvas'), 'styles.css must define .cad-canvas');
console.log('Task 1 assets test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/standards-base-assets.test.cjs`
Expected: FAIL (директорія або файли ще не існують)

- [ ] **Step 3: Create directory and copy assets, create styles.css**

Копіюємо `tailwind-local.css` та `favicon.png` з `D:\Розробка\SuperBase\assets\`, створюємо `standards-base/styles.css` із базою Glass 2.0, стилями таблиць з липкою шапкою, стилями креслярського полотна (CAD Light / Blueprint Dark).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/standards-base-assets.test.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add standards-base/assets standards-base/styles.css tests/standards-base-assets.test.cjs
git commit -m "feat(standards-base): scaffold directory, assets, and Glass 2.0 styles"
```

---

### Task 2: Нормалізація даних стандартів (`catalog-adapter.js`)

**Files:**
- Create: `standards-base/src/catalog-adapter.js`
- Create: `tests/standards-base.test.cjs`

**Interfaces:**
- Consumes: `globalThis.FlangeStandardsDB` (з `standards.bundle.js`)
- Produces:
  - `StandardsCatalogAdapter.getCategories()`: повертає список категорій `[{ id: 'fasteners', name: 'Кріпильні елементи', count: 10 }]`
  - `StandardsCatalogAdapter.getStandards(categoryId)`: повертає перелік стандартів `[{ id, group, document, title, type }]`
  - `StandardsCatalogAdapter.getStandardDetails(standardId)`: повертає паспорт стандарту (нотатки, джерело, доступні класи/виконання, поля)
  - `StandardsCatalogAdapter.getTableData(standardId, options)`: повертає нормалізовані рядки `{ columns: [...], rows: [...] }`
  - `StandardsCatalogAdapter.filterRows(rows, query)`: фільтрація рядків за діаметром

- [ ] **Step 1: Write test for catalog adapter in `tests/standards-base.test.cjs`**

```javascript
// tests/standards-base.test.cjs (Part 1: Adapter tests)
const assert = require('assert');
const path = require('path');

// Mock browser globalThis
require('../standards.bundle.js');
const { StandardsCatalogAdapter } = require('../standards-base/src/catalog-adapter.cjs');

const categories = StandardsCatalogAdapter.getCategories(globalThis.FlangeStandardsDB);
assert.ok(categories.some(c => c.id === 'fasteners'), 'Must include fasteners category');

const standards = StandardsCatalogAdapter.getStandards(globalThis.FlangeStandardsDB, 'fasteners');
assert.strictEqual(standards.length, 10, 'Must have 10 fastener standards (5 nuts, 3 washers, 1 thread, 1 torque)');

// Test ГОСТ 5915-70 table data
const nutData = StandardsCatalogAdapter.getTableData(globalThis.FlangeStandardsDB, 'gost-5915-70');
assert.ok(nutData.columns.some(c => c.key === 'diameter'), 'Must have diameter column');
assert.ok(nutData.rows.length >= 20, 'Must have at least 20 diameters');
const m24 = nutData.rows.find(r => r.diameter === 24);
assert.ok(m24, 'M24 row must exist');
assert.strictEqual(m24.heightMm, 19, 'M24 height must be 19 mm');
assert.strictEqual(m24.acrossFlatsMm, 36, 'M24 S must be 36 mm');

console.log('Catalog adapter tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/standards-base.test.cjs`
Expected: FAIL (модуль ще не створений)

- [ ] **Step 3: Implement `catalog-adapter.js` (and CommonJS wrapper for Node tests)**

Реалізувати логіку мапінгу:
- Категорії: Гайки (`gost-5915-70`, `gost-5927-70`, `gost-9064-75`, `gost-10605-94`, `gost-iso-4032-2014`), Шайби (`gost-11371-78`, `gost-6402-70`, `gost-9065-75`), Різьби (`gost-24705-2004`), Моменти (`universal-table-1`).
- Нормалізація колонок для кожного типу деталі.
- Позначення нерекомендованих діаметрів (`isNonPreferred: true`).
- Підтримка фільтрації за діаметром (наприклад `24`, `m24`, `М24`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/standards-base.test.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add standards-base/src/catalog-adapter.js tests/standards-base.test.cjs
git commit -m "feat(standards-base): implement StandardsCatalogAdapter with full test coverage"
```

---

### Task 3: Параметричні моделі та генератор 2D-креслень (`drawing-templates.js`, `drawing-engine.js`)

**Files:**
- Create: `standards-base/src/drawing-templates.js`
- Create: `standards-base/src/drawing-engine.js`
- Modify: `tests/standards-base.test.cjs`

**Interfaces:**
- Consumes: `StandardsCatalogAdapter.getTableData(...)` row objects
- Produces:
  - `StandardsDrawingEngine.render({ standardId, row, theme, execution })`: повертає валідний SVG рядок з деталлю та виносними розмірами.
  - `StandardsDrawingEngine.getStandardCallout(standardId, row, execution)`: повертає стандартне позначення (напр. `"Гайка М24 ГОСТ 5915-70"`).

- [ ] **Step 1: Write tests for drawing templates and SVG rendering in `tests/standards-base.test.cjs`**

```javascript
// tests/standards-base.test.cjs (Part 2: Drawing engine tests)
const { StandardsDrawingEngine } = require('../standards-base/src/drawing-engine.cjs');

// Test Hex Nut M24 SVG
const nutSvg = StandardsDrawingEngine.render({
  standardId: 'gost-5915-70',
  type: 'hex_nut',
  row: { diameter: 24, heightMm: 19, acrossFlatsMm: 36 },
  theme: 'dark'
});
assert.ok(nutSvg.includes('<svg'), 'Output must be an SVG element');
assert.ok(!nutSvg.includes('NaN'), 'SVG must not contain NaN coordinates');
assert.ok(nutSvg.includes('36'), 'SVG must display across-flats dimension 36');
assert.ok(nutSvg.includes('19'), 'SVG must display height dimension 19');

// Test Washer M24 SVG
const washerSvg = StandardsDrawingEngine.render({
  standardId: 'gost-11371-78',
  type: 'washer',
  row: { diameter: 24, innerDiameterMm: 25, outerDiameterMm: 44, thicknessMm: 4 },
  theme: 'light'
});
assert.ok(washerSvg.includes('<svg'), 'Washer output must be SVG');
assert.ok(!washerSvg.includes('NaN'), 'Washer SVG must not contain NaN');
assert.ok(washerSvg.includes('44'), 'Washer SVG must display outer diameter 44');

console.log('Drawing engine tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/standards-base.test.cjs`
Expected: FAIL (drawing engine ще не реалізовано)

- [ ] **Step 3: Implement `drawing-templates.js` and `drawing-engine.js`**

Реалізувати:
1. `drawing-templates.js`:
   - `renderHexNut(params)`: поздовжній розріз гайки (висота $m$, отвір різьби $d$, фаски під $30^\circ$) + вигляд згори (шестигранник $S$, коло отвору $d$).
   - `renderWasher(params)`: піврозріз шайби (товщина $s$) + вигляд згори (внутрішній $d_1$, зовнішній $d_2$).
   - `renderSpringWasher(params)`: пружинна шайба гровер з косим стиком і перетином.
   - `renderThread(params)`: профіль метричної різьби $60^\circ$ з кроком $P$ і діаметром $d$.
   - `renderTorque(params)`: векторна інфографіка діапазону моментів (min..max Н·м та кгс·м).
2. `drawing-engine.js`:
   - Допоміжні функції нанесення розмірних ліній: `drawLinearDimension({ x1, y1, x2, y2, text, offset, orientation })` зі стрілками та виносними лініями за ДСТУ.
   - Тематизація: класи CAD Light (графітові лінії, бірюзові розміри) та Blueprint Dark (люмінесцентні лінії, блакитні розміри з підкладкою).
   - Функція `getStandardCallout(...)` для генерації позначення деталі.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/standards-base.test.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add standards-base/src/drawing-templates.js standards-base/src/drawing-engine.js tests/standards-base.test.cjs
git commit -m "feat(standards-base): implement parametric 2D SVG drawing templates and engine"
```

---

### Task 4: Інтерфейс користувача та контролер застосунку (`index.html`, `app.js`)

**Files:**
- Create: `standards-base/index.html`
- Create: `standards-base/src/app.js`
- Modify: `tests/standards-base.test.cjs`

**Interfaces:**
- Consumes: `StandardsCatalogAdapter`, `StandardsDrawingEngine`, `FlangeStandardsDB`
- Produces: Повнофункціональний односторінковий веб-застосунок, доступний при відкритті `standards-base/index.html`.

- [ ] **Step 1: Write integration tests for HTML structure and DOM bindings in `tests/standards-base.test.cjs`**

```javascript
// tests/standards-base.test.cjs (Part 3: UI HTML validation)
const fs = require('fs');
const html = fs.readFileSync(path.join(__dirname, '..', 'standards-base', 'index.html'), 'utf8');

assert.ok(html.includes('id="searchInput"'), 'Must have search input');
assert.ok(html.includes('id="standardsList"'), 'Must have standards list container');
assert.ok(html.includes('id="passportCard"'), 'Must have passport card container');
assert.ok(html.includes('id="dimensionsTable"'), 'Must have dimensions table container');
assert.ok(html.includes('id="drawingContainer"'), 'Must have drawing container');
assert.ok(html.includes('id="btnCopyCallout"'), 'Must have copy callout button');
assert.ok(html.includes('id="btnExportSvg"'), 'Must have export SVG button');
assert.ok(html.includes('id="themeToggle"'), 'Must have theme toggle');
console.log('HTML structure tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/standards-base.test.cjs`
Expected: FAIL (`index.html` ще не існує)

- [ ] **Step 3: Create `index.html` and `src/app.js`**

1. `index.html`:
   - Підключення скрипту запобігання FOUC для теми.
   - `header`: Логотип SuperBase, заголовок «База знань стандартів», таби категорій (`Кріпильні елементи`, `Фланці (незабаром)`, `Прокладки (незабаром)`), перемикач теми, посилання на головний проєкт.
   - `aside`: Список типів та стандартів з бейджами шифрів, кнопка згортання сайдбара `#btnToggleSidebar`.
   - `main`:
     - Верхній блок: `passportCard` (шифр, назва, клас точності, джерело, примітки).
     - Центральна колонка: панель фільтрації (пошук за діаметром, селектор класів/виконань), `dimensionsTable` з фіксованою шапкою (`sticky`).
     - Права закріплена колонка: `drawingContainer` з інженерним бейджем позначення, кнопками «Скопіювати позначення» та «Експорт SVG», контейнером для динамічного SVG.
     - `toastContainer` для спливаючих повідомлень про копіювання.
2. `src/app.js`:
   - Ініціалізація стану (`activeCategory`, `activeStandard`, `activeExecution`, `activeRow`, `searchQuery`).
   - Рендеринг списку стандартів, автоматичний вибір першого стандарту за замовчуванням (ГОСТ 5915-70).
   - Рендеринг паспорта стандарту та таблиці розмірів.
   - Обробка подій:
     - `mouseover` на рядку таблиці: миттєве оновлення розмірів на кресленні.
     - `click` на рядку таблиці: фіксація активного рядка.
     - `input` на полі пошуку: миттєва фільтрація рядків таблиці.
     - Клік на `btnCopyCallout`: копіювання до `navigator.clipboard` + показ тосту.
     - Клік на `btnExportSvg`: генерація Blob та завантаження `.svg` файлу.
     - Клік на `themeToggle`: перемикання класу `dark` та перемалювання креслення у відповідний стиль (CAD / Blueprint).
     - Клік на `btnToggleSidebar`: згортання/розгортання бічної панелі.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/standards-base.test.cjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add standards-base/index.html standards-base/src/app.js tests/standards-base.test.cjs
git commit -m "feat(standards-base): assemble UI shell, master-detail interactions, and app controller"
```

---

### Task 5: Верифікація всіх типорозмірів, регресія та фінальний запуск

**Files:**
- Modify: `tests/standards-base.test.cjs`
- Modify: `index.html` (додати посилання у шапку або меню на Базу знань)
- Test: `node scripts/check.cjs`
- Test: `node tests/standards-base.test.cjs`

**Interfaces:**
- Produces: 100% покриття тестами всіх розмірів усіх 10 стандартів (0 помилок генерації SVG), 100% збереження розрахункового ядра `Прокладок`.

- [ ] **Step 1: Add exhaustive SVG generation test for ALL sizes in ALL 10 standards**

```javascript
// Test every single size in every single standard in FlangeStandardsDB for SVG validity
for (const std of standards) {
  const data = StandardsCatalogAdapter.getTableData(globalThis.FlangeStandardsDB, std.id);
  for (const row of data.rows) {
    const svg = StandardsDrawingEngine.render({
      standardId: std.id,
      type: std.type,
      row: row,
      theme: 'dark'
    });
    assert.ok(svg && svg.length > 50, `SVG for ${std.id} size ${row.diameter} must not be empty`);
    assert.ok(!svg.includes('NaN'), `SVG for ${std.id} size ${row.diameter} must not contain NaN`);
  }
}
console.log('All standards and all sizes verified successfully!');
```

- [ ] **Step 2: Run tests**

Run: `node tests/standards-base.test.cjs`
Expected: PASS (всі стандарти та розміри валідні)

- [ ] **Step 3: Run existing project tests to guarantee zero regression**

Run: `node scripts/check.cjs`
Expected: PASS (0 розбіжностей, 100% відповідність)

- [ ] **Step 4: Add link to StandardsBase in the main `Прокладки` workspace header**

Додати кнопку або посилання у шапку `index.html` (робочий простір): `База знань стандартів` -> `standards-base/index.html`.

- [ ] **Step 5: Commit and tag**

```bash
git add index.html tests/standards-base.test.cjs
git commit -m "feat(standards-base): complete end-to-end verification and link knowledge base from main workspace"
```
