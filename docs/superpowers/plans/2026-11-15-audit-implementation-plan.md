# План впровадження покращень за результатами аудиту

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реалізувати узгоджені інженерні та інтерфейсні покращення робочого простору розрахунку фланцевих з'єднань з урахуванням усіх 8 коментарів користувача, зберігши 100% арифметичну точність і наскрізну звірку з Excel (0 розбіжностей).

**Architecture:** Модульне оновлення клієнтського десктопного застосунку:
1. Динамічний розрахунок зазору отвору фланця $d_0$ за діаметром різьби з можливістю повного ручного перевизначення.
2. М'яка індикація прогресу майстра (зелені/жовті індикатори заповненості) без блокування навігації кнопками «Далі»/«Назад».
3. Гнучке врахування конфігурацій з'єднання (шпилька/болт, з гайкою/без гайки, з шайбами/без шайб).
4. Інженерні консультативні перевірки кроку кріплень ($t_b = \pi D_w / z$) та зазорів фланця.
5. Автопідбір стандарту гайки для великих діаметрів ($d > 48$ мм).
6. Оптимізація ергономіки десктопного інтерфейсу та повноцінні стилі друку (`@media print`).
7. Очищення застарілих файлів та підвищення надійності завантаження файлів.

**Tech Stack:** Vanilla JavaScript (ES2022+), CSS3 (Desktop-only), Node.js (scripts/check.cjs test runner).

