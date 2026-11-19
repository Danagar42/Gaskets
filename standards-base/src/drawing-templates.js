/**
 * StandardsDrawingTemplates
 *
 * Параметричні векторні шаблони 2D-креслень нормативних деталей:
 * - hex_nut: шестигранні гайки (фронтальний розріз + вигляд зверху)
 * - washer: плоскі шайби (піврозріз + вигляд зверху)
 * - spring_washer: пружинні шайби гровер (розріз з прорізом замка)
 * - thread: метричний профіль різьби 60°
 * - torque: інфографічна шкала моментів затягування
 *
 * Працює як у браузері (window.StandardsDrawingTemplates), так і в Node.js (CommonJS).
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const templates = factory();
    module.exports = { StandardsDrawingTemplates: templates };
    module.exports.StandardsDrawingTemplates = templates;
    module.exports.default = templates;
  } else {
    const templates = factory();
    root.StandardsDrawingTemplates = templates;
    if (typeof globalThis !== 'undefined') {
      globalThis.StandardsDrawingTemplates = templates;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const format = new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format;

  // Безпечне округлення чисел для SVG
  function n(val, fallback = 0) {
    const num = Number(val);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : fallback;
  }

  // Генерація унікального ID для SVG defs
  let idCounter = 0;
  function getUniqueId(prefix = 'std') {
    idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
  }

  /**
   * Створення базового SVG контейнера
   */
  function wrapSvg({ width = 560, height = 340, content, themeColors, title = '' }) {
    const patternId = getUniqueId('hatch');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="standards-drawing standards-drawing--${themeColors.name}" role="img" aria-label="${title}">
  <defs>
    <pattern id="${patternId}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="${themeColors.hatchStroke}" stroke-width="1" />
    </pattern>
    <filter id="halo-blur" x="-20%" y="-20%" width="140%" height="140%">
      <feFlood flood-color="${themeColors.bg}" result="bg" />
      <feComposite in="SourceGraphic" in2="bg" operator="over" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${themeColors.bg}" rx="8" />
  ${content.replace(/__HATCH_ID__/g, patternId)}
</svg>`;
  }

  /**
   * Допоміжні функції нанесення розмірних ліній
   */
  function drawLinearHorizontal({ x1, x2, y, yDim, text, colors, extensionOffset = 4 }) {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const yExtStart = y;
    const yExtEnd = yDim > y ? yDim + extensionOffset : yDim - extensionOffset;
    const arrowL = 7;
    const arrowW = 2.5;

    return `
      <!-- Horizontal Dimension: ${text} -->
      <line x1="${n(left)}" y1="${n(yExtStart)}" x2="${n(left)}" y2="${n(yExtEnd)}" stroke="${colors.dim}" stroke-width="0.8" />
      <line x1="${n(right)}" y1="${n(yExtStart)}" x2="${n(right)}" y2="${n(yExtEnd)}" stroke="${colors.dim}" stroke-width="0.8" />
      <line x1="${n(left)}" y1="${n(yDim)}" x2="${n(right)}" y2="${n(yDim)}" stroke="${colors.dim}" stroke-width="0.9" />
      <!-- Left Arrow -->
      <polygon points="${n(left)},${n(yDim)} ${n(left + arrowL)},${n(yDim - arrowW)} ${n(left + arrowL)},${n(yDim + arrowW)}" fill="${colors.dim}" />
      <!-- Right Arrow -->
      <polygon points="${n(right)},${n(yDim)} ${n(right - arrowL)},${n(yDim - arrowW)} ${n(right - arrowL)},${n(yDim + arrowW)}" fill="${colors.dim}" />
      <!-- Dimension Text -->
      <text x="${n((left + right) / 2)}" y="${n(yDim - 4)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.dimText}" stroke="${colors.dimHalo}" stroke-width="3.5" paint-order="stroke fill">${text}</text>
    `;
  }

  function drawLinearVertical({ y1, y2, x, xDim, text, colors, extensionOffset = 4 }) {
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const xExtStart = x;
    const xExtEnd = xDim > x ? xDim + extensionOffset : xDim - extensionOffset;
    const arrowL = 7;
    const arrowW = 2.5;

    return `
      <!-- Vertical Dimension: ${text} -->
      <line x1="${n(xExtStart)}" y1="${n(top)}" x2="${n(xExtEnd)}" y2="${n(top)}" stroke="${colors.dim}" stroke-width="0.8" />
      <line x1="${n(xExtStart)}" y1="${n(bottom)}" x2="${n(xExtEnd)}" y2="${n(bottom)}" stroke="${colors.dim}" stroke-width="0.8" />
      <line x1="${n(xDim)}" y1="${n(top)}" x2="${n(xDim)}" y2="${n(bottom)}" stroke="${colors.dim}" stroke-width="0.9" />
      <!-- Top Arrow -->
      <polygon points="${n(xDim)},${n(top)} ${n(xDim - arrowW)},${n(top + arrowL)} ${n(xDim + arrowW)},${n(top + arrowL)}" fill="${colors.dim}" />
      <!-- Bottom Arrow -->
      <polygon points="${n(xDim)},${n(bottom)} ${n(xDim - arrowW)},${n(bottom - arrowL)} ${n(xDim + arrowW)},${n(bottom - arrowL)}" fill="${colors.dim}" />
      <!-- Dimension Text -->
      <text x="${n(xDim - 6)}" y="${n((top + bottom) / 2 + 4)}" text-anchor="end" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.dimText}" stroke="${colors.dimHalo}" stroke-width="3.5" paint-order="stroke fill">${text}</text>
    `;
  }

  function drawCenterline(x1, y1, x2, y2, colors) {
    return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${colors.axis}" stroke-width="0.9" stroke-dasharray="14,3,2,3" />`;
  }

  /**
   * 1. ШАБЛОН: Шестигранна гайка (ГОСТ 5915-70, 5927-70, 9064-75, 10605-94, ISO 4032)
   * Фронтальний розріз + вигляд зверху
   */
  function renderHexNut({ d, m, s, e, pitch, colors }) {
    const nomD = n(d, 24);
    const heightM = n(m, 21.5);
    const widthS = n(s, 36);
    const cornerE = n(e, widthS * 1.155);

    // Масштабування деталі у вікні перегляду
    const viewW = 560;
    const viewH = 340;
    const cxSection = 155;
    const cySection = 165;
    const cxTop = 390;
    const cyTop = 165;

    // Масштаб для комфортного вписування у виділену область (без занижених штучних обмежень)
    const scale = Math.min(155 / widthS, 130 / heightM, 60);

    const sPx = widthS * scale;
    const mPx = heightM * scale;
    const dPx = nomD * scale;
    const dHolePx = dPx * 0.85; // внутрішній діаметр різьби (свердло)
    const rHexPx = (widthS / Math.sqrt(3)) * scale;

    const xL = cxSection - sPx / 2;
    const xR = cxSection + sPx / 2;
    const yT = cySection - mPx / 2;
    const yB = cySection + mPx / 2;

    const holeL = cxSection - dHolePx / 2;
    const holeR = cxSection + dHolePx / 2;
    const chamfer = Math.min(mPx * 0.12, 10);

    // Вершини шестигранника для вигляду зверху (дві грані вертикальні паралельні осі Y)
    const hexPoints = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 30 + i * 60;
      const rad = (angleDeg * Math.PI) / 180;
      const hx = cxTop + rHexPx * Math.cos(rad);
      const hy = cyTop + rHexPx * Math.sin(rad);
      hexPoints.push(`${n(hx)},${n(hy)}`);
    }

    const content = `
      <!-- View Titles -->
      <text x="${n(cxSection)}" y="40" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ФРОНТАЛЬНИЙ РОЗРІЗ</text>
      <text x="${n(cxTop)}" y="40" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ВИГЛЯД ЗВЕРХУ</text>

      <!-- ================= SECTION VIEW ================= -->
      <!-- Left Hatched Section Body -->
      <polygon points="${n(xL)},${n(yT + chamfer)} ${n(xL + chamfer)},${n(yT)} ${n(holeL)},${n(yT)} ${n(holeL)},${n(yB)} ${n(xL + chamfer)},${n(yB)} ${n(xL)},${n(yB - chamfer)}" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="1.8" />
      
      <!-- Right Hatched Section Body -->
      <polygon points="${n(holeR)},${n(yT)} ${n(xR - chamfer)},${n(yT)} ${n(xR)},${n(yT + chamfer)} ${n(xR)},${n(yB - chamfer)} ${n(xR - chamfer)},${n(yB)} ${n(holeR)},${n(yB)}" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Outer Thread Runout Lines (Thin) -->
      <line x1="${n(cxSection - dPx / 2)}" y1="${n(yT)}" x2="${n(cxSection - dPx / 2)}" y2="${n(yB)}" stroke="${colors.threadThin}" stroke-width="0.9" stroke-dasharray="3,1" />
      <line x1="${n(cxSection + dPx / 2)}" y1="${n(yT)}" x2="${n(cxSection + dPx / 2)}" y2="${n(yB)}" stroke="${colors.threadThin}" stroke-width="0.9" stroke-dasharray="3,1" />

      <!-- Centerline Section -->
      ${drawCenterline(cxSection, yT - 18, cxSection, yB + 18, colors)}

      <!-- Section Dimensions -->
      ${drawLinearVertical({
        y1: yT,
        y2: yB,
        x: xL,
        xDim: xL - 25,
        text: `${format(heightM)} мм`,
        colors
      })}

      ${drawLinearHorizontal({
        x1: xL,
        x2: xR,
        y: yB,
        yDim: yB + 30,
        text: `${format(widthS)} мм`,
        colors
      })}

      <!-- Thread Nominal Leader Line -->
      <path d="M ${n(holeR)} ${n(cySection)} L ${n(holeR + 30)} ${n(cySection - 30)} H ${n(holeR + 75)}" fill="none" stroke="${colors.dim}" stroke-width="0.9" />
      <circle cx="${n(holeR)}" cy="${n(cySection)}" r="2" fill="${colors.dim}" />
      <text x="${n(holeR + 34)}" y="${n(cySection - 34)}" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="${colors.dimText}">М${format(nomD)}</text>

      <!-- ================= TOP VIEW ================= -->
      <!-- Hexagon Outline -->
      <polygon points="${hexPoints.join(' ')}" fill="${colors.panelFill || 'none'}" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Chamfer Inscribed Circle (Thin) -->
      <circle cx="${n(cxTop)}" cy="${n(cyTop)}" r="${n(sPx / 2)}" fill="none" stroke="${colors.lineThin}" stroke-width="0.8" />

      <!-- Central Thread Hole (Solid Inner Diameter) -->
      <circle cx="${n(cxTop)}" cy="${n(cyTop)}" r="${n(dHolePx / 2)}" fill="${colors.bg}" stroke="${colors.line}" stroke-width="1.5" />

      <!-- 3/4 Thread Circle (Thin standard convention ДСТУ 2.311) -->
      <path d="M ${n(cxTop + (dPx / 2) * Math.cos(-Math.PI / 4))} ${n(cyTop + (dPx / 2) * Math.sin(-Math.PI / 4))} A ${n(dPx / 2)} ${n(dPx / 2)} 0 1 1 ${n(cxTop)} ${n(cyTop - dPx / 2)}" fill="none" stroke="${colors.threadThin}" stroke-width="1.1" />

      <!-- Centerlines Top View -->
      ${drawCenterline(cxTop - rHexPx - 16, cyTop, cxTop + rHexPx + 16, cyTop, colors)}
      ${drawCenterline(cxTop, cyTop - rHexPx - 16, cxTop, cyTop + rHexPx + 16, colors)}

      <!-- Across-Flats Callout on Top View -->
      <text x="${n(cxTop)}" y="${n(cyTop + rHexPx + 24)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.dimText}">S = ${format(widthS)} мм</text>
    `;

    return wrapSvg({
      width: viewW,
      height: viewH,
      content,
      themeColors: colors,
      title: `Гайка М${format(nomD)} (S=${format(widthS)}, m=${format(heightM)})`
    });
  }

  /**
   * 2. ШАБЛОН: Плоска шайба (ГОСТ 11371-78, 9065-75)
   * Піврозріз/розріз + вигляд зверху
   */
  function renderCappedNut({ d, m, s, pitch, capProfile, colors, profiles }) {
    const cx = 246;
    const baseY = 268;
    const metric = profiles.buildHexNutMetrics(cx,baseY,d,'B',{nutCapH:m,nutS:s,pitch,capProfile});
    const {topY,scale} = metric;
    const radius = capProfile.bodyDiameterMm * scale / 2;
    const shoulder = topY + capProfile.headHeightMm * scale;
    const blindEnd = baseY - capProfile.boreDepthMm * scale;
    const steel = getUniqueId('steel');
    const guides = [
      drawLinearHorizontal({x1:cx-radius,x2:cx+radius,y:baseY,yDim:301,text:`D₁ = ${format(capProfile.bodyDiameterMm)} мм`,colors}),
      drawLinearVertical({y1:topY,y2:shoulder,x:cx+s*scale/2,xDim:cx+radius+92,text:`l₀ = ${format(capProfile.headHeightMm)} мм`,colors}),
      drawLinearVertical({y1:blindEnd,y2:baseY,x:cx+radius,xDim:cx+radius+92,text:`l = ${format(capProfile.boreDepthMm)} мм`,colors}),
      drawLinearVertical({y1:topY,y2:baseY,x:cx-radius,xDim:cx-radius-24,text:`l₁ = ${format(m)} мм`,colors})
    ];
    return wrapSvg({themeColors:colors,title:`Гайка М${format(d)} типу Б, піврозріз`,content:`
      <desc>Діаметр корпусу D₁ ${format(capProfile.bodyDiameterMm)} мм. Висота головки l₀ ${format(capProfile.headHeightMm)} мм. Глибина глухого отвору l ${format(capProfile.boreDepthMm)} мм.</desc>
      <defs>${profiles.steelGradient(steel)}</defs>
      <text x="246" y="34" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="13" font-weight="700" fill="${colors.line}">Піврозріз гайки</text>
      ${profiles.nutSide(metric,steel,'__HATCH_ID__')}
      ${drawCenterline(cx,topY-14,cx,baseY+14,colors)}
      ${guides.join('')}
    `});
  }

  function renderWasher({ d, d1, d2, s, colors }) {
    const nomD = n(d, 24);
    const innerD = n(d1, 25);
    const outerD = n(d2, 44);
    const thickS = n(s, 4);

    const viewW = 560;
    const viewH = 340;
    const cxSection = 155;
    const cySection = 165;
    const cxTop = 390;
    const cyTop = 165;

    // Масштаб базується на зовнішньому діаметрі (комфортне заповнення в'юпорта для всіх розмірів)
    const scale = Math.min(170 / outerD, 60);

    const r2Px = (outerD / 2) * scale;
    const r1Px = (innerD / 2) * scale;
    // Візуальна висота шайби (обмежена знизу 14px для виразного штрихування)
    const hPx = Math.max(thickS * scale, 14);

    const yT = cySection - hPx / 2;
    const yB = cySection + hPx / 2;

    const content = `
      <!-- View Titles -->
      <text x="${n(cxSection)}" y="40" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ПОЗДОВЖНІЙ РОЗРІЗ</text>
      <text x="${n(cxTop)}" y="40" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ВИГЛЯД ЗВЕРХУ</text>

      <!-- ================= SECTION VIEW ================= -->
      <!-- Left Section Rectangle -->
      <rect x="${n(cxSection - r2Px)}" y="${n(yT)}" width="${n(r2Px - r1Px)}" height="${n(hPx)}" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Right Section Rectangle -->
      <rect x="${n(cxSection + r1Px)}" y="${n(yT)}" width="${n(r2Px - r1Px)}" height="${n(hPx)}" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Centerline Section -->
      ${drawCenterline(cxSection, yT - 18, cxSection, yB + 18, colors)}

      <!-- Thickness Dimension -->
      ${drawLinearVertical({
        y1: yT,
        y2: yB,
        x: cxSection - r2Px,
        xDim: cxSection - r2Px - 25,
        text: `${format(thickS)} мм`,
        colors
      })}

      <!-- Inner Diameter Dimension -->
      ${drawLinearHorizontal({
        x1: cxSection - r1Px,
        x2: cxSection + r1Px,
        y: yT,
        yDim: yT - 25,
        text: `Ø ${format(innerD)} мм`,
        colors
      })}

      <!-- Outer Diameter Dimension -->
      ${drawLinearHorizontal({
        x1: cxSection - r2Px,
        x2: cxSection + r2Px,
        y: yB,
        yDim: yB + 30,
        text: `Ø ${format(outerD)} мм`,
        colors
      })}

      <!-- ================= TOP VIEW ================= -->
      <!-- Outer Circle -->
      <circle cx="${n(cxTop)}" cy="${n(cyTop)}" r="${n(r2Px)}" fill="${colors.panelFill || 'none'}" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Inner Hole Circle -->
      <circle cx="${n(cxTop)}" cy="${n(cyTop)}" r="${n(r1Px)}" fill="${colors.bg}" stroke="${colors.line}" stroke-width="1.6" />

      <!-- Centerlines Top View -->
      ${drawCenterline(cxTop - r2Px - 16, cyTop, cxTop + r2Px + 16, cyTop, colors)}
      ${drawCenterline(cxTop, cyTop - r2Px - 16, cxTop, cyTop + r2Px + 16, colors)}

      <!-- Subtitle badge -->
      <text x="${n(cxTop)}" y="${n(cyTop + r2Px + 24)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.dimText}">Шайба ${format(nomD)} (Ø${format(innerD)} × Ø${format(outerD)} × ${format(thickS)})</text>
    `;

    return wrapSvg({
      width: viewW,
      height: viewH,
      content,
      themeColors: colors,
      title: `Шайба ${format(nomD)} (d1=${format(innerD)}, d2=${format(outerD)}, s=${format(thickS)})`
    });
  }

  /**
   * 3. ШАБЛОН: Пружинна шайба (гровер) (ГОСТ 6402-70)
   * Розріз пружинної шайби з косим стиком/замком 15°
   */
  function renderSpringWasher({ d, d1, d2, s, colors, showApproximateHeight = true }) {
    const nomD = n(d, 24);
    const innerD = n(d1, 24.5);
    const outerD = n(d2, 40);
    const thickS = n(s, 5);

    const viewW = 560;
    const viewH = 340;
    const cxSection = 155;
    const cySection = 165;
    const cxTop = 390;
    const cyTop = 165;

    // Масштаб для комфортного вписування у виділену область (без занижених штучних обмежень)
    const scale = Math.min(170 / outerD, 60);

    const r2Px = (outerD / 2) * scale;
    const r1Px = (innerD / 2) * scale;
    const bPx = r2Px - r1Px; // ширина перерізу дроту
    const hPx = Math.max(thickS * scale, 14);

    // У вільному стані гровер розведений на висоту ~ 1.5..2 * s
    const gapH = hPx * 0.6;
    const yT_left = cySection - hPx / 2 - gapH / 2;
    const yB_left = yT_left + hPx;
    const yT_right = cySection - hPx / 2 + gapH / 2;
    const yB_right = yT_right + hPx;

    // Побудова розрізаного кільця з кутом 15°
    // Кут прорізу 15 градусів у першому квадранті
    const cutAngleRad = (15 * Math.PI) / 180;
    const startAngle = cutAngleRad + 0.08;
    const endAngle = 2 * Math.PI - 0.08;

    const pOuterStart = `${n(cxTop + r2Px * Math.cos(startAngle))},${n(cyTop - r2Px * Math.sin(startAngle))}`;
    const pOuterEnd = `${n(cxTop + r2Px * Math.cos(endAngle))},${n(cyTop - r2Px * Math.sin(endAngle))}`;
    const pInnerEnd = `${n(cxTop + r1Px * Math.cos(endAngle))},${n(cyTop - r1Px * Math.sin(endAngle))}`;
    const pInnerStart = `${n(cxTop + r1Px * Math.cos(startAngle))},${n(cyTop - r1Px * Math.sin(startAngle))}`;

    const content = `
      <!-- View Titles -->
      <text x="${n(cxSection)}" y="40" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">РОЗРІЗ У ВІЛЬНОМУ СТАНІ</text>
      <text x="${n(cxTop)}" y="40" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ВИГЛЯД ЗВЕРХУ (ПРОРІЗ 15°)</text>

      <!-- ================= SECTION VIEW ================= -->
      <!-- Left Raised Section -->
      <rect x="${n(cxSection - r2Px)}" y="${n(yT_left)}" width="${n(bPx)}" height="${n(hPx)}" rx="1.5" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Right Lower Section -->
      <rect x="${n(cxSection + r1Px)}" y="${n(yT_right)}" width="${n(bPx)}" height="${n(hPx)}" rx="1.5" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="1.8" />

      <!-- Centerline Section -->
      ${drawCenterline(cxSection, yT_left - 18, cxSection, yB_right + 18, colors)}

      <!-- Thickness s Dimension -->
      ${drawLinearVertical({
        y1: yT_left,
        y2: yB_left,
        x: cxSection - r2Px,
        xDim: cxSection - r2Px - 25,
        text: `s = ${format(thickS)} мм`,
        colors
      })}

      <!-- Free Height Dimension -->
      ${showApproximateHeight ? drawLinearVertical({
        y1: yT_left,
        y2: yB_right,
        x: cxSection + r2Px,
        xDim: cxSection + r2Px + 25,
        text: `h ≈ ${format(thickS * 1.6)}`,
        colors
      }) : ''}

      <!-- Outer Diameter Dimension -->
      ${drawLinearHorizontal({
        x1: cxSection - r2Px,
        x2: cxSection + r2Px,
        y: yB_right,
        yDim: yB_right + 30,
        text: `Ø ${format(outerD)} мм`,
        colors
      })}

      <!-- ================= TOP VIEW ================= -->
      <!-- Split Spring Washer Arc -->
      <path d="M ${pOuterStart} A ${n(r2Px)} ${n(r2Px)} 0 1 0 ${pOuterEnd} L ${pInnerEnd} A ${n(r1Px)} ${n(r1Px)} 0 1 1 ${pInnerStart} Z" fill="${colors.panelFill || 'none'}" stroke="${colors.line}" stroke-width="1.8" />

      <!-- 15 Degree Lock Cut Guide Line -->
      <line x1="${n(cxTop)}" y1="${n(cyTop)}" x2="${n(cxTop + (r2Px + 15) * Math.cos(cutAngleRad))}" y2="${n(cyTop - (r2Px + 15) * Math.sin(cutAngleRad))}" stroke="${colors.dim}" stroke-width="0.8" stroke-dasharray="3,2" />
      <text x="${n(cxTop + (r2Px + 18) * Math.cos(cutAngleRad))}" y="${n(cyTop - (r2Px + 18) * Math.sin(cutAngleRad))}" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="600" fill="${colors.dimText}">15°</text>

      <!-- Centerlines Top View -->
      ${drawCenterline(cxTop - r2Px - 16, cyTop, cxTop + r2Px + 16, cyTop, colors)}
      ${drawCenterline(cxTop, cyTop - r2Px - 16, cxTop, cyTop + r2Px + 16, colors)}

      <!-- Inner & Outer Callout -->
      <text x="${n(cxTop)}" y="${n(cyTop + r2Px + 24)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.dimText}">Гровер ${format(nomD)} (Ø${format(innerD)} × Ø${format(outerD)} × ${format(thickS)})</text>
    `;

    return wrapSvg({
      width: viewW,
      height: viewH,
      content,
      themeColors: colors,
      title: `Шайба пружинна ${format(nomD)} (d1=${format(innerD)}, d2=${format(outerD)}, s=${format(thickS)})`
    });
  }

  /**
   * 4. ШАБЛОН: Профіль метричної різьби 60° (ГОСТ 24705-2004, ГОСТ 8724-2002)
   */
  function renderThread({ d, coarsePitchMm, pitchesMm, colors, selectedPitchMm, theoreticalHeightMm }) {
    const nomD = n(d, 24);
    const pitch = n(selectedPitchMm ?? coarsePitchMm, 3);
    const pitches = Array.isArray(pitchesMm) && pitchesMm.length ? pitchesMm : [pitch];

    const viewW = 560;
    const viewH = 340;

    // Геометрія метричного трикутного профілю різьби 60°
    const pitchPx = selectedPitchMm == null ? 76 : 34 + 42 * pitch / (coarsePitchMm || pitch);
    const heightH = (Math.sqrt(3) / 2) * pitchPx; // теоретична висота трикутника H
    const truncCrest = heightH / 8; // зріз вершини H/8
    const truncRoot = heightH / 4; // зріз западини H/4

    const startX = 60;
    const yCrest = 85;
    const yRoot = yCrest + (heightH - truncCrest - truncRoot);

    // Побудова 3-х повних витків профілю
    let profilePath = `M ${n(startX - 15)} ${n(yRoot)}`;
    for (let i = 0; i < 3; i++) {
      const toothStart = startX + i * pitchPx;
      const xLeftRoot = toothStart + (truncRoot / heightH) * (pitchPx / 2);
      const xPeakLeft = toothStart + pitchPx / 2 - (truncCrest / heightH) * (pitchPx / 2);
      const xPeakRight = toothStart + pitchPx / 2 + (truncCrest / heightH) * (pitchPx / 2);
      const xRightRoot = toothStart + pitchPx - (truncRoot / heightH) * (pitchPx / 2);

      profilePath += ` L ${n(xLeftRoot)} ${n(yRoot)} L ${n(xPeakLeft)} ${n(yCrest)} L ${n(xPeakRight)} ${n(yCrest)} L ${n(xRightRoot)} ${n(yRoot)}`;
    }
    profilePath += ` L ${n(startX + 3 * pitchPx + 15)} ${n(yRoot)} L ${n(startX + 3 * pitchPx + 15)} ${n(yRoot + 45)} L ${n(startX - 15)} ${n(yRoot + 45)} Z`;

    const tooth1_crest = startX + pitchPx / 2;
    const tooth2_crest = tooth1_crest + pitchPx;

    const content = `
      <!-- Title -->
      <text x="280" y="36" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="13" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ТЕОРЕТИЧНИЙ ПРОФІЛЬ МЕТРИЧНОЇ РІЗЬБИ 60° (ДСТУ / ГОСТ 24705)</text>

      <!-- Hatched Solid Body of Thread -->
      <path d="${profilePath}" fill="url(#__HATCH_ID__)" stroke="${colors.line}" stroke-width="2" />

      <!-- Theoretical Triangular Envelopes (Dashed) -->
      <line x1="${n(startX + pitchPx / 2)}" y1="${n(yCrest - truncCrest)}" x2="${n(startX + pitchPx)}" y2="${n(yRoot + truncRoot)}" stroke="${colors.threadThin}" stroke-width="0.9" stroke-dasharray="3,2" />
      <line x1="${n(startX + pitchPx)}" y1="${n(yRoot + truncRoot)}" x2="${n(startX + 1.5 * pitchPx)}" y2="${n(yCrest - truncCrest)}" stroke="${colors.threadThin}" stroke-width="0.9" stroke-dasharray="3,2" />

      <!-- Pitch Dimension P -->
      ${drawLinearHorizontal({
        x1: tooth1_crest,
        x2: tooth2_crest,
        y: yCrest,
        yDim: yCrest - 25,
        text: `P = ${format(pitch)} мм`,
        colors
      })}

      <!-- Flank Angle 60° Arc & Label -->
      <path d="M ${n(tooth1_crest + 18)} ${n(yCrest + 26)} A 22 22 0 0 1 ${n(tooth1_crest + 30)} ${n(yCrest + 42)}" fill="none" stroke="${colors.dim}" stroke-width="1.2" />
      <text x="${n(tooth1_crest + 36)}" y="${n(yCrest + 36)}" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.dimText}">60°</text>

      <!-- Axis of symmetry of thread profile (Dash-dot) -->
      ${drawCenterline(startX - 20, yRoot + 60, startX + 3 * pitchPx + 20, yRoot + 60, colors)}
      <text x="${n(startX + 3 * pitchPx + 30)}" y="${n(yRoot + 64)}" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="600" fill="${colors.axis}">Вісь різьби</text>

      <!-- Side Data Card -->
      <g transform="translate(340, 75)">
        <rect width="195" height="185" rx="6" fill="${colors.cardBg || 'rgba(0,0,0,0.1)'}" stroke="${colors.cardBorder || colors.dim}" stroke-width="0.8" />
        <text x="14" y="24" font-family="'Segoe UI', system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.dimText}">Параметри різьби М${format(nomD)}:</text>
        
        <text x="14" y="52" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.line}">• Номінальний d: <tspan font-weight="700" fill="${colors.dimText}">${format(nomD)} мм</tspan></text>
        <text x="14" y="74" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.line}">• ${selectedPitchMm == null ? 'Великий' : 'Обраний'} крок P: <tspan font-weight="700" fill="${colors.dimText}">${format(pitch)} мм</tspan></text>
        <text x="14" y="96" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="600" fill="${colors.line}">• Дрібні кроки:</text>
        <text x="24" y="116" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="${colors.dimText}">${pitches.map(format).join(' · ')} мм</text>

        <line x1="14" y1="132" x2="181" y2="132" stroke="${colors.lineThin}" stroke-width="0.5" stroke-dasharray="2,2" />

        <text x="14" y="152" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="500" fill="${colors.lineThin}">${theoreticalHeightMm == null ? 'Теоретична висота:' : 'Теоретична висота · Розраховано'}</text>
        <text x="14" y="168" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="700" fill="${colors.dimText}">H = (√3 / 2) · P = ${format(theoreticalHeightMm ?? Math.sqrt(3) * pitch / 2)} мм</text>
      </g>
    `;

    return wrapSvg({
      width: viewW,
      height: viewH,
      content,
      themeColors: colors,
      title: `Профіль різьби М${format(nomD)} (P=${format(pitch)} мм)`
    });
  }

  /**
   * 5. ШАБЛОН: Інфографічна шкала моментів затягування (Таблиця 1)
   */
  function renderTorque({ d, minNm, maxNm, minKgfM, maxKgfM, colors }) {
    const nomD = n(d, 24);
    const lowNm = n(minNm, 320);
    const highNm = n(maxNm, 360);
    const lowKgf = n(minKgfM, lowNm / 10);
    const highKgf = n(maxKgfM, highNm / 10);

    const viewW = 560;
    const viewH = 340;

    // Масштабування шкали: від 0 до maxNm * 1.35
    const maxScaleNm = Math.ceil((highNm * 1.35) / 50) * 50;
    const barStartX = 70;
    const barEndX = 490;
    const barW = barEndX - barStartX;
    const barY = 160;

    function xFor(val) {
      return barStartX + (Math.max(0, Math.min(val, maxScaleNm)) / maxScaleNm) * barW;
    }

    const xMin = xFor(lowNm);
    const xMax = xFor(highNm);
    const midNm = Math.round((lowNm + highNm) / 2);

    // Кроки сітки
    const stepCount = 5;
    const stepVal = maxScaleNm / stepCount;
    const ticks = [];
    for (let i = 0; i <= stepCount; i++) {
      const v = Math.round(i * stepVal);
      const xt = xFor(v);
      ticks.push(`
        <line x1="${n(xt)}" y1="${n(barY - 8)}" x2="${n(xt)}" y2="${n(barY + 20)}" stroke="${colors.lineThin}" stroke-width="0.8" />
        <text x="${n(xt)}" y="${n(barY + 34)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="600" fill="${colors.lineThin}">${format(v)}</text>
      `);
    }

    const content = `
      <!-- Title -->
      <text x="280" y="36" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="13" font-weight="700" fill="${colors.lineThin}" letter-spacing="0.5">ДОПУСТИМИЙ МОМЕНТ ЗАТЯГУВАННЯ КРІПЛЕННЯ М${format(nomD)}</text>

      <!-- KPI Summary Header Cards -->
      <g transform="translate(60, 52)">
        <rect x="0" y="0" width="205" height="60" rx="6" fill="${colors.cardBg || 'rgba(0,0,0,0.1)'}" stroke="${colors.dim}" stroke-width="0.8" />
        <text x="16" y="22" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="600" fill="${colors.lineThin}">МОМЕНТ (Н·м):</text>
        <text x="16" y="47" font-family="'Segoe UI', system-ui, sans-serif" font-size="20" font-weight="800" fill="${colors.dimText}">${format(lowNm)} … ${format(highNm)} <tspan font-size="12" font-weight="600">Н·м</tspan></text>
      </g>

      <g transform="translate(295, 52)">
        <rect x="0" y="0" width="205" height="60" rx="6" fill="${colors.cardBg || 'rgba(0,0,0,0.1)'}" stroke="${colors.dim}" stroke-width="0.8" />
        <text x="16" y="22" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="600" fill="${colors.lineThin}">МОМЕНТ (кгс·м):</text>
        <text x="16" y="47" font-family="'Segoe UI', system-ui, sans-serif" font-size="20" font-weight="800" fill="${colors.dimText}">${format(lowKgf)} … ${format(highKgf)} <tspan font-size="12" font-weight="600">кгс·м</tspan></text>
      </g>

      <!-- Main Scale Track (0..max) -->
      <rect x="${n(barStartX)}" y="${n(barY)}" width="${n(barW)}" height="12" rx="6" fill="${colors.trackBg || 'rgba(100,116,139,0.2)'}" stroke="${colors.lineThin}" stroke-width="1" />

      <!-- Active Permissible Torque Zone -->
      <rect x="${n(xMin)}" y="${n(barY - 3)}" width="${n(Math.max(xMax - xMin, 6))}" height="18" rx="4" fill="${colors.accentZone || colors.dim}" stroke="${colors.dimText}" stroke-width="1.5" />

      <!-- Scale Ticks -->
      ${ticks.join('')}

      <!-- Target Marker (Midpoint) -->
      <line x1="${n((xMin + xMax) / 2)}" y1="${n(barY - 24)}" x2="${n((xMin + xMax) / 2)}" y2="${n(barY + 14)}" stroke="${colors.axis}" stroke-width="2" />
      <polygon points="${n((xMin + xMax) / 2)},${n(barY - 2)} ${n((xMin + xMax) / 2 - 5)},${n(barY - 10)} ${n((xMin + xMax) / 2 + 5)},${n(barY - 10)}" fill="${colors.axis}" />

      <!-- Min & Max Indicators -->
      <text x="${n(xMin)}" y="${n(barY - 12)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="${colors.dimText}">min: ${format(lowNm)}</text>
      <text x="${n(xMax)}" y="${n(barY - 12)}" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="${colors.dimText}">max: ${format(highNm)}</text>

      <!-- Bottom Guidance Legend -->
      <g transform="translate(60, 240)">
        <rect x="0" y="0" width="440" height="70" rx="6" fill="${colors.cardBg || 'rgba(0,0,0,0.1)'}" stroke="${colors.lineThin}" stroke-width="0.5" />
        <circle cx="24" cy="24" r="6" fill="${colors.accentZone || colors.dim}" />
        <text x="38" y="28" font-family="'Segoe UI', system-ui, sans-serif" font-size="11" font-weight="700" fill="${colors.dimText}">Рекомендований діапазон контрольованого затягування різьби М${format(nomD)}</text>
        <text x="38" y="48" font-family="'Segoe UI', system-ui, sans-serif" font-size="10" font-weight="500" fill="${colors.lineThin}">Забезпечує щільність з'єднання без ризику пластичної деформації тіла болта/шпильки.</text>
      </g>
    `;

    return wrapSvg({
      width: viewW,
      height: viewH,
      content,
      themeColors: colors,
      title: `Момент затягування М${format(nomD)} (${format(lowNm)}..${format(highNm)} Н·м)`
    });
  }

  return {
    renderHexNut,
    renderCappedNut,
    renderWasher,
    renderSpringWasher,
    renderThread,
    renderTorque
  };
});
