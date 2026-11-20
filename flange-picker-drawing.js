(function(root) {
  'use strict';

  const format = (typeof module === 'object' && module.exports ? require('./core.js') : root.FlangeCore).formatNumber;
  if (typeof module === 'object' && module.exports) require('./component-imported-styles.js');
  const {drafting,dimensionMarker,steelGradient,steelHatch} = root.PassportProfiles;
  const accent = '#ac5218';
  const palette = Object.entries(drafting).map(([key,value]) => `--fp-${key}:${value}`).join(';');
  const draftStyle = `style="${palette};--fp-active:${accent}"`;
  const mm = value => `${format(value)} мм`;
  const dimensions = {
    D: 'D', D1: 'D₁', bore: 'Отвір', b: 'b', d: 'd', n: 'n', bolt: 'Різьба',
    pipeOD: 'dₙ труби', Dn: 'Dₙ', Dm: 'Dₘ', h4: 'h₄', D2: 'D₂', D3: 'D₃', D4: 'D₄',
    D5: 'D₅', D6: 'D₆', D7: 'D₇', D8: 'D₈', D9: 'D₉',
    h: 'h', h1: 'h₁', h2: 'h₂', h3: 'h₃', b2: 'b₂', r: 'r',
  };
  const bound = (value, low, high) => Math.min(Math.max(value, low), high);
  const number = value => Math.round(value * 1000) / 1000;
  const available = value => Number.isFinite(value) && value > 0;
  const withOrigin = (key, label, origins) => origins?.[key]?.calculated ? `${label} · Розраховано` : label;

  function line(x1, y1, x2, y2, css, arrow) {
    const markers = arrow ? ` marker-start="url(#${arrow})" marker-end="url(#${arrow})"` : '';
    return `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" class="${css}"${markers}/>`;
  }

  const arrows = view => dimensionMarker(`fp-${view}-arrow`) + dimensionMarker(`fp-${view}-arrow-active`,accent);
  const arrowId = (view, focused) => `fp-${view}-arrow${focused ? '-active' : ''}`;

  function hSize(key, x1, x2, y, partY, label, active, origins, view = 'axial') {
    return `<g data-size="${key}" class="${active === key ? 'fp-active' : ''}">
      ${line(x1,partY,x1,y+4,'fp-extension')}${line(x2,partY,x2,y+4,'fp-extension')}
      ${line(x1,y,x2,y,'fp-measure',arrowId(view,active === key))}
      <text x="${(x1+x2)/2}" y="${y-5}" text-anchor="middle">${withOrigin(key,label,origins)}</text></g>`;
  }

  function vSize(key, x, y1, y2, partX, label, active, origins, view = 'axial') {
    return `<g data-size="${key}" class="${active === key ? 'fp-active' : ''}">
      ${line(partX,y1,x+4,y1,'fp-extension')}${line(partX,y2,x+4,y2,'fp-extension')}
      ${line(x,y1,x,y2,'fp-measure',arrowId(view,active === key))}
      <text x="${x+6}" y="${(y1+y2)/2+4}">${withOrigin(key,label,origins)}</text></g>`;
  }

  function axial(row, hasSealDetail, active, origins) {
    const d = row.dimensions;
    const hub = row.standard === '12821' && [d.h4, d.Dm, d.Dn].every(available);
    const cx = 158;
    const rim = 96;
    const scale = 2 * rim / d.D;
    const bore = bound(d.bore * scale / 2, 12, 87);
    const pitch = bound(d.D1 * scale / 2, bore + 3, rim - 3);
    const hole = bound(d.d * scale / 2, 2, Math.max(2, Math.min(rim - pitch, pitch - bore) - 1));
    const top = 102, plane = 127, weld = 48;
    const end = bound((d.Dn || d.bore) * scale / 2, bore + 3, pitch - 2);
    const base = bound((d.Dm || d.bore) * scale / 2, bore + 3, pitch - 2);
    const outline = hub
      ? `M${cx+bore} ${plane} V${weld} H${cx+end} L${cx+base} ${top} H${cx+rim} V${plane} Z`
      : `M${cx+bore} ${top} H${cx+rim} V${plane} H${cx+bore} Z`;
    const sealEnd = cx + pitch - hole;
    const sealMiddle = number((cx + bore + sealEnd) / 2);
    const collar = hub && ['Dn','Dm','h4'].includes(active);
    const pipe = row.standard === '12820' && available(d.pipeOD) ? bound(d.pipeOD * scale / 2, 10, rim - 2) : null;
    return `<svg viewBox="0 0 404 193" role="img" aria-label="Осьовий розріз фланця з розмірами" data-flange-view="axial" ${draftStyle}>
      <defs>${steelHatch('fp-axial-hatch')}${arrows('axial')}</defs>
      <text x="12" y="17" class="fp-caption">Осьовий розріз</text>
      ${line(cx,31,cx,180,'fp-axis')}
      <g class="fp-section${collar ? ' fp-collar-active' : ''}" fill="url(#fp-axial-hatch)">
        <path d="${outline}"/><path d="${outline}" transform="translate(${2*cx} 0) scale(-1 1)"/>
      </g>
      <rect x="${cx+pitch-hole}" y="${top}" width="${2*hole}" height="${plane-top}" class="fp-cut"/>
      <rect x="${cx-pitch-hole}" y="${top}" width="${2*hole}" height="${plane-top}" class="fp-cut"/>
      ${hasSealDetail ? `<g data-seal-detail="A" aria-label="Фрагмент А, бік прокладки">
        ${line(cx+bore,plane,sealEnd,plane,'fp-accent-face')}
        <path d="M${sealMiddle} ${plane} v10 H280" class="fp-detail-leader"/>
        <circle cx="288" cy="${plane+10}" r="8" class="fp-detail-tag"/>
        <text x="288" y="${plane+14}" text-anchor="middle">А</text>
      </g>` : ''}
      ${pipe === null ? '' : `${line(cx-pipe,54,cx-pipe,top,'fp-axis')}${line(cx+pipe,54,cx+pipe,top,'fp-axis')}
        ${hSize('pipeOD',cx-pipe,cx+pipe,47,54,`dₙ труби ⌀${mm(d.pipeOD)}`,active,origins)}`}
      ${hSize('bore',cx-bore,cx+bore,150,plane,`${hub ? 'd₁' : 'dв'} ⌀${mm(d.bore)}`,active,origins)}
      ${hSize('D',cx-rim,cx+rim,174,plane,`D ⌀${mm(d.D)}`,active,origins)}
      ${vSize('b',273,top,plane,cx+rim,`b ${mm(d.b)}`,active,origins)}
      ${hub ? hSize('Dn',cx-end,cx+end,39,weld,`Dₙ ⌀${mm(d.Dn)}`,active,origins)
       + hSize('Dm',cx-base,cx+base,91,top,`Dₘ ⌀${mm(d.Dm)}`,active,origins)
       + vSize('h4',327,weld,plane,cx+rim,`h₄ ${mm(d.h4)}`,active,origins) : ''}
    </svg>`;
  }

  function front(row, active, origins) {
    const d = row.dimensions, cx = 123, cy = 112, r = 74;
    const scale = 2 * r / d.D;
    const bore = bound(d.bore * scale / 2, 8, r - 8);
    const pitch = bound(d.D1 * scale / 2, bore + 2, r - 2);
    const hole = bound(d.d * scale / 2, 1, Math.max(1, Math.min(r - pitch, pitch - bore) - 1));
    const angle = Math.PI / d.n;
    const holes = Array.from({length:d.n}, (_, i) => angle + i * 2 * Math.PI / d.n);
    const cx1 = cx + pitch * Math.cos(angle), cy1 = cy - pitch * Math.sin(angle);
    return `<svg viewBox="0 0 292 220" role="img" aria-label="Вигляд спереду з колом кріплень" data-flange-view="front" ${draftStyle}>
      <defs>${steelGradient('fp-front-steel')}${arrows('front')}</defs>
      <text x="12" y="17" class="fp-caption">Вигляд спереду</text>
      <circle cx="${cx}" cy="${cy}" r="${r}" class="fp-front-outline" fill="url(#fp-front-steel)"/>
      <circle cx="${cx}" cy="${cy}" r="${bore}" class="fp-cut"/>
      ${line(cx-r-8,cy,cx+r+8,cy,'fp-axis')}${line(cx,cy-r-8,cx,cy+r+8,'fp-axis')}
      <circle cx="${cx}" cy="${cy}" r="${pitch}" class="${active === 'D1' ? 'fp-active-circle' : 'fp-axis'}"/>
      <g class="${['n','d','bolt'].includes(active) ? 'fp-active-holes' : ''}">${holes.map(a =>
        `<circle cx="${number(cx+pitch*Math.cos(a))}" cy="${number(cy-pitch*Math.sin(a))}" r="${number(hole)}" class="fp-cut"/>`).join('')}</g>
      ${hSize('D1',cx-pitch,cx+pitch,206,cy,`D₁ ${mm(d.D1)}`,active,origins,'front')}
      <g data-size="d" class="${['n','d','bolt'].includes(active) ? 'fp-active' : ''}">
        ${line(cx1,cy1,cx1+23,43,'fp-measure')}${line(cx1+23,43,276,43,'fp-measure')}
        <text x="276" y="38" text-anchor="end">${withOrigin('n',`n ${d.n}`,origins)} × ${withOrigin('d',`⌀${mm(d.d)}`,origins)}</text>
      </g>
    </svg>`;
  }

  // Enlarged half-sections follow figures 1–6 of ГОСТ 12815. Coordinates
  // describe the visible shape; every printed measurement comes from the row.
  const faceProfiles = {
    1: {edge: 'M38 48 H190 V73 H258', points: {D2: [190,48], h: [190,62]}},
    2: {edge: 'M38 41 H164 V73 H258', points: {D4: [164,41], h1: [164,59]}},
    3: {edge: 'M38 79 H152 V46 H194 V73 H258', points: {D2: [194,46], D6: [152,79], h: [194,60], h2: [152,63]}},
    4: {edge: 'M38 73 H86 V42 H161 V73 H258', points: {D3: [86,42], D4: [161,42], h1: [161,58]}},
    5: {edge: 'M38 46 H87 V79 H161 V46 H200 V73 H258', points: {D2: [200,46], D5: [87,79], D6: [161,79], h: [200,60], h2: [161,64]}},
    6: {edge: 'M38 87 H82 L190 47 V73 H258', points: {D2: [190,47], D7: [82,87], h: [190,63]}},
    7: {edge: 'M38 46 H94 Q103 46 106 59 Q118 87 132 59 Q137 46 145 46 H197 V73 H258',
      points: {D8: [119,68], D9: [197,46], b2: [145,46], h3: [119,68], r: [126,66], h: [197,62]}},
    8: {edge: 'M38 73 H86 V48 L93 41 H153 L161 48 V73 H258', points: {D3: [86,48], D4: [161,48], h1: [161,59]}},
    9: {edge: 'M38 46 H80 L88 55 V78 H161 V55 L170 46 H202 V73 H258',
      points: {D2: [202,46], D5: [88,78], D6: [161,78], h: [202,62], h2: [161,66]}},
  };

  function raisedFaceView(d, values, active, origins) {
    const cx = 177, rim = 122, top = 54, plane = 84, contact = 102;
    const bore = bound(d.bore / d.D * rim, 15, rim - 20);
    const raised = bound(values.D2 / d.D * rim, bore + 10, rim - 8);
    const section = `M${cx+rim} ${top} H${cx+bore} V${contact} H${cx+raised} V${plane} H${cx+rim} Z`;
    return `<svg viewBox="0 0 650 145" role="img" aria-label="Фрагмент А, з’єднувальний виступ»" data-flange-view="seal" ${draftStyle}>
      <defs>${steelHatch('fp-seal-hatch')}${arrows('seal')}</defs>
      <text x="12" y="17" class="fp-caption">Фрагмент А · Ущільнювальна поверхня</text>
      <text x="12" y="35" class="fp-caption">Виконання 1 · З’єднувальний виступ</text>
      <g class="fp-section" fill="url(#fp-seal-hatch)">
        <path d="${section}"/><path d="${section}" transform="translate(${2*cx} 0) scale(-1 1)"/>
      </g>
      ${line(cx,47,cx,116,'fp-axis')}
      ${hSize('D2',cx-raised,cx+raised,132,contact,`Діаметр виступу D₂ ⌀${mm(values.D2)}`,active,origins,'seal')}
      ${vSize('h',332,plane,contact,cx+raised,`Висота виступу h ${mm(values.h)}`,active,origins,'seal')}
    </svg>`;
  }

  function sealView(d, face, values, active, origins) {
    const profile = faceProfiles[face];
    if (!profile || !values) return '';
    if (String(face) === '1' && available(values.D2) && available(values.h)) return raisedFaceView(d,values,active,origins);
    const shown = Object.entries(values).filter(([key, value]) => profile.points[key] && available(value));
    return `<svg viewBox="0 0 650 127" role="img" aria-label="Ущільнювальна поверхня виконання ${face}" data-flange-view="seal" ${draftStyle}>
      <defs>${steelHatch('fp-seal-hatch')}</defs>
      <text x="12" y="17" class="fp-caption">Фрагмент А · Ущільнювальна поверхня · виконання ${face}</text>
      <path d="${profile.edge} V108 H38 Z" class="fp-section" fill="url(#fp-seal-hatch)" transform="translate(0 146) scale(1 -1)"/>
      ${shown.map(([key,value],i) => {
        const x = i < 3 ? 376 : 518;
        const y = 43 + (i % 3) * 26;
        const focused = key === active;
        const [px, py] = profile.points[key];
        return `<g data-size="${key}" class="${focused ? 'fp-active' : ''}">
          ${focused ? `<circle cx="${px}" cy="${146-py}" r="3" fill="${accent}"/>${line(px,146-py,285,y-4,'fp-measure')}${line(285,y-4,x-7,y-4,'fp-measure')}` : ''}
          <text x="${x}" y="${y}">${withOrigin(key,`${dimensions[key]} ${mm(value)}`,origins)}</text>
        </g>`;
      }).join('')}
    </svg>`;
  }

  function drawCandidate(row, face, active, dimensionOrigins) {
    const detail = sealView(row.dimensions,face,row.faces?.[face],active,dimensionOrigins);
    return axial(row,Boolean(detail),active,dimensionOrigins) + front(row,active,dimensionOrigins) + detail;
  }

  const api = {drawCandidate, dimensions};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlangePickerDrawing = api;
})(globalThis);
