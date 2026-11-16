// Visual renderers adapted from the user-provided code_artifact (1).html.
// Dimensions supplied by the gallery. Additional length and wrench sizes are demo values.
(function(root) {
    function buildFastenerGeometry(cx, topY, botY, halfW, pitchPx, threadLenPx, threadAtTop = true) {
      const chamfer = Math.min(5.5, halfW * 0.24);
      const toothDepth = Math.min(3.8, Math.max(2.0, pitchPx * 0.34));
      const step = Math.max(5.5, Math.min(10.5, pitchPx * 2.4));

      const t1End = topY + threadLenPx;
      const t2Start = botY - threadLenPx;

      let leftPath = `M ${cx - halfW} ${topY} H ${cx + halfW}`;

      // Правий бік — верхня різьба
      let y = topY + chamfer;
      if (threadAtTop) {
        leftPath = `M ${cx - halfW + chamfer} ${topY} L ${cx + halfW - chamfer} ${topY} L ${cx + halfW} ${topY + chamfer}`;
        while (y + step <= t1End) {
          const yMid1 = y + step * 0.42;
          const yMid2 = y + step * 0.58;
          const yNext = y + step;
          leftPath += ` L ${cx + halfW - toothDepth} ${yMid1.toFixed(1)} L ${cx + halfW - toothDepth} ${yMid2.toFixed(1)} L ${cx + halfW} ${yNext.toFixed(1)}`;
          y = yNext;
        }
        // Збіг верхньої різьби (плавний вихід зуба)
        leftPath += ` L ${cx + halfW - toothDepth * 0.45} ${(y + step * 0.45).toFixed(1)} L ${cx + halfW} ${(y + step * 0.9).toFixed(1)}`;
      }

      // Гладкий циліндричний стрижень по правому краю
      const runoutBotY = t2Start - step * 0.9;
      leftPath += ` L ${cx + halfW} ${runoutBotY.toFixed(1)}`;
      leftPath += ` L ${cx + halfW - toothDepth * 0.45} ${(t2Start - step * 0.45).toFixed(1)} L ${cx + halfW} ${t2Start.toFixed(1)}`;

      // Правий бік — нижня різьба
      y = t2Start;
      while (y + step <= botY - chamfer) {
        const yMid1 = y + step * 0.42;
        const yMid2 = y + step * 0.58;
        const yNext = y + step;
        leftPath += ` L ${cx + halfW - toothDepth} ${yMid1.toFixed(1)} L ${cx + halfW - toothDepth} ${yMid2.toFixed(1)} L ${cx + halfW} ${yNext.toFixed(1)}`;
        y = yNext;
      }

      // Нижня фаска
      leftPath += ` L ${cx + halfW} ${botY - chamfer} L ${cx + halfW - chamfer} ${botY} L ${cx - halfW + chamfer} ${botY} L ${cx - halfW} ${botY - chamfer}`;

      // Лівий бік — нижня різьба (знизу вгору, зі зміщенням півкроку як у справжньої різьби)
      y = botY - chamfer;
      while (y - step >= t2Start) {
        const yMid1 = y - step * 0.42;
        const yMid2 = y - step * 0.58;
        const yNext = y - step;
        leftPath += ` L ${cx - halfW + toothDepth} ${yMid1.toFixed(1)} L ${cx - halfW + toothDepth} ${yMid2.toFixed(1)} L ${cx - halfW} ${yNext.toFixed(1)}`;
        y = yNext;
      }
      leftPath += ` L ${cx - halfW + toothDepth * 0.45} ${(y - step * 0.45).toFixed(1)} L ${cx - halfW} ${(y - step * 0.9).toFixed(1)}`;

      // Гладкий циліндричний стрижень по лівому краю
      const runoutTopY = t1End + step * 0.9;
      if (threadAtTop) {
        leftPath += ` L ${cx - halfW} ${runoutTopY.toFixed(1)}`;
        leftPath += ` L ${cx - halfW + toothDepth * 0.45} ${(t1End + step * 0.45).toFixed(1)} L ${cx - halfW} ${t1End.toFixed(1)}`;
        y = t1End;
        while (y - step >= topY + chamfer) {
          const yMid1 = y - step * 0.42;
          const yMid2 = y - step * 0.58;
          const yNext = y - step;
          leftPath += ` L ${cx - halfW + toothDepth} ${yMid1.toFixed(1)} L ${cx - halfW + toothDepth} ${yMid2.toFixed(1)} L ${cx - halfW} ${yNext.toFixed(1)}`;
          y = yNext;
        }
        leftPath += ` L ${cx - halfW} ${topY + chamfer}`;
      }
      leftPath += ' Z';

      // Гвинтові лінії витків усередині контуру
      let threadLines = '';
      for (let yy = topY + chamfer + step * 0.5; threadAtTop && yy < t1End; yy += step) {
        threadLines += `M ${cx - halfW + 1} ${(yy + step * 0.35).toFixed(1)} L ${cx + halfW - 1} ${(yy - step * 0.15).toFixed(1)} `;
      }
      for (let yy = t2Start + step * 0.5; yy < botY - chamfer; yy += step) {
        threadLines += `M ${cx - halfW + 1} ${(yy + step * 0.35).toFixed(1)} L ${cx + halfW - 1} ${(yy - step * 0.15).toFixed(1)} `;
      }

      return {
        bodyPath: leftPath,
        threadLines,
        chamfer,
        toothDepth,
        step,
        t1End,
        t2Start,
        runoutTopY,
        runoutBotY
      };
    }

    /**
     * Генерує проекційні координати шестигранника (вид на 3 грані, пропорції E/4 : E/2 : E/4)
     * та математично коректні дуги гіпербол перетину конуса фаски з гранями.
     */
    function buildHexNutMetrics(cx, baseY, d, nutType, spec) {
      const halfE = 56 + d * 0.68;      // E/2 описаного кола шестигранника
      const edgeX = halfE * 0.5;        // E/4 — внутрішні вертикальні ребра граней
      const heightMm = nutType === 'B' ? spec.nutCapH : spec.nutM;
      const hPx = nutType === 'B' ? (68 + spec.nutCapH * 1.15) : (52 + spec.nutM * 1.45);
      const topY = baseY - hPx;
      const chamferDrop = Math.max(8, halfE * 0.14);
      const centerArcDip = chamferDrop * 0.42;

      return {
        spec,
        cx,
        baseY,
        topY,
        hPx,
        halfE,
        threadRadius: 13 + d * 0.56,
        edgeX,
        chamferDrop,
        centerArcDip,
        heightMm,
        isCapped: nutType === 'B'
      };
    }


    // Умовні пропорції головки для обох проєкцій болта та схеми з’єднання.
    function boltMetrics(d) {
      const shankRadius = Math.min(43, 28 + d * .25);
      return {shankRadius, headRadius: shankRadius * 1.8, headHeight: shankRadius * 1.3};
    }

    function boltHead(cx, top, radius, shoulder, steel = 'v5-steel') {
      const edge = radius / 2, flat = radius * Math.cos(Math.PI / 6), bevel = top + radius * .16;
      return `<path d="M ${cx-flat} ${top} H ${cx+flat} L ${cx+radius} ${bevel} V ${shoulder} H ${cx-radius} V ${bevel} Z" fill="url(#${steel})" stroke-width="2"/>
            <path d="M ${cx+edge} ${bevel} Q ${cx+1.5*edge} ${top} ${cx+radius} ${bevel} V ${shoulder} H ${cx+edge} Z" fill="#2b434f" fill-opacity=".13" stroke="none"/>
            <path d="M ${cx-radius} ${bevel} Q ${cx-1.5*edge} ${top} ${cx-edge} ${bevel} Q ${cx} ${top-3} ${cx+edge} ${bevel} Q ${cx+1.5*edge} ${top} ${cx+radius} ${bevel}
                     M ${cx-edge} ${bevel} V ${shoulder} M ${cx+edge} ${bevel} V ${shoulder}" fill="none" stroke-width="1.25"/>`;
    }

    function nutSide(m, steel = 'v5-steel', hatch = 'v5-hatch') {
      const {cx,baseY,topY,halfE,edgeX,chamferDrop,centerArcDip,isCapped} = m;
      const bodyTopY = isCapped ? topY + m.hPx * 0.44 : topY;
      const rMinor = m.threadRadius;
      const rMajor = rMinor + 4;

      // Зубчики внутрішньої різьби на правій половині розрізу
      let innerTeeth = `M ${cx + rMajor} ${bodyTopY + 6}`;
      for (let yy = bodyTopY + 6; yy < baseY - 10; yy += 7) {
        innerTeeth += ` L ${cx + rMinor} ${(yy + 3.5).toFixed(1)} L ${cx + rMajor} ${(yy + 7).toFixed(1)}`;
      }

      return `<!-- ЛІВА ПОЛОВИНА: зовнішній вигляд шестигранника -->
          <path d="M ${cx} ${bodyTopY} H ${cx - halfE + 10} L ${cx - halfE} ${bodyTopY + chamferDrop} V ${baseY - 6} L ${cx - halfE + 7} ${baseY} H ${cx}" fill="url(#${steel})" stroke="#2b434f" stroke-width="2" stroke-linejoin="round"/>
          <line x1="${cx - edgeX}" y1="${bodyTopY + chamferDrop}" x2="${cx - edgeX}" y2="${baseY}" stroke="#2b434f" stroke-width="1.3"/>
          <path d="M ${cx - halfE} ${bodyTopY + chamferDrop} Q ${cx - (halfE + edgeX) / 2} ${bodyTopY + chamferDrop * 0.35} ${cx - edgeX} ${bodyTopY + chamferDrop} Q ${cx - edgeX * 0.5} ${bodyTopY + centerArcDip} ${cx} ${bodyTopY + centerArcDip}" fill="none" stroke="#2b434f" stroke-width="1.3"/>

          <!-- ПРАВА ПОЛОВИНА: розріз гайки зі штрихуванням сталі під 45° -->
          <path d="${innerTeeth} L ${cx + rMajor + 4} ${baseY} H ${cx + halfE - 7} L ${cx + halfE} ${baseY - 6} V ${bodyTopY + chamferDrop} L ${cx + halfE - 10} ${bodyTopY} H ${cx + rMajor + 4} Z" fill="url(#${hatch})" stroke="#2b434f" stroke-width="2" stroke-linejoin="round"/>
          <!-- Лінія западин внутрішньої різьби (тонка суцільна за ЄСКД) -->
          <line x1="${cx + rMajor}" y1="${bodyTopY + 5}" x2="${cx + rMajor}" y2="${baseY - 5}" stroke="#2b434f" stroke-width="1.1"/>

          <!-- Ковпачок для Виконання Б (зліва вигляд, справа розріз глухого отвору) -->
          ${isCapped ? `
            <path d="M ${cx} ${topY} Q ${cx - halfE + 10} ${topY} ${cx - halfE + 10} ${bodyTopY} H ${cx}" fill="url(#${steel})" stroke="#2b434f" stroke-width="2"/>
            <path d="M ${cx} ${topY} Q ${cx + halfE - 10} ${topY} ${cx + halfE - 10} ${bodyTopY} H ${cx + rMajor + 4} V ${bodyTopY - 12} H ${cx} Z" fill="url(#${hatch})" stroke="#2b434f" stroke-width="2"/>
          ` : ''}`;
    }

    function steelGradient(id) {
      return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#7c939d"/><stop offset="22%" stop-color="#c6d5da"/>
        <stop offset="40%" stop-color="#f2f7f8"/><stop offset="70%" stop-color="#b4c5cb"/>
        <stop offset="100%" stop-color="#788f99"/>
      </linearGradient>`;
    }
    function steelHatch(id, scale = 1) {
      return `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="scale(${scale})">
        <rect width="7" height="7" fill="#dce6e8"/>
        <path d="M-2 2 l4 -4 M0 7 l7 -7 M5 9 l4 -4" stroke="#415b66" stroke-width="1"/>
      </pattern>`;
    }
    root.PassportProfiles = {boltMetrics, boltHead, nutSide, buildHexNutMetrics, buildFastenerGeometry, steelGradient, steelHatch};

root.ImportedComponentStyles = function(style,key,part,pitch) {
 const fmt = n => Number(n).toLocaleString('uk-UA',{maximumFractionDigits:2});
 const diameter = part.diameter || part.outer;
 const GOST_DB = {[diameter]:{studLength:part.length ?? '—',threadEnd:'—',nutS:part.acrossFlats ?? '—',nutM:part.h,nutCapH:part.h,washerD1:part.inner,washerD2:part.outer,washerS:part.h}};
     const RenderV1 = {
      stud(d, p, count) {
        const spec = GOST_DB[d];
        const cx = 225, topY = 30, botY = 292;
        const halfW = 15 + d * 0.62;
        const step = Math.max(6, Math.min(10, p * 2.5));
        const g = buildFastenerGeometry(cx, topY, botY, halfW, p, 74);

        // Збільшений фрагмент різьби справа
        const zx = 432, zy = 148, zPitch = 28, zDepth = 15;
        let zoomProfile = `M ${zx - 46} ${zy - zPitch * 1.5} H ${zx}`;
        for (let i = -1; i <= 1; i++) {
          const y0 = zy + i * zPitch;
          zoomProfile += ` L ${zx - zDepth} ${(y0 + zPitch * 0.42).toFixed(1)} L ${zx - zDepth} ${(y0 + zPitch * 0.58).toFixed(1)} L ${zx} ${(y0 + zPitch).toFixed(1)}`;
        }
        zoomProfile += ` H ${zx - 46} Z`;

        return `
          <defs>
            <linearGradient id="v1-shaft" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#8aa0ab"/>
              <stop offset="22%" stop-color="#d8e3e7"/>
              <stop offset="40%" stop-color="#f5f9fa"/>
              <stop offset="72%" stop-color="#b8c9d0"/>
              <stop offset="100%" stop-color="#7c939e"/>
            </linearGradient>
            <marker id="v1-arr" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L8 3 L0 6 Z" fill="#006d73"/>
            </marker>
          </defs>
          <!-- Осьова лінія (0.8px) -->
          <line x1="${cx}" y1="14" x2="${cx}" y2="308" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="14 3 2 3"/>

          <!-- Основне тіло шпильки з градієнтом (основний контур 2.2px) -->
          <path d="${g.bodyPath}" fill="url(#v1-shaft)" stroke="#1e293b" stroke-width="2.2" stroke-linejoin="round"/>

          <!-- Лінії переходів торцевих фасок та збігу різьби (1.2px) -->
          <g stroke="#334155" stroke-width="1.15" fill="none">
            <line x1="${cx - halfW}" y1="${topY + g.chamfer}" x2="${cx + halfW}" y2="${topY + g.chamfer}"/>
            <line x1="${cx - halfW}" y1="${botY - g.chamfer}" x2="${cx + halfW}" y2="${botY - g.chamfer}"/>
            <line x1="${cx - halfW}" y1="${g.t1End}" x2="${cx + halfW}" y2="${g.t1End}"/>
            <line x1="${cx - halfW}" y1="${g.t2Start}" x2="${cx + halfW}" y2="${g.t2Start}"/>
            <path d="${g.threadLines}" stroke="#475569" stroke-width="0.95"/>
          </g>

          <!-- Виносна лінія до профілю різьби -->
          <path d="M ${cx + halfW + 2} 72 L 352 106 H 382" fill="none" stroke="#006d73" stroke-width="0.9" stroke-dasharray="4 3"/>
          <text x="386" y="88" fill="#435b66" font-size="13" font-weight="600">Профіль різьби, збільшено</text>
          <path d="${zoomProfile}" fill="url(#v1-shaft)" stroke="#1e293b" stroke-width="2.1" stroke-linejoin="round"/>
          <!-- Лінії середнього та внутрішнього діаметрів на виносці -->
          <line x1="${zx - zDepth}" y1="${zy - zPitch * 1.6}" x2="${zx - zDepth}" y2="${zy + zPitch * 2.1}" stroke="#0284c7" stroke-width="0.8" stroke-dasharray="6 3"/>

          <!-- Інтерактивні розміри -->
          <g class="svg-interactive" data-tip-title="Діаметр різьби М${d}" data-tip-body="Номінальний зовнішній діаметр d = ${d} мм за ГОСТ 24705-2004. Кількість у вузлі: ${count} шт.">
            <line class="dim-line" x1="${cx - halfW}" y1="292" x2="${cx - halfW}" y2="336" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx + halfW}" y1="292" x2="${cx + halfW}" y2="336" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx - halfW}" y1="327" x2="${cx + halfW}" y2="327" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr)" marker-end="url(#v1-arr)"/>
            <text class="dim-text" x="${cx}" y="319" text-anchor="middle" fill="#005f66" font-size="16" font-weight="700">М${d}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Крок різьби P = ${fmt(p)} мм" data-tip-body="Великий крок метричної різьби за ГОСТ 8724-2002 (кут профілю 60°).">
            <line class="dim-line" x1="${zx + 4}" y1="${zy}" x2="${zx + 46}" y2="${zy}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${zx + 4}" y1="${zy + zPitch}" x2="${zx + 46}" y2="${zy + zPitch}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${zx + 38}" y1="${zy}" x2="${zx + 38}" y2="${zy + zPitch}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr)" marker-end="url(#v1-arr)"/>
            <text class="dim-text" x="${zx + 50}" y="${zy + zPitch * 0.5 + 5}" fill="#005f66" font-size="15.5" font-weight="700">P = ${fmt(p)}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Довжина шпильки L = ${spec.studLength} мм" data-tip-body="Розрахункова довжина шпильки за ГОСТ 22032-76 / ГОСТ 9066-75 під пакет фланця.">
            <line class="dim-line" x1="${cx - halfW}" y1="${topY}" x2="108" y2="${topY}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx - halfW}" y1="${botY}" x2="108" y2="${botY}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="118" y1="${topY}" x2="118" y2="${botY}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr)" marker-end="url(#v1-arr)"/>
            <text class="dim-text" transform="translate(107 ${(topY + botY) / 2}) rotate(-90)" text-anchor="middle" fill="#005f66" font-size="15.5" font-weight="700">L = ${spec.studLength}</text>
          </g>
        `;
      },

      nut(d, nutType) {
        const m = buildHexNutMetrics(215, 250, d, nutType, GOST_DB[d]);
        const { cx, baseY, topY, halfE, edgeX, chamferDrop, centerArcDip, spec, isCapped } = m;

        // Контур 3 граней шестигранника
        const bodyTopY = isCapped ? topY + m.hPx * 0.44 : topY;
        const leftFace = `M ${cx - halfE} ${baseY - 6} V ${bodyTopY + chamferDrop} L ${cx - edgeX} ${bodyTopY + chamferDrop} V ${baseY} L ${cx - halfE + 7} ${baseY} Z`;
        const centerFace = `M ${cx - edgeX} ${bodyTopY + chamferDrop} Q ${cx} ${bodyTopY + centerArcDip} ${cx + edgeX} ${bodyTopY + chamferDrop} V ${baseY} H ${cx - edgeX} Z`;
        const rightFace = `M ${cx + edgeX} ${bodyTopY + chamferDrop} L ${cx + halfE} ${bodyTopY + chamferDrop} V ${baseY - 6} L ${cx + halfE - 7} ${baseY} H ${cx + edgeX} Z`;

        // Верхня фаска або сферичний ковпачок
        const crown = isCapped
          ? `<path d="M ${cx - halfE} ${bodyTopY + chamferDrop} L ${cx - halfE + 9} ${bodyTopY - 4} Q ${cx - halfE + 9} ${topY} ${cx} ${topY} Q ${cx + halfE - 9} ${topY} ${cx + halfE - 9} ${bodyTopY - 4} L ${cx + halfE} ${bodyTopY + chamferDrop} Q ${cx + (halfE + edgeX) / 2} ${bodyTopY + chamferDrop * 0.4} ${cx + edgeX} ${bodyTopY + chamferDrop} Q ${cx} ${bodyTopY + centerArcDip} ${cx - edgeX} ${bodyTopY + chamferDrop} Q ${cx - (halfE + edgeX) / 2} ${bodyTopY + chamferDrop * 0.4} ${cx - halfE} ${bodyTopY + chamferDrop} Z" fill="url(#v1-nut-top)" stroke="#1e293b" stroke-width="2.1" stroke-linejoin="round"/>`
          : `<path d="M ${cx - halfE} ${topY + chamferDrop} L ${cx - halfE + 11} ${topY} H ${cx + halfE - 11} L ${cx + halfE} ${topY + chamferDrop} Q ${cx + (halfE + edgeX) / 2} ${topY + chamferDrop * 0.35} ${cx + edgeX} ${topY + chamferDrop} Q ${cx} ${topY + centerArcDip} ${cx - edgeX} ${topY + chamferDrop} Q ${cx - (halfE + edgeX) / 2} ${topY + chamferDrop * 0.35} ${cx - halfE} ${topY + chamferDrop} Z" fill="url(#v1-nut-top)" stroke="#1e293b" stroke-width="2.1" stroke-linejoin="round"/>`;

        // Вид зверху / з боку різьби (справа)
        const rcx = 468, rcy = 172, rOuter = halfE * 0.96;
        const hexPts = Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return `${(rcx + rOuter * Math.cos(a)).toFixed(1)},${(rcy + rOuter * Math.sin(a)).toFixed(1)}`;
        }).join(' ');
        const rChamfer = rOuter * 0.85;
        const rThreadMajor = rOuter * 0.56;
        const rThreadMinor = rOuter * 0.46;

        return `
          <defs>
            <linearGradient id="v1-nut-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#879da8"/><stop offset="100%" stop-color="#b4c6ce"/>
            </linearGradient>
            <linearGradient id="v1-nut-center" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#d5e1e6"/><stop offset="35%" stop-color="#f3f8f9"/><stop offset="100%" stop-color="#c3d3da"/>
            </linearGradient>
            <linearGradient id="v1-nut-right" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#9fb3bd"/><stop offset="100%" stop-color="#768d98"/>
            </linearGradient>
            <linearGradient id="v1-nut-top" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#eef5f7"/><stop offset="100%" stop-color="#9cb0ba"/>
            </linearGradient>
            <marker id="v1-arr2" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L8 3 L0 6 Z" fill="#006d73"/>
            </marker>
          </defs>

          <!-- Грані шестигранника (CAD Shaded with Edges) -->
          <path d="${leftFace}" fill="url(#v1-nut-left)" stroke="#1e293b" stroke-width="2.1" stroke-linejoin="round"/>
          <path d="${centerFace}" fill="url(#v1-nut-center)" stroke="#1e293b" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="${rightFace}" fill="url(#v1-nut-right)" stroke="#1e293b" stroke-width="2.1" stroke-linejoin="round"/>
          ${crown}
          <!-- Нижня зовнішня лінія контуру 2.2px -->
          <line x1="${cx - halfE + 7}" y1="${baseY}" x2="${cx + halfE - 7}" y2="${baseY}" stroke="#1e293b" stroke-width="2.2"/>

          <!-- Осьова лінія -->
          <line x1="${cx}" y1="${topY - 16}" x2="${cx}" y2="${baseY + 18}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="14 3 2 3"/>

          <!-- Вид з торця (шестигранник + умовне зображення різьби за ЄСКД) -->
          <polygon points="${hexPts}" fill="url(#v1-nut-center)" stroke="#1e293b" stroke-width="2.2" stroke-linejoin="round"/>
          <circle cx="${rcx}" cy="${rcy}" r="${rChamfer.toFixed(1)}" fill="none" stroke="#334155" stroke-width="1.15"/>
          <circle cx="${rcx}" cy="${rcy}" r="${rThreadMinor.toFixed(1)}" fill="#f7faf9" stroke="#1e293b" stroke-width="2.0"/>
          <!-- Розімкнене коло зовнішнього діаметра внутрішньої різьби (3/4 кола) -->
          <path d="M ${rcx} ${(rcy - rThreadMajor).toFixed(1)} A ${rThreadMajor.toFixed(1)} ${rThreadMajor.toFixed(1)} 0 1 1 ${(rcx - rThreadMajor).toFixed(1)} ${rcy}" fill="none" stroke="#334155" stroke-width="1.0"/>
          <line x1="${rcx - rOuter - 12}" y1="${rcy}" x2="${rcx + rOuter + 12}" y2="${rcy}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="12 3 2 3"/>
          <line x1="${rcx}" y1="${rcy - rOuter - 12}" x2="${rcx}" y2="${rcy + rOuter + 12}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="12 3 2 3"/>

          <!-- Розміри -->
          <g class="svg-interactive" data-tip-title="Висота гайки ${isCapped ? 'H' : 'm'} = ${fmt(m.heightMm)} мм" data-tip-body="${isCapped ? 'Висота ковпачкової гайки за ГОСТ 11860-85' : 'Висота шестигранної гайки за ГОСТ 5915-70'}.">
            <line class="dim-line" x1="${cx - halfE + 10}" y1="${topY}" x2="92" y2="${topY}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx - halfE + 7}" y1="${baseY}" x2="92" y2="${baseY}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="102" y1="${topY}" x2="102" y2="${baseY}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr2)" marker-end="url(#v1-arr2)"/>
            <text class="dim-text" transform="translate(91 ${(topY + baseY) / 2}) rotate(-90)" text-anchor="middle" fill="#005f66" font-size="15.5" font-weight="700">${isCapped ? 'H' : 'm'} = ${fmt(m.heightMm)}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Розмір під ключ S = ${spec.nutS} мм" data-tip-body="Відстань між паралельними гранями шестигранника S = ${spec.nutS} мм.">
            <line class="dim-line" x1="${rcx - rChamfer}" y1="${rcy}" x2="${rcx - rChamfer}" y2="288" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${rcx + rChamfer}" y1="${rcy}" x2="${rcx + rChamfer}" y2="288" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${rcx - rChamfer}" y1="280" x2="${rcx + rChamfer}" y2="280" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr2)" marker-end="url(#v1-arr2)"/>
            <text class="dim-text" x="${rcx}" y="272" text-anchor="middle" fill="#005f66" font-size="15" font-weight="700">S = ${spec.nutS}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Внутрішня різьба М${d}" data-tip-body="Поле допуску 6H за ГОСТ 16093-2004.">
            <path class="dim-line" d="M ${rcx + rThreadMinor * 0.7} ${rcy - rThreadMinor * 0.7} L 538 72 H 586" fill="none" stroke="#006d73" stroke-width="1.1"/>
            <text class="dim-text" x="584" y="65" text-anchor="end" fill="#005f66" font-size="15.5" font-weight="700">М${d}</text>
          </g>

          <text x="${cx}" y="318" text-anchor="middle" fill="#435b66" font-size="13">Головний вигляд</text>
          <text x="${rcx}" y="318" text-anchor="middle" fill="#435b66" font-size="13">Вид з боку різьби</text>
        `;
      },

      gasket(od, id, thick, hasHoles, count, d) {
        const cx = 178, cy = 162, rOut = 122, rIn = rOut * (id / od);
        const holeD = part.holeDiameter || d + 3;
        const pcd = (rOut + rIn) / 2;
        const rHole = rOut * (holeD / od);

        let holesPath = '';
        if (hasHoles) {
          for (let i = 0; i < count; i++) {
            const a = (2 * Math.PI * i) / count - Math.PI / 2;
            const hx = cx + pcd * Math.cos(a), hy = cy + pcd * Math.sin(a);
            holesPath += `M ${hx - rHole} ${hy} a ${rHole} ${rHole} 0 1 0 ${2 * rHole} 0 a ${rHole} ${rHole} 0 1 0 ${-2 * rHole} 0 Z `;
          }
        }

        const ringPath = r => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
        const secX = 385, secY = 186, secW = 128, secH = 22 + thick * 7;
        const secTop = secY - secH;

        return `
          <defs>
            <linearGradient id="v1-gasket" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/>
            </linearGradient>
            <pattern id="v1-hatch-nonmetal" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="#475569"/>
              <path d="M-2 2 l4 -4 M0 8 l8 -8 M6 10 l4 -4 M-2 6 l4 4 M0 0 l8 8 M6 -2 l4 4" stroke="#cbd5e1" stroke-width="0.9"/>
            </pattern>
            <marker id="v1-arr3" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L8 3 L0 6 Z" fill="#006d73"/>
            </marker>
          </defs>

          <!-- Основне кільце прокладки -->
          <path d="${ringPath(rOut)} ${ringPath(rIn)} ${holesPath}" fill="url(#v1-gasket)" fill-rule="evenodd" stroke="#0f172a" stroke-width="2.1"/>
          <!-- Металева внутрішня обтюруюча обкантовка -->
          <circle cx="${cx}" cy="${cy}" r="${rIn + 2.5}" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
          ${hasHoles ? `<circle cx="${cx}" cy="${cy}" r="${pcd.toFixed(1)}" fill="none" stroke="#38bdf8" stroke-width="0.9" stroke-dasharray="10 3 2 3"/>` : ''}
          <line x1="${cx - rOut - 14}" y1="${cy}" x2="${cx + rOut + 14}" y2="${cy}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="14 3 2 3"/>
          <line x1="${cx}" y1="${cy - rOut - 14}" x2="${cx}" y2="${cy + rOut + 14}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="14 3 2 3"/>

          <!-- Радіальний переріз з металевим армуванням -->
          <text x="${secX}" y="84" fill="#435b66" font-size="13" font-weight="600">Умовний переріз</text>
          <rect x="${secX}" y="${secTop}" width="${secW}" height="${secH}" fill="url(#v1-hatch-nonmetal)" stroke="#0f172a" stroke-width="2.1"/>
          <!-- Металева обкантовка на внутрішньому торці перерізу -->
          <path d="M ${secX + 18} ${secTop} H ${secX} V ${secY} H ${secX + 18}" fill="none" stroke="#e2e8f0" stroke-width="3.2"/>
          <path d="M ${secX + 18} ${secTop} H ${secX} V ${secY} H ${secX + 18}" fill="none" stroke="#0f172a" stroke-width="1.1"/>
          <!-- Стрічка нержавіючої сталі в центрі перерізу -->
          <line x1="${secX + 4}" y1="${(secTop + secY) / 2}" x2="${secX + secW - 2}" y2="${(secTop + secY) / 2}" stroke="#f8fafc" stroke-width="2.0" stroke-dasharray="12 3"/>

          <!-- Розміри -->
          <g class="svg-interactive" data-tip-title="Внутрішній діаметр Ø${id} мм" data-tip-body="Прохідний отвір прокладки Dвн = ${id} мм.">
            <line class="dim-line" x1="${cx - rIn}" y1="${cy}" x2="${cx - rIn}" y2="215" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx + rIn}" y1="${cy}" x2="${cx + rIn}" y2="215" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx - rIn}" y1="207" x2="${cx + rIn}" y2="207" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr3)" marker-end="url(#v1-arr3)"/>
            <text class="dim-text" x="${cx}" y="199" text-anchor="middle" fill="#f8fafc" stroke="#1e293b" stroke-width="3" paint-order="stroke" font-size="14.5" font-weight="700">Ø${id}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Зовнішній діаметр Ø${od} мм" data-tip-body="Зовнішній габарит прокладки Dзовн = ${od} мм.">
            <line class="dim-line" x1="${cx - rOut}" y1="${cy}" x2="${cx - rOut}" y2="328" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx + rOut}" y1="${cy}" x2="${cx + rOut}" y2="328" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx - rOut}" y1="320" x2="${cx + rOut}" y2="320" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr3)" marker-end="url(#v1-arr3)"/>
            <text class="dim-text" x="${cx}" y="312" text-anchor="middle" fill="#005f66" font-size="15.5" font-weight="700">Ø${od}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Товщина прокладки h = ${thick} мм" data-tip-body="Початкова товщина до обтиснення фланцями.">
            <line class="dim-line" x1="${secX + secW}" y1="${secTop}" x2="${secX + secW + 34}" y2="${secTop}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX + secW}" y1="${secY}" x2="${secX + secW + 34}" y2="${secY}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX + secW + 25}" y1="${secTop}" x2="${secX + secW + 25}" y2="${secY}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr3)" marker-end="url(#v1-arr3)"/>
            <text class="dim-text" x="${secX + secW + 36}" y="${(secTop + secY) / 2 + 5}" fill="#005f66" font-size="15.5" font-weight="700">h = ${thick}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Ширина прокладки b₀ = ${fmt((od - id) / 2)} мм" data-tip-body="Реальна ширина поля прокладки: (Dзовн - Dвнутр) / 2 = ${fmt((od - id) / 2)} мм. Середній діаметр: Dср = ${fmt((od + id) / 2)} мм.">
            <line class="dim-line" x1="${secX}" y1="${secY}" x2="${secX}" y2="${secY + 34}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX + secW}" y1="${secY}" x2="${secX + secW}" y2="${secY + 34}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX}" y1="${secY + 26}" x2="${secX + secW}" y2="${secY + 26}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr3)" marker-end="url(#v1-arr3)"/>
            <text class="dim-text" x="${secX + secW / 2}" y="${secY + 44}" text-anchor="middle" fill="#005f66" font-size="15" font-weight="700">b₀ = ${fmt((od - id) / 2)}</text>
          </g>

          ${hasHoles ? `<text x="${secX}" y="264" fill="#435b66" font-size="13.5" font-weight="600">${count} отв. × Ø${holeD} мм</text>` : `<text x="${secX}" y="264" fill="#64748b" font-size="13">Без отворів під шпильки</text>`}
        `;
      },

      washer(d, exec) {
        const spec = GOST_DB[d];
        const cx = 185, cy = 165;
        const rOut = 114;
        const rIn = rOut * (spec.washerD1 / spec.washerD2);
        const hasChamfer = exec === '2';
        const rChamfer = rOut - (hasChamfer ? 9 : 0);

        const secX = 392, secY = 195, secW = 118, secH = 18 + spec.washerS * 5.2;
        const secTop = secY - secH;
        const chPx = hasChamfer ? Math.min(12, secH * 0.34) : 0;

        // Контур перерізу шайби (Вик. 1 — прямокутник, Вик. 2 — зі скосом фаски 45° на зовнішньому краї)
        const secPoly = hasChamfer
          ? `M ${secX} ${secTop} H ${secX + secW - chPx} L ${secX + secW} ${secTop + chPx} V ${secY} H ${secX} Z`
          : `M ${secX} ${secTop} H ${secX + secW} V ${secY} H ${secX} Z`;

        const ringPath = r => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

        return `
          <defs>
            <linearGradient id="v1-washer-face" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#f1f5f9"/><stop offset="45%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#94a3b8"/>
            </linearGradient>
            <pattern id="v1-hatch-steel" width="7" height="7" patternUnits="userSpaceOnUse">
              <rect width="7" height="7" fill="#e2e8f0"/>
              <path d="M-2 2 l4 -4 M0 7 l7 -7 M5 9 l4 -4" stroke="#334155" stroke-width="1"/>
            </pattern>
            <marker id="v1-arr4" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L8 3 L0 6 Z" fill="#006d73"/>
            </marker>
          </defs>

          <!-- Фронтальний вид шайби -->
          <path d="${ringPath(rOut)} ${ringPath(rIn)}" fill="url(#v1-washer-face)" fill-rule="evenodd" stroke="#1e293b" stroke-width="2.2"/>
          ${hasChamfer ? `<circle cx="${cx}" cy="${cy}" r="${rChamfer}" fill="none" stroke="#475569" stroke-width="1.15"/>` : ''}
          <line x1="${cx - rOut - 14}" y1="${cy}" x2="${cx + rOut + 14}" y2="${cy}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="14 3 2 3"/>
          <line x1="${cx}" y1="${cy - rOut - 14}" x2="${cx}" y2="${cy + rOut + 14}" stroke="#0284c7" stroke-width="0.85" stroke-dasharray="14 3 2 3"/>

          <!-- Переріз шайби -->
          <text x="${secX}" y="84" fill="#435b66" font-size="13" font-weight="600">Переріз (${hasChamfer ? 'Вик. 2 · фаска 45°' : 'Вик. 1 · без фаски'})</text>
          <path d="${secPoly}" fill="url(#v1-hatch-steel)" stroke="#1e293b" stroke-width="2.2" stroke-linejoin="round"/>

          <!-- Розміри -->
          <g class="svg-interactive" data-tip-title="Внутрішній діаметр d1 = ${spec.washerD1} мм" data-tip-body="Отвір шайби під різьбу М${d} (ГОСТ 11371-78).">
            <line class="dim-line" x1="${cx - rIn}" y1="${cy}" x2="${cx + rIn}" y2="${cy}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr4)" marker-end="url(#v1-arr4)"/>
            <text class="dim-text" x="${cx}" y="${cy - 8}" text-anchor="middle" fill="#005f66" font-size="15" font-weight="700">Ø${spec.washerD1}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Зовнішній діаметр d2 = ${spec.washerD2} мм" data-tip-body="Зовнішній діаметр опорної поверхні шайби.">
            <line class="dim-line" x1="${cx - rOut}" y1="${cy}" x2="${cx - rOut}" y2="326" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx + rOut}" y1="${cy}" x2="${cx + rOut}" y2="326" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${cx - rOut}" y1="318" x2="${cx + rOut}" y2="318" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr4)" marker-end="url(#v1-arr4)"/>
            <text class="dim-text" x="${cx}" y="310" text-anchor="middle" fill="#005f66" font-size="15.5" font-weight="700">Ø${spec.washerD2}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Товщина шайби s = ${fmt(spec.washerS)} мм" data-tip-body="Номінальна товщина за ГОСТ 11371-78.">
            <line class="dim-line" x1="${secX + secW}" y1="${secTop + chPx}" x2="${secX + secW + 34}" y2="${secTop + chPx}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX + secW}" y1="${secY}" x2="${secX + secW + 34}" y2="${secY}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX + secW + 25}" y1="${secTop}" x2="${secX + secW + 25}" y2="${secY}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr4)" marker-end="url(#v1-arr4)"/>
            <text class="dim-text" x="${secX + secW + 36}" y="${(secTop + secY) / 2 + 5}" fill="#005f66" font-size="15.5" font-weight="700">s = ${fmt(spec.washerS)}</text>
          </g>

          <g class="svg-interactive" data-tip-title="Ширина шайби b = ${fmt((spec.washerD2 - spec.washerD1) / 2)} мм" data-tip-body="Радіальна ширина кільця шайби: (d2 - d1) / 2 = ${fmt((spec.washerD2 - spec.washerD1) / 2)} мм. Середній діаметр dср = ${fmt((spec.washerD1 + spec.washerD2) / 2)} мм.">
            <line class="dim-line" x1="${secX}" y1="${secY}" x2="${secX}" y2="${secY + 34}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX + secW}" y1="${secY}" x2="${secX + secW}" y2="${secY + 34}" stroke="#006d73" stroke-width="0.85"/>
            <line class="dim-line" x1="${secX}" y1="${secY + 26}" x2="${secX + secW}" y2="${secY + 26}" stroke="#006d73" stroke-width="1.2" marker-start="url(#v1-arr4)" marker-end="url(#v1-arr4)"/>
            <text class="dim-text" x="${secX + secW / 2}" y="${secY + 44}" text-anchor="middle" fill="#005f66" font-size="15" font-weight="700">b = ${fmt((spec.washerD2 - spec.washerD1) / 2)}</text>
          </g>
        `;
      }
    };

    // --------------------------------------------------------------------------
    // ВЕРСІЯ 2: РЕАЛІСТИЧНИЙ МЕТАЛІК (СТУДІЙНИЙ РЕНДЕР)
    // --------------------------------------------------------------------------

    // Торцевий вигляд шестигранника з фаскою. Отвір задається радіусом у масштабі виду.
    function hexEndView(cx, cy, radius, angle, boreRadius, capped = false) {
      const points = Array.from({length:6}, (_, i) => {
        const a = angle + i * Math.PI / 3;
        return `${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      return `
        <polygon points="${points}" fill="url(#v5-steel)" stroke="#2b434f" stroke-width="2" stroke-linejoin="round"/>
        ${capped ? `<defs>
          <radialGradient id="v5-nut-crown" cx="35%" cy="30%" r="75%">
            <stop stop-color="#edf4f5"/><stop offset=".55" stop-color="#bdcdd2"/><stop offset="1" stop-color="#718995"/>
          </radialGradient>
        </defs>` : ''}
        <circle cx="${cx}" cy="${cy}" r="${(radius * 0.85).toFixed(1)}" fill="${capped ? 'url(#v5-nut-crown)' : 'none'}" stroke="#2b434f" stroke-width="1.1"/>
        ${boreRadius > 0 ? `<circle cx="${cx}" cy="${cy}" r="${boreRadius}" fill="#f7faf9" stroke="#2b434f" stroke-width="1.9"/>` : ''}
        <g stroke="#c56b1a" stroke-width="0.85" stroke-dasharray="14 4 2 4">
          <line x1="${cx - radius - 12}" y1="${cy}" x2="${cx + radius + 12}" y2="${cy}"/>
          <line x1="${cx}" y1="${cy - radius - 12}" x2="${cx}" y2="${cy + radius + 12}"/>
        </g>`;
    }

     const RenderV5 = {
      defs() {
        return `
          <defs>
            ${steelGradient('v5-steel')}
            ${steelHatch('v5-hatch')}
            <pattern id="v5-hatch-gasket" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#526269"/>
              <path d="M-1 1 l2 -2 M0 6 l6 -6 M5 7 l2 -2" stroke="#c4d0d4" stroke-width=".8"/>
            </pattern>
            <marker id="v5-arr" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="7" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L8 3 L0 6 Z" fill="#006d73"/>
            </marker>
          </defs>
        `;
      },

      stud(d, p, count) {
        const spec = GOST_DB[d];
        const cx = 210, topY = 28, botY = 294;
        const halfW = 15 + d * 0.62;
        const g = buildFastenerGeometry(cx, topY, botY, halfW, p, 76);
        const bore = halfW * (part.axialHole || 0) / d;

        // Кругла лупа збігу різьби (Detail View I 4:1)
        const lx = 468, ly = 166, lr = 76;

        return `
          ${this.defs()}
          <defs>
            <clipPath id="v5-stud-loupe"><circle cx="${lx}" cy="${ly}" r="${lr}"/></clipPath>
          </defs>

          <line x1="${cx}" y1="14" x2="${cx}" y2="308" stroke="#c56b1a" stroke-width="1" stroke-dasharray="12 4 2 4"/>
          <path d="${g.bodyPath}" fill="url(#v5-steel)" stroke="#2b434f" stroke-width="2" stroke-linejoin="round"/>
          <path d="${g.threadLines}" fill="none" stroke="#3c5866" stroke-width="1"/>
          <line x1="${cx - halfW}" y1="${topY + g.chamfer}" x2="${cx + halfW}" y2="${topY + g.chamfer}" stroke="#2b434f" stroke-width="1.1"/>
          <line x1="${cx - halfW}" y1="${botY - g.chamfer}" x2="${cx + halfW}" y2="${botY - g.chamfer}" stroke="#2b434f" stroke-width="1.1"/>

          ${bore > 0 ? `<path d="M ${cx-bore} ${topY} V ${botY} M ${cx+bore} ${topY} V ${botY}" fill="none" stroke="#3c5866" stroke-dasharray="4 3"/>
            <path d="M ${cx-bore} 171 L 145 145 H 85" fill="none" stroke="#006d73" marker-start="url(#v5-arr)"/>
            <text x="115" y="140" text-anchor="middle" fill="#005f66" font-size="15" font-weight="700">Ø ${fmt(part.axialHole)}</text>` : ''}
          <!-- Коло виділення на шпильці + лінія до лупи -->
          <circle cx="${cx + halfW - 3}" cy="${g.t1End + 2}" r="14" fill="none" stroke="#006d73" stroke-width="1.3" stroke-dasharray="3 2"/>
          <line x1="${cx + halfW + 11}" y1="${g.t1End + 2}" x2="${lx - lr}" y2="${ly}" stroke="#006d73" stroke-width="1.2"/>

          <!-- Кругла виносна лупа (збіг різьби + профіль 60°) -->
          <circle cx="${lx}" cy="${ly}" r="${lr}" fill="#ffffff" stroke="#006d73" stroke-width="2.2"/>
          <g clip-path="url(#v5-stud-loupe)">
            <path d="M ${lx - 90} ${ly - 90} H ${lx + 10} L ${lx - 8} ${ly - 65} L ${lx + 10} ${ly - 40} L ${lx - 8} ${ly - 15} L ${lx + 10} ${ly + 10} L ${lx + 3} ${ly + 32} L ${lx + 10} ${ly + 52} V ${ly + 90} H ${lx - 90} Z" fill="url(#v5-steel)" stroke="#2b434f" stroke-width="2"/>
            <line x1="${lx - 80}" y1="${ly + 10}" x2="${lx + 65}" y2="${ly + 10}" stroke="#006d73" stroke-width="1" stroke-dasharray="5 3"/>
            <text x="${lx + 16}" y="${ly - 36}" fill="#1b3440" font-size="12" font-weight="700">P=${fmt(p)}</text>
          </g>
          <text x="${lx}" y="${ly - lr - 10}" text-anchor="middle" fill="#1b3440" font-size="13.5" font-weight="700">Збіг різьби</text>

          <!-- Розміри -->
          <g class="svg-interactive" data-tip-title="Шпилька М${d} × ${fmt(p)}" data-tip-body="ГОСТ 24705-2004 · Кількість: ${count} шт. · Довжина L=${spec.studLength} мм">
            <line class="dim-line" x1="${cx - halfW}" y1="294" x2="${cx - halfW}" y2="332" stroke="#006d73" stroke-width="1"/>
            <line class="dim-line" x1="${cx + halfW}" y1="294" x2="${cx + halfW}" y2="332" stroke="#006d73" stroke-width="1"/>
            <line class="dim-line" x1="${cx - halfW}" y1="324" x2="${cx + halfW}" y2="324" stroke="#006d73" stroke-width="1.4" marker-start="url(#v5-arr)" marker-end="url(#v5-arr)"/>
            <text class="dim-text" x="${cx}" y="316" text-anchor="middle" fill="#005f66" font-size="16" font-weight="700">М${d} × ${fmt(p)}</text>
          </g>
        `;
      },

      bolt(d, p) {
        const cx = 170, top = 29, tip = 282;
        const {shankRadius:halfD, headRadius:radius, headHeight} = boltMetrics(d);
        const shoulder = top + headHeight;
        const g = buildFastenerGeometry(cx, shoulder, tip, halfD, p, 81, false);
        const hx = 385, hy = (top + tip) / 2;
        const edge = radius / 2, flat = radius * Math.cos(Math.PI / 6), sizeX = hx + radius + 22;
        const bore = part.axialHole > 0 ? halfD * part.axialHole / d : 0;
        const threadMark = `М${fmt(d)} × ${fmt(p)}`;

        return `
          ${this.defs()}
          <g stroke="#2b434f" stroke-linejoin="round">
            <path d="${g.bodyPath}" fill="url(#v5-steel)" stroke-width="2"/>
            <path d="${g.threadLines}" fill="none" stroke="#3c5866"/>
            <path d="M ${cx-halfD} ${tip-g.chamfer} h ${2*halfD}" fill="none"/>
            ${boltHead(cx,top,radius,shoulder)}
          </g>
          ${bore ? `<path d="M ${cx-bore} ${top} V ${tip} M ${cx+bore} ${top} V ${tip}" fill="none" stroke="#3c5866" stroke-dasharray="4 3"/>` : ''}
          <path d="M ${cx} ${top-16} V ${tip+12}" fill="none" stroke="#c56b1a" stroke-width=".85" stroke-dasharray="14 4 2 4"/>
          ${hexEndView(hx, hy, radius, 0, bore)}

          <g fill="none" stroke="#006d73">
            <path d="M ${cx-halfD} ${tip+2} V 310 M ${cx+halfD} ${tip+2} V 310" stroke-width=".85"/>
            <path d="M ${cx-halfD} 305 H ${cx+halfD}" stroke-width="1.3" marker-start="url(#v5-arr)" marker-end="url(#v5-arr)"/>
            <path d="M ${cx+halfD} 155 l18 -17 h49"/>
            <path d="M ${hx+edge+2} ${hy-flat} H ${sizeX+5} M ${hx+edge+2} ${hy+flat} H ${sizeX+5}" stroke-width=".85"/>
            <path d="M ${sizeX} ${hy-flat} V ${hy+flat}" stroke-width="1.3" marker-start="url(#v5-arr)" marker-end="url(#v5-arr)"/>
            ${bore ? `<path d="M ${hx+bore*Math.SQRT1_2} ${hy-bore*Math.SQRT1_2} L ${hx+radius} ${hy-radius-17} h39"/>` : ''}
          </g>
          <g class="dim-text" text-anchor="middle" fill="#005f66" font-size="15.5" font-weight="700">
            <text x="${cx}" y="326">${threadMark}</text>
            <text x="${cx+halfD+42}" y="133">Ø ${fmt(d)}</text>
            <g><title>Розмір головки під ключ</title><text transform="translate(${sizeX+15} ${hy}) rotate(-90)">S</text></g>
            ${bore ? `<text x="${hx+radius+19}" y="${hy-radius-22}" font-size="14">Ø ${fmt(part.axialHole)}</text>` : ''}
          </g>`;
      },

      nut(d, nutType) {
        // Половинно-осьовий розріз гайки (зліва — вигляд шестигранника, справа від осі — розріз з внутрішньою різьбою!)
        const specRow = GOST_DB[d];
        const height = nutType === 'B' ? 68 + specRow.nutCapH * 1.15 : 52 + specRow.nutM * 1.45;
        const centerY = 170;
        const m = buildHexNutMetrics(215, centerY + height/2, d, nutType, specRow);
        const { cx, baseY, topY, halfE, spec, isCapped } = m;
        const rcx = 468, rcy = centerY, rOuter = halfE * 0.94;
        const flatHalf = rOuter * Math.cos(Math.PI/6);
        const dimensionY = rcy + rOuter + 24;
        return `
          ${this.defs()}
          ${nutSide(m)}

          <!-- Осьова лінія розділу вигляду і розрізу -->
          <g class="nut-axis" fill="none" stroke-dasharray="18 4 2 4" stroke-dashoffset="8">
            <line x1="${cx}" y1="${topY - 20}" x2="${cx}" y2="${baseY + 20}" stroke="#c56b1a" stroke-width="1.1"/>
          </g>

          <!-- Вид зверху -->
          ${hexEndView(rcx, rcy, rOuter, Math.PI/6, isCapped ? 0 : rOuter * 0.46, isCapped)}
          ${part.acrossFlats ? `
          <g class="nut-wrench-dimension" fill="none" stroke="#006d73">
            <path d="M ${rcx-flatHalf} ${rcy+3} V ${dimensionY+6} M ${rcx+flatHalf} ${rcy+3} V ${dimensionY+6}" stroke-width="0.85"/>
            <line x1="${rcx-flatHalf}" y1="${dimensionY}" x2="${rcx+flatHalf}" y2="${dimensionY}" stroke-width="1.3" marker-start="url(#v5-arr)" marker-end="url(#v5-arr)"/>
            <text class="dim-text" x="${rcx}" y="${dimensionY+20}" text-anchor="middle" fill="#005f66" stroke="none" font-size="15.5" font-weight="700">S = ${fmt(part.acrossFlats)}</text>
          </g>` : ''}

          <g class="svg-interactive" data-tip-title="Поєднання вигляду і розрізу гайки М${d}" data-tip-body="Висота ${isCapped ? 'H=' + spec.nutCapH : 'm=' + spec.nutM} мм · Під ключ S=${spec.nutS} мм">
            <line class="dim-line" x1="${cx - halfE + 10}" y1="${topY}" x2="94" y2="${topY}" stroke="#006d73" stroke-width="1"/>
            <line class="dim-line" x1="${cx - halfE + 7}" y1="${baseY}" x2="94" y2="${baseY}" stroke="#006d73" stroke-width="1"/>
            <line class="dim-line" x1="104" y1="${topY}" x2="104" y2="${baseY}" stroke="#006d73" stroke-width="1.4" marker-start="url(#v5-arr)" marker-end="url(#v5-arr)"/>
            <text class="dim-text" transform="translate(92 ${(topY + baseY) / 2}) rotate(-90)" text-anchor="middle" fill="#005f66" font-size="15.5" font-weight="700">${part.heightSymbol || (isCapped ? 'l₁' : 'm')} = ${fmt(m.heightMm)}</text>
          </g>
        `;
      },

      gasket(od, id, thick, hasHoles, count) {
        return this.ring(od,id,thick,hasHoles,count,false);
      },

      washer(d, exec) {
        const spec = GOST_DB[d];
        return this.ring(spec.washerD2,spec.washerD1,spec.washerS,false,0,true,exec === '2');
      },

      ring(od, id, thick, hasHoles, count, washer, chamfered = false) {
        const cx = 190, cy = 167, radius = 118;
        const inner = radius * (id / od), hole = hasHoles ? radius * (part.holeDiameter / od) : 0;
        const pitchRadius = part.pitchCircle ? radius * (part.pitchCircle / od) : (radius + inner) / 2;
        const band = (od - id) / 2;
        const circlePath = (x, y, r) => `M ${x-r} ${y} a ${r} ${r} 0 1 0 ${2*r} 0 a ${r} ${r} 0 1 0 ${-2*r} 0 Z`;
        const half = radius * ((part.partitionWidth || 0) / od);
        const pattern = part.partitionPattern || 'none';
        // Кожен прохід має свій замкнений контур: на стиках смуг немає швів.
        const chordX = y => Math.sqrt(Math.max(0, inner * inner - y * y));
        function cap(y) {
          const x = chordX(y) * Math.sign(y);
          return `M ${x} ${y} A ${inner} ${inner} 0 0 1 ${-x} ${y} Z `;
        }
        function corner(signX, signY) {
          const x = chordX(half);
          return `M ${signX*half} ${signY*half} H ${signX*x} A ${inner} ${inner} 0 0 ${signX === signY ? 1 : 0} ${signX*half} ${signY*x} Z `;
        }
        let openings = circlePath(0, 0, inner);
        if (pattern === 'single') {
          openings = cap(-half) + cap(half);
        } else if (pattern === 'cross' || pattern === 'tee') {
          openings = corner(-1,1) + corner(1,1) + (pattern === 'tee' ? cap(-half) : corner(-1,-1) + corner(1,-1));
        } else if (pattern === 'parallel') {
          const far = inner/2 + half, near = inner/2 - half, x = chordX(near);
          openings = cap(-far) + cap(far) + `M ${-x} ${-near} H ${x} A ${inner} ${inner} 0 0 1 ${x} ${near} H ${-x} A ${inner} ${inner} 0 0 1 ${-x} ${-near} Z `;
        }
        if (hasHoles) {
          for (let i = 0; i < count; i++) {
            const a = i * 2 * Math.PI / count - Math.PI / 2;
            openings += ' ' + circlePath(pitchRadius * Math.cos(a), pitchRadius * Math.sin(a), hole);
          }
        }

        const sectionScale = Math.min(144 / band, 70 / thick);
        const sectionWidth = band * sectionScale, sectionHeight = thick * sectionScale;
        const chamfer = chamfered ? Math.min(band,thick) * .35 : 0;
        const bevel = chamfer * sectionScale;
        const sx = -sectionWidth / 2, ex = sectionWidth / 2;
        const top = -sectionHeight / 2, bottom = sectionHeight / 2;
        // Вісь кільця показуємо схематично за внутрішньою гранню збільшеного перерізу.
        const axisX = ex + 80;
        const widthLineY = bottom + 24;
        const stripY = (pattern === 'parallel' ? inner/2 : 0) + half;
        const stripX = (chordX(stripY) + (pattern === 'tee' || pattern === 'cross' ? half : 0)) / 2;
        const stripShelfY = Math.max(40,stripY + 12);
        const arrow = 'marker-start="url(#v5-arr)" marker-end="url(#v5-arr)"';
        const endArrow = 'marker-end="url(#v5-arr)"';
        function shelf(x, y, endX, label) {
          return `<path d="M ${x} ${y} H ${endX}" fill="none" stroke="#006d73" stroke-width=".8"/>
            <text x="${(x+endX)/2}" y="${y-6}" text-anchor="middle" fill="#005f66" font-size="13.5" font-weight="650">${label}</text>`;
        }
        function diameterMark(r, x, y, endX, index, value) {
          const length = Math.hypot(x,y), tx = r*x/length, ty = r*y/length;
          const label = `Ø<tspan baseline-shift="-2.5" font-size="9.5">${index}</tspan> ${fmt(value)}`;
          return `<path d="M ${-tx} ${-ty} L ${tx} ${ty}" fill="none" stroke="#006d73" stroke-width=".9" ${arrow}/>
            <path d="M ${tx} ${ty} L ${x} ${y}" fill="none" stroke="#006d73" stroke-width=".8"/>
            ${shelf(x,y,endX,label)}`;
        }
        const holeAngle = hasHoles ? Math.round(count/12) * 2*Math.PI/count - Math.PI/2 : 0;
        const holeX = pitchRadius * Math.cos(holeAngle), holeY = pitchRadius * Math.sin(holeAngle);
        const holeLead = Math.hypot(77-holeX,-140-holeY);
        const bandRadius = (inner + radius) / 2;
        // Прив'язка товщини до матеріалу між сусідніми отворами.
        const bandAngle = hasHoles && count >= 4 ? (-Math.floor(count/8) - .5) * 2*Math.PI/count - Math.PI/2 : -3*Math.PI/4;

        return `
          ${this.defs()}
          <defs>
            <linearGradient id="v5-graphite" x1="0" y1="0" x2=".95" y2=".5">
              <stop stop-color="#37474f"/><stop offset=".28" stop-color="#61737b"/>
              <stop offset=".48" stop-color="#86969c"/><stop offset=".73" stop-color="#53656d"/><stop offset="1" stop-color="#394a53"/>
            </linearGradient>
            <mask id="v5-gasket-mask" maskUnits="userSpaceOnUse" x="-120" y="-120" width="240" height="240">
              <circle r="${radius}" fill="white"/><path d="${openings}" fill="black"/>
            </mask>
          </defs>

          <g transform="translate(${cx} ${cy})">
            <circle r="${radius}" fill="url(#${washer ? 'v5-steel' : 'v5-graphite'})" mask="url(#v5-gasket-mask)"/>
            <circle r="${radius}" fill="none" stroke="#2b434f" stroke-width="1.65"/>
            ${chamfered ? `<circle r="${radius*(1-2*chamfer/od)}" fill="none" stroke="#2b434f" stroke-width=".9"/>` : ''}
            <path d="${openings}" fill="none" stroke="#344954" stroke-width="1.15"/>
            <g fill="none" stroke="#c56b1a" stroke-width=".85" stroke-dasharray="14 4 2 4">
              <path d="M -131 0 H 131 M 0 -131 V 131"/>
              ${hasHoles ? `<circle r="${pitchRadius}" stroke-dasharray="8 3 2 3"/>` : ''}
            </g>
            ${diameterMark(radius,-87,145,-183,'макс',od)}
            ${diameterMark(inner,103,-68,194,'мін',id)}
            ${hasHoles && part.pitchCircle ? diameterMark(pitchRadius,94,145,190,'кола',part.pitchCircle) : ''}
            <path d="M ${bandRadius*Math.cos(bandAngle)} ${bandRadius*Math.sin(bandAngle)} L -112 -140" fill="none" stroke="#006d73" stroke-width=".85" marker-start="url(#v5-arr)"/>
            ${shelf(-112,-140,-173,'s = '+fmt(thick))}
            ${hasHoles ? `<path d="M ${holeX + hole*(77-holeX)/holeLead} ${holeY + hole*(-140-holeY)/holeLead} L 77 -140" fill="none" stroke="#006d73" stroke-width=".85" marker-start="url(#v5-arr)"/>
              ${shelf(77,-140,172,fmt(count)+' × Ø '+fmt(part.holeDiameter))}` : ''}
            ${half > 0 ? `<path d="M ${stripX} ${stripY} L 126 ${stripShelfY}" fill="none" stroke="#006d73" stroke-width=".85" marker-start="url(#v5-arr)"/>
              ${shelf(126,stripShelfY,194,'w = '+fmt(part.partitionWidth))}` : ''}
          </g>

          <g transform="translate(476 ${cy})">
            <text y="${top-24}" text-anchor="middle" fill="#344954" font-size="13" font-weight="600">Радіальний переріз</text>
            ${washer ? `<path d="M ${sx+bevel} ${top} H ${ex} V ${bottom} H ${sx} V ${top+bevel} Z" fill="url(#v5-hatch)" stroke="#2b434f" stroke-width="1.5"/>
              ${chamfered ? `<path d="M ${sx+bevel/2} ${top+bevel/2} l-14 -15 v-8" fill="none" stroke="#006d73" marker-start="url(#v5-arr)"/><text x="${sx+bevel/2-14}" y="${top+bevel/2-28}" text-anchor="middle" font-size="13" fill="#005f66">45°</text>` : ''}` :
              `<rect x="${sx}" y="${top}" width="${sectionWidth}" height="${sectionHeight}" fill="url(#v5-hatch-gasket)" stroke="#2b434f" stroke-width="1.5"/>`}
            <path d="M ${ex} ${top} H ${axisX} M ${ex} ${bottom} H ${axisX}" fill="none" stroke="#526872" stroke-width=".8"/>
            <line x1="${axisX}" y1="${top-52}" x2="${axisX}" y2="${bottom+58}" stroke="#c56b1a" stroke-width="1" stroke-dasharray="14 4 2 4"/>
            <g fill="none" stroke="#006d73">
              <path d="M ${sx} ${bottom+2} V ${widthLineY+5} M ${ex} ${bottom+2} V ${widthLineY+5}" stroke-width=".85"/>
              ${sectionWidth > 20 ? `<path d="M ${sx} ${widthLineY} H ${ex}" stroke-width="1.3" ${arrow}/>` : `<path d="M ${sx-15} ${widthLineY} H ${sx}" ${endArrow}/><path d="M ${ex+15} ${widthLineY} H ${ex}" ${endArrow}/>`}
              <path d="M ${ex+18} ${top-15} V ${top}" stroke-width="1.2" ${endArrow}/>
              <path d="M ${ex+18} ${bottom+15} V ${bottom}" stroke-width="1.2" ${endArrow}/>
            </g>
            <g fill="#005f66" font-size="15" font-weight="700">
              <text y="${widthLineY+20}" text-anchor="middle">${washer ? 'b' : 'b₀'} = ${fmt(band)}</text>
              <text x="${ex+49}" y="${sectionHeight >= 24 ? 5 : top-6}" text-anchor="middle">s = ${fmt(thick)}</text>
            </g>
          </g>`;
      },

    };


 const renderer=style==='cad'?RenderV1:RenderV5;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 const viewBox = key === 'bolt' ? '55 3 460 336' : ['gasket','washer'].includes(key) && style === 'passport' ? '0 0 640 338' : '55 5 560 340';
 svg.setAttribute('viewBox',viewBox);
 svg.setAttribute('role','img');
 svg.setAttribute('aria-label',part.name+' · '+part.spec);
 const render={stud:()=>renderer.stud(diameter,pitch,part.count || 0),bolt:()=>RenderV5.bolt(diameter,pitch),nut:()=>renderer.nut(diameter,part.capped?'B':'A'),gasket:()=>renderer.gasket(part.outer,part.inner,part.h,Boolean(part.hasHoles),part.count || 0,diameter),washer:()=>renderer.washer(diameter,part.execution || '1')};
 svg.innerHTML=render[key]();
 if(key==='stud' && !part.length) svg.querySelector('[data-tip-title^="Довжина шпильки"]')?.remove();
 if(key==='nut' && !part.acrossFlats) {
   svg.querySelector('[data-tip-title^="Розмір під ключ"]')?.remove();
   for(const text of svg.querySelectorAll('text')) text.textContent=text.textContent.replace(/ · S=—/g,'');
 }
 if(key==='nut' && part.capped) {
   for(const text of svg.querySelectorAll('text')) text.textContent=text.textContent.replace(/^H =/,'l₁ =');
 }
 // Namespace definitions so comparison cards resolve their own gradients and clips.
 const ids=new Map(Array.from(svg.querySelectorAll('[id]'),el=>[el.id,style+'-'+key+'-'+el.id]));
 for(const element of svg.querySelectorAll('*'))for(const attr of Array.from(element.attributes)) {
   let value=attr.value;
   if(attr.name==='id')value=ids.get(value)||value;
   value=value.replace(/url\(#([^)]+)\)/g,(match,id)=>ids.has(id)?'url(#'+ids.get(id)+')':match);
   element.setAttribute(attr.name,value);
 }
 return svg;
};
})(globalThis);