**Spec / Audit Report:** [AUDIT_REPORT.md](file:///C:/Users/Максим/.gemini/antigravity/brain/a58c5a67-d3ca-4ebc-9846-261989cae4e1/AUDIT_REPORT.md)

---

## Global Constraints

- **Desktop Only:** Інтерфейс виключно для робочих станцій інженерів. Мобільна версія поза межами проєкту. Жодних мобільних оптимізацій.
- **Арифметична точність:** 100% збіг із контрольними значеннями Excel (0 розбіжностей у `node scripts/check.cjs`).
- **Рішення користувача з аудиту:**
  - $M_{nom}$ НЕ додавати (залишається класичний пошук безпечного діапазону $[M_{min}, M_{max}]$).
  - $q_{seat}$ у МПа окремо НЕ додавати.
  - Коефіцієнти тертя суворо зашиті (0.26 мащення / 0.37 без мащення), додаткових коефіцієнтів не вводити.
  - Посилання на комірки Excel у UI поки залишати.
  - Навігацію майстра НЕ блокувати — лише м'яка колірна індикація статусу кроків (зелений/жовтий).
  - Одиничне зусилля затягування шпильки вже розраховується і звіряється з рядком 27 Excel (I27/J27, `initialSingle`).

---

## План задач

### Task 1: Автоматичний розрахунок отвору фланця $d_0$ з можливістю ручного введення

**Files:**
- Modify: `app.js:647-650` (відображення dynamic placeholder у полі $d_0$)
- Modify: `calculations.js:532-538` (експорт функції розрахунку автоматичного отвору)
- Test: `tests/flanges.cjs`

**Interfaces:**
- Consumes: `node.fastener.nominalDiameter`
- Produces: `automaticFlangeHole(nominalDiameter)` $\to$ `nominal >= 27 ? d+3 : nominal > 10 ? d+2 : d+1`

- [ ] **Step 1: Написати тест для розрахунку та плейсхолдера отвору**
В `tests/flanges.cjs` додати перевірку значень автоматичного отвору для різних діаметрів (М10 $\to$ 11, М16 $\to$ 18, М24 $\to$ 26, М27 $\to$ 30, М30 $\to$ 33) та збереження ручного значення, якщо користувач його ввів.

- [ ] **Step 2: Запустити тест і переконатися у відповідності базової логіки**
Run: `node tests/flanges.cjs`

- [ ] **Step 3: Реалізувати експорт функції `automaticHoleDiameter` у `FlangeCalculations` або `FlangeCore`**
```javascript
function automaticHoleDiameter(nominalDiameter) {
  const d = FlangeCore.number(nominalDiameter);
  if (!d || d <= 0) return null;
  return d + (d >= 27 ? 3 : d > 10 ? 2 : 1);
}
```

- [ ] **Step 4: Оновити поле $d_0$ у `app.js` для показу динамічного плейсхолдера**
У `app.js` при формуванні розмітки полів фланця:
```javascript
const autoHole = C.automaticHoleDiameter?.(node.fastener.nominalDiameter);
const holePlaceholder = autoHole ? `Авто (${autoHole} мм)` : 'Авто';
// ... field(path+'.holeDiameter', 'Отвір під кріплення d₀', 'мм', { placeholder: holePlaceholder, ... })
```

- [ ] **Step 5: Запустити перевірку всього тестового набору**
Run: `node scripts/check.cjs`
Expected: 17/17 OK, 0 differences.

---

### Task 2: М'яка колірна індикація статусу кроків майстра (зелений / жовтий)

**Files:**
- Modify: `app.js:653-690` (рендер бейджів/індикаторів статусу в навігації кроків `.node-steps`)
- Modify: `styles.css` (стилізація станів `.step-status.complete` та `.step-status.incomplete`)

**Interfaces:**
- Consumes: `FlangeCore.sectionStatus(node, materials, standardsDb)`
- Produces: М'які класи та бейджі статусу на кнопках кроків навігації

- [ ] **Step 1: Оновити рендер кнопок у `setupEditorSteps()` та `selectEditorStep()` в `app.js`**
При відображенні та перемиканні кроків визначати стан поточної секції через `C.sectionStatus(node, materials, standardsDb)`.
Кожна кнопка навігації отримує бейдж або крапку:
- Зелена галочка/індикатор, якщо секцію повністю заповнено (`status === true`).
- Жовтий/нейтральний індикатор, якщо секція очікує заповнення (`status === false`).
Кнопка «Далі» залишається **повністю активною** (не блокується), дозволяючи вільну навігацію.

- [ ] **Step 2: Додати десктопні CSS-стилі індикаторів у `styles.css`**
```css
.node-steps button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
}
.step-badge.done {
  background: #dafbe1;
  color: #1a7f37;
}
.step-badge.pending {
  background: #fff8c5;
  color: #9a6700;
}
```

- [ ] **Step 3: Перевірити роботу в браузері та перевірити тести**
Run: `node scripts/check.cjs`
Expected: PASS.

---

### Task 3: Гнучкі варіанти конструкції з'єднання (шпилька/болт, гайка/без гайки, шайби)

**Files:**
- Modify: `core.js:311-341` (перевірка `sectionStatus` для безгайкових або безшайбових варіантів)
- Modify: `app.js:603-652` (відображення опцій конфігурації кріплення та підказок)
- Modify: `calculations.js:66-84` (врахування висоти зачеплення без гайки у випадку болта в глухий отвір)
- Test: `tests/compliance.cjs`, `tests/calculations.cjs`

**Interfaces:**
- Consumes: `node.fastener.type`, `node.washers.placement`, наявність гайки
- Produces: Коректні ланцюжки розрахунку довжин для різних типів з'єднання

- [ ] **Step 1: Написати тести на конфігурації з'єднань**
В `tests/compliance.cjs` перевірити валідацію та довжини пакета деталей для:
1. Шпилька + гайка + 2 шайби.
2. Болт + гайка + 1 шайба.
3. Шпилька/болт без шайб (`washers.placement = 'none'`).
4. Болт у глухий отвір корпусу (без гайки, різьба в деталі Б).

- [ ] **Step 2: Запустити тест для фіксації поточної поведінки**
Run: `node tests/compliance.cjs`

- [ ] **Step 3: Оновити логіку валідації `sectionStatus` у `core.js`**
Якщо в з'єднанні обрано конструкцію без гайки (наприклад, болт у різьбовий корпус), секція гайки автоматично позначається як застосована або не потрібна (`result.nut = true`), а крок у майстрі відображає підказку «У цьому вузлі гайка не застосовується (болт вкручується в нарізний корпус)».

- [ ] **Step 4: Запустити тести**
Run: `node scripts/check.cjs`
Expected: 17/17 OK, 0 differences.

---

### Task 4: Інженерні консультативні перевірки (крок кріплень та зазори фланця)

**Files:**
- Modify: `calculations.js` (додавання розрахунку консультативних метрик $t_b$ та зазорів)
- Modify: `app.js` (відображення консультативних бейджів)
- Test: `tests/validation.cjs`

**Interfaces:**
- Consumes: $D_w, z, d_0, D_f, D$
- Produces: Advisory metrics:
  - Bolt pitch: $t_b = \frac{\pi \cdot D_w}{z}$
  - Pitch ratio: $k_p = t_b / d_0$ (рекомендовано $3.5 \dots 5$; якщо $< 2.5$ — важкий монтаж ключем; якщо $> 6$ — ризик розвантаження прокладки)
  - Edge clearance: $\delta_{out} = (D_f - D_w)/2$, $\delta_{in} = (D_w - D)/2$

- [ ] **Step 1: Написати тести для консультативних формул**
В `tests/validation.cjs` перевірити коректність обчислення $t_b$ та зазорів крайок для типових фланців.

- [ ] **Step 2: Реалізувати розрахунок метрик геометрії у `calculations.js`**
Функція `flangeGeometryAdvisories({boltCircle, count, holeDiameter, outerDiameter, innerDiameter})` повертає розрахований крок, відношення та текстові підказки безпеки.

- [ ] **Step 3: Відобразити консультативні підказки в інтерфейсі фланця**
В `app.js` у блоці фланців відображати компактний інформаційний блок з відстанню між болтами.

- [ ] **Step 4: Запустити контрольний набір тестів**
Run: `node scripts/check.cjs`
Expected: PASS.

---

### Task 5: Автопідбір та рекомендація стандарту гайки для діаметрів $d > 48$ мм

**Files:**
- Modify: `app.js:637-642` (селектор стандартів гайок)
- Test: `tests/validation.cjs`

**Interfaces:**
- Consumes: `node.fastener.nominalDiameter` ($d$)
- Produces: Автоматичне перемикання або рекомендація ГОСТ 9064-75 для $d \in \{52, 56, 60\}$ мм

- [ ] **Step 1: Додати перевірку сумісності стандартів гайок у тест**
Перевірити, що для $d=52$ мм ГОСТ 5915-70 позначається як несумісний/недоступний, а ГОСТ 9064-75 успішно повертає розміри.

- [ ] **Step 2: Реалізувати логіку в `app.js`**
При зміні діаметра шпильки/болта на значення $> 48$ мм, якщо обрано ГОСТ 5915-70, автоматично пропонувати або встановлювати ГОСТ 9064-75 з інформаційним повідомленням про межу стандарту ГОСТ 5915-70 (до М48).

- [ ] **Step 3: Запустити тести**
Run: `node scripts/check.cjs`
Expected: PASS.

---

### Task 6: Десктопна ергономіка та стилі друку (`@media print`)

**Files:**
- Modify: `styles.css` (розширення контейнера форми до 460–520px на великих екранах, видалення `@media (max-width: 680px)`, додавання `@media print`)

**Interfaces:**
- Clean CSS для розрахункового десктопного простору та чистого друку звіту в PDF.

- [ ] **Step 1: Очистити мертвий мобільний CSS у `styles.css`**
Видалити невикористовувані селектори `@media (max-width: 680px)` згідно з інструкцією «Тільки десктоп».

- [ ] **Step 2: Оптимізувати ширину колонки форми для комфортного перегляду на моніторах 1080p+**
Збільшити ширину `.editor-body .settings` або адаптивної сітки (до 480–520px), щоб картки стандартів та поля введення не стискалися і мали вільний простір.

- [ ] **Step 3: Реалізувати стилі друку `@media print`**
Створити чистий режим друку без 100vh висоти та overflow-hidden:
```css
@media print {
  body, .app-shell, .editor-body, .workspace-main {
    height: auto !important;
    overflow: visible !important;
  }
  .app-header, .node-steps, .step-controls, .breadcrumbs, .action-bar {
    display: none !important;
  }
  .calculation-view, .results-panel, .passport {
    page-break-inside: avoid;
  }
}
```

- [ ] **Step 4: Перевірити візуальний вигляд інтерфейсу та тести**
Run: `node scripts/check.cjs`
Expected: PASS.

---

### Task 7: Очищення застарілих файлів та підвищення надійності експорту

**Files:**
- Delete: `standards.js`
- Modify: `index.html:12` (видалення підключення `standards.js`)
- Modify: `app.js:5,71,1273` (видалення мертвої константи `standards`, збільшення таймуту revokeObjectURL)
- Test: `tests/app-files.cjs`, `scripts/check.cjs`

**Interfaces:**
- Безпечний експорт файлів без передчасного закриття blob URL.

- [ ] **Step 1: Видалити невикористовувану змінну `standards` в `app.js` та посилання в `index.html`**
У `index.html` прибрати `<script src="standards.js" defer></script>`.
У `app.js:5` прибрати `const standards = window.FlangeStandards;`.
Видалити застарілий файл-заглушку `standards.js`.

- [ ] **Step 2: Збільшити таймаут вивільнення URL у `download()` до 60 000 мс**
У `app.js` замінити `setTimeout(() => URL.revokeObjectURL(url), 1000)` на 60 секунд або реєстрацію через WeakRef/подію збереження.

- [ ] **Step 3: Запустити повну наскрізну перевірку всього проєкту**
Run: `node scripts/check.cjs`
Expected: 17/17 OK, 0 differences, повна наскрізна відповідність.

---

## Самоперевірка плану

1. **Покриття вимог користувача:**
   - [x] Автоматичні отвори за заданою шпилькою з ручним зазначенням діаметра $\to$ Task 1.
   - [x] М'яке підсвічування заповнених/не заповнених кроків (зелений/жовтий) без блокування $\to$ Task 2.
   - [x] Врахування варіантів з'єднання (з шайбами/без, шпилька/болт, наявність гайки) $\to$ Task 3.
   - [x] Коефіцієнти тертя суворо залишено (0.26 / 0.37) $\to$ Зафіксовано в обмеженнях.
   - [x] Номінальний момент $M_{nom}$ НЕ додавати (мета — $[M_{min}, M_{max}]$) $\to$ Зафіксовано в обмеженнях.
   - [x] Одиничне зусилля затягування шпильки — це рядок 27 Excel (I27/J27, `initialSingle`) $\to$ Зафіксовано в обмеженнях.
   - [x] $q_{seat}$ у МПа не додавати $\to$ Зафіксовано в обмеженнях.
   - [x] Посилання на комірки Excel залишено $\to$ Зафіксовано в обмеженнях.
   - [x] Консультативні перевірки кроку кріплень $\to$ Task 4.
   - [x] Гайки $> 48$ мм $\to$ Task 5.
   - [x] Десктопний дизайн та друк $\to$ Task 6.
   - [x] Очищення коду та файлів $\to$ Task 7.

2. **Відсутність плейсхолдерів:** Усі задачі містять точні імена файлів, інтерфейси, команди та кроки перевірки.
3. **Контрольні тести:** Після кожного кроку виконується `node scripts/check.cjs`.
