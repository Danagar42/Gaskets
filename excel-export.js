(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.FlangeCore;
  const G = typeof module !== 'undefined' && module.exports ? require('./calculations.js') : root.FlangeCalculations;
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const xml = value => String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const unxml = value => value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  const formula = value => ({formula:value});
  const crcTable = Uint32Array.from({length:256},(_,n) => {
    for (let k=0;k<8;k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let n = 0xffffffff;
    for (const byte of bytes) n = crcTable[(n ^ byte) & 255] ^ (n >>> 8);
    return (n ^ 0xffffffff) >>> 0;
  }
  // Only the trusted, embedded template is read. Untouched parts keep their
  // original compressed bytes, including drawings, images and printer settings.
  function openZip(bytes) {
    const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), files = new Map();
    let end = bytes.length-22;
    while (end >= Math.max(0,bytes.length-65557) && view.getUint32(end,true) !== 0x06054b50) end--;
    if (end < 0) throw new Error('Пошкоджений шаблон Excel.');
    let offset = view.getUint32(end+16,true);
    for (let i=0;i<view.getUint16(end+10,true);i++) {
      if (view.getUint32(offset,true) !== 0x02014b50) throw new Error('Некоректний каталог шаблону.');
      const len = view.getUint16(offset+28,true), extra = view.getUint16(offset+30,true), comment = view.getUint16(offset+32,true);
      const name = decoder.decode(bytes.subarray(offset+46,offset+46+len));
      const start = view.getUint32(offset+42,true);
      const payload = start+30+view.getUint16(start+26,true)+view.getUint16(start+28,true);
      const size = view.getUint32(offset+20,true);
      files.set(name,{method:view.getUint16(offset+10,true),crc:view.getUint32(offset+16,true),size:view.getUint32(offset+24,true),compressed:bytes.slice(payload,payload+size)});
      offset += 46+len+extra+comment;
    }
    async function read(name) {
      const entry = files.get(name);
      if (!entry) throw new Error(`У шаблоні відсутній ${name}.`);
      if (entry.method === 0) return decoder.decode(entry.compressed);
      if (entry.method !== 8) throw new Error('Непідтримуване стиснення шаблону.');
      let stream;
      try { stream = new DecompressionStream('deflate-raw'); }
      catch { throw new Error('Для експорту Excel оновіть браузер до актуальної версії Chrome, Edge або Firefox.'); }
      return decoder.decode(await new Response(new Blob([entry.compressed]).stream().pipeThrough(stream)).arrayBuffer());
    }
    return {files,read};
  }
  function setXml(files,name,content) {
    const bytes = encoder.encode(content);
    files.set(name,{method:0,crc:crc32(bytes),size:bytes.length,compressed:bytes});
  }
  function zip(files) {
    const parts = [], directory = []; let offset = 0, centralSize = 0;
    for (const [name,entry] of files) {
      const nameBytes = encoder.encode(name), header = new Uint8Array(30+nameBytes.length), v = new DataView(header.buffer);
      v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x800,true); v.setUint16(8,entry.method,true);
      v.setUint16(12,0x21,true); v.setUint32(14,entry.crc,true); v.setUint32(18,entry.compressed.length,true); v.setUint32(22,entry.size,true); v.setUint16(26,nameBytes.length,true); header.set(nameBytes,30);
      parts.push(header,entry.compressed);
      const central = new Uint8Array(46+nameBytes.length), cv = new DataView(central.buffer);
      cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(8,0x800,true); cv.setUint16(10,entry.method,true); cv.setUint16(14,0x21,true);
      cv.setUint32(16,entry.crc,true); cv.setUint32(20,entry.compressed.length,true); cv.setUint32(24,entry.size,true); cv.setUint16(28,nameBytes.length,true); cv.setUint32(42,offset,true); central.set(nameBytes,46);
      directory.push(central); centralSize += central.length; offset += header.length+entry.compressed.length;
    }
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true); ev.setUint16(8,files.size,true); ev.setUint16(10,files.size,true); ev.setUint32(12,centralSize,true); ev.setUint32(16,offset,true);
    const result = new Uint8Array(offset+centralSize+22); let cursor=0;
    for (const part of [...parts,...directory,end]) { result.set(part,cursor); cursor += part.length; }
    return result;
  }
  function patchSheet(source,values) {
    const remaining = new Set(Object.keys(values));
    function cell(address,attributes = '') {
      const value = values[address]; remaining.delete(address);
      attributes = attributes.replace(/\s(?:r|t)="[^"]*"/g,'');
      const start = `<c r="${address}"${attributes}`;
      if (value && typeof value === 'object' && 'formula' in value) return `${start}><f>${xml(value.formula)}</f></c>`;
      if (typeof value === 'number' && Number.isFinite(value)) return `${start}><v>${value}</v></c>`;
      return `${start} t="inlineStr"><is><t xml:space="preserve">${xml(value ?? '')}</t></is></c>`;
    }
    let result = source.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(whole,attrs,body) => {
      const address = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      if (remaining.has(address)) return cell(address,attrs);
      // Drop all stale formula caches; actual Excel recalculates on opening.
      if (body?.includes('<f')) return `<c${attrs.replace(/\st="[^"]*"/g,'')}>${body.replace(/<v(?:\s[^>]*)?>[\s\S]*?<\/v>/g,'')}</c>`;
      return whole;
    });
    // Patched cells outside the original used rows are only used by helper tabs.
    if (remaining.size) throw new Error(`Комірки відсутні в шаблоні: ${[...remaining].join(', ')}.`);
    result = result.replace(/<hyperlinks\b[\s\S]*?<\/hyperlinks>/g,'').replace(/\sactiveCell="[^"]*"/g,' activeCell="P88"');
    return result;
  }
  function safeNames(nodes) {
    const used = new Set();
    return nodes.map(node => {
      const base = node.name.replace(/[\\/?*\[\]:\x00-\x1f\ufffe\uffff]/g,' ').replace(/^[\s']+|[\s']+$/g,'').slice(0,31).replace(/^[\s']+|[\s']+$/g,'') || 'Вузол';
      let name=base, index=2;
      while (used.has(name.toLowerCase()) || name.toLowerCase() === 'проставки') { const suffix=` (${index++})`; name=base.slice(0,31-suffix.length)+suffix; }
      used.add(name.toLowerCase()); return name;
    });
  }
  function pendingReference(node) {
    const mount = C.mounting(node);
    return ['through-stud','body-bolt'].includes(node.fastener.type)
      || (mount.body && C.number(mount.engagement) !== C.number(node.connection[mount.body].height));
  }
  const pendingMessage = 'Попередній розрахунок. Очікує звірки з контрольним прикладом для цієї схеми.';
  function inspect(node,materials,catalog) {
    const limits = G.nodeLimits(node,materials,catalog);
    const errors = Object.values(limits.inputErrors);
    if (limits.minimum.torqueNm === null) errors.push('Не визначено мінімальний затяг: перевірте геометрію, режими, матеріали та їхні характеристики.');
    if (limits.maximum.torqueNm === null) errors.push('Не визначено максимальний затяг: заповніть дані міцності та виберіть застосовність обох фланців.');
    const compliance = G.nodeCompliance(node,materials,catalog), thermal = G.nodeThermal(node,materials,catalog);
    for (const mode of ['normal','hydro']) {
      errors.push(...compliance.states[mode].issues,...thermal[mode].issues);
    }
    const warnings = [];
    const gasketNote = C.gasketCalculationNote(node);
    if (gasketNote) warnings.push(gasketNote);
    if (pendingReference(node)) warnings.push(pendingMessage);
    if (limits.maximum.omitted.length) warnings.push('Внутрішню різьбу чавунного корпусу без Rp пропущено, як у вихідному Excel. Її міцність не підтверджена.');
    if (limits.roundedOverlap === false) warnings.push('Допустимого діапазону затягування немає.');
    if (limits.verification.minimum?.failed.length || limits.verification.maximum?.failed.length) warnings.push('На межах діапазону є невиконані перевірки.');
    if (limits.verification.minimum?.pending.length || limits.verification.maximum?.pending.length) errors.push('Для перевірки меж бракує даних.');
    return {limits,errors:[...new Set(errors)],warnings};
  }
  function inputs(node,equipment,materials,catalog,torqueNm,extraRows) {
    const v = {}, put=(address,value) => { v[address]=value; }, f=(address,value) => put(address,formula(value));
    const n = C.number, mount = C.mounting(node), hasNut = mount.nuts.length > 0;
    const primary = hasNut ? node.nut : null;
    const second = mount.nuts.length === 2 ? C.nutAt(node,'nutB') : null;
    const compliance = G.nodeCompliance(node,materials,catalog);
    const pitch = C.threadPitch(catalog,node.fastener.threadStandardId,node.fastener.nominalDiameter,node.fastener.pitch);
    function nutHeight(config) {
      const size = C.nutDimensions(catalog,config.standardId,node.fastener.nominalDiameter,config.typeId);
      return size.typeId === 'B' ? n(config.threadedHeight) : size.heightMm;
    }
    const washer = C.washerDimensions(catalog,node.washers.standardId,node.fastener.nominalDiameter,node.washers.accuracyClass,node.washers.execution);
    const gasket = catalog.gaskets[node.gasket.referenceId];
    put('B2',`${equipment.name}${equipment.designation ? ' · '+equipment.designation : ''} · ${node.name} · ${mount.label}`);
    const calculationNotes = [pendingReference(node) ? pendingMessage : '',C.gasketCalculationNote(node)].filter(Boolean).join(' ');
    if (calculationNotes) put('M2',calculationNotes);
    put('C6',torqueNm*1000);
    put('C12','Прокладка'); put('C13','Терморозширений графіт'); put('C14',gasket.name); put('C15',n(node.gasket.thickness));
    put('F20',node.gasket.mode === 'ring' ? n(node.gasket.outerDiameter) : '-');
    put('F21',node.gasket.mode === 'ring' ? n(node.gasket.innerDiameter) : '-');
    put('F23',node.gasket.hasHoles && node.gasket.mode === 'ring' ? n(node.gasket.holeDiameter) : 0);
    if (node.gasket.mode === 'area') {
      for (const address of ['C16','C17','C18','C19','F22']) put(address,'-');
      put('C22',n(node.gasket.effectiveArea)); put('C23',n(node.gasket.pressureArea));
    }
    put('C26',gasket.maximumPressureMPa);
    put('C30',node.fastener.material.name); put('C34',n(node.fastener.nominalDiameter)); put('C36',n(node.fastener.axialHoleDiameter)); put('C37',pitch.pitchMm); put('C40',n(node.fastener.count));
    put('C41',node.fastener.lubricated ? 0.26 : 0.37); put('C42',node.fastener.lubricated ? 0.13 : 0.18);
    const smooth = [mount.body !== 'sideA' && 'C87','C15','C60','C69','C108',mount.body !== 'sideB' && 'C99'];
    const threaded = [hasNut && 'C80',mount.body && 'C98',second && 'C54'];
    f('C38',smooth.filter(Boolean).join('+')); f('C39',threaded.filter(Boolean).join('+'));
    put('C77',hasNut ? primary.material.name : '-');
    put('C80',hasNut ? nutHeight(primary) : '-'); f('D80','C80');
    const primarySide = mount.a === 'nut' ? 'А' : 'Б', otherSide = primarySide === 'А' ? 'Б' : 'А';
    if (hasNut) f('B76',`"Гайка · бік ${primarySide} · М"&C34&" · "&C40&" шт. · "&C77`);
    else put('B76','Гайка відсутня');
    put('C84',node.connection.sideA.material.name); put('C87',n(node.connection.sideA.height)); put('C89',compliance.areas.sideA);
    put('C93',node.connection.sideB.material.name); put('C99',n(node.connection.sideB.height)); put('C101',compliance.areas.sideB);
    put('B83','Деталь А · '+node.connection.sideA.name); put('B92','Деталь Б · '+node.connection.sideB.name);
    if (mount.body && node.fastener.engagement === undefined) f('C98',mount.body === 'sideA' ? 'C87' : 'C99');
    else put('C98',mount.body ? n(mount.engagement) : '-');
    if (mount.body) {
      const side = mount.body === 'sideA' ? 'А' : 'Б';
      put('B98',`Зачеплення з корпусом на боці ${side}, мм`);
      put('M40',`Внутрішня різьба корпусу · бік ${side}`);
    }
    for (const [side,cell] of [['sideA','C89'],['sideB','C101']]) {
      if (node.gasket.mode === 'ring' && String(node.connection[side].area).trim() === '') f(cell,'PI()*(C16*F22-C40*F23^2/4)');
    }
    // Inactive plate from the original workbook is not part of the constructor.
    for (const address of ['C53','C54','C55','C56','C57','I5','J5','I6','J6','I7','J7']) put(address,0);
    if (second) {
      f('B52',`"Гайка · бік ${otherSide} · М"&C34&" · "&C40&" шт. · "&C53`);
      put('B53','Матеріал гайки'); put('B54','Висота робочої різьби, мм');
      put('B55','Границя плинності Rp, МПа'); put('B56','Розмірна таблиця');
      put('B57','Кількість гайок з обох боків, шт.'); f('C57','2*C40');
      if (node.fastener.differentNuts) { put('C53',second.material.name); put('C54',nutHeight(second)); }
      else { f('C53','C77'); f('C54','C80'); }
      put('C56',catalog.nuts[second.standardId].document);
      put('M26',`Різьба шпильки · гайка на боці ${otherSide}`); put('M72',`Різьба шпильки · гайка на боці ${otherSide}`);
      put('M19',`Різьба шпильки · гайка на боці ${primarySide}`); put('M71',`Різьба шпильки · гайка на боці ${primarySide}`);
      f('M40','B52'); put('M74',`Різьба гайки · бік ${otherSide}`); put('M73',`Різьба гайки · бік ${primarySide}`);
    }
    for (const [side,row] of [['a',59],['b',68]]) {
      const active = [side,'both'].includes(node.washers.placement);
      put('C'+row,active ? node.washers.material.name : '-'); put('C'+(row+1),active ? washer.thicknessMm : 0);
      put('C'+(row+2),active ? (washer.innerDiameterMm+washer.outerDiameterMm)/2 : 0);
      put('C'+(row+3),active ? (washer.outerDiameterMm-washer.innerDiameterMm)/2 : 0);
      f('C'+(row+4),'C40');
    }
    const extraCount = node.extras.length;
    put('C105',extraCount === 1 ? node.extras[0].material.name : extraCount ? `${extraCount} елементів — аркуш «Проставки»` : '-');
    if (!extraCount) { for (const address of ['C108','C110','C106','D106','I12','J12']) put(address,0); }
    else if (extraCount === 1) {
      put('C108',n(node.extras[0].thickness)); put('C110',n(node.extras[0].area));
    } else {
      const start = extraRows.length+2;
      node.extras.forEach(extra => {
        const row=extraRows.length+2, grade=C.resolveMaterial(materials,extra.material)?.grade;
        extraRows.push([node.name,extra.name || extra.material.name,n(extra.thickness),n(extra.area),
          C.propertyAt(grade,'E',node.operating.normal.temperature).value*1000,C.propertyAt(grade,'E',node.operating.hydro.temperature).value*1000,
          formula(`C${row}/(D${row}*E${row})`),formula(`C${row}/(D${row}*F${row})`)]);
      });
      const end=extraRows.length+1;
      f('C108',`SUM('Проставки'!C${start}:C${end})`); put('C110','-'); put('C106','-'); put('D106','-');
      f('I12',`SUM('Проставки'!G${start}:G${end})`); f('J12',`SUM('Проставки'!H${start}:H${end})`);
    }
    for (const address of ['C107','D107','C109','D109']) put(address,0);
    const alphaRows = Object.entries(gasket.expansionMicroPerCByTemperatureC).map(([t,a]) => [+t,a]).sort((a,b) => a[0]-b[0]);
    function property(ref,key,mode) {
      const grade = C.resolveMaterial(materials,ref)?.grade;
      return C.propertyAt(grade,key,node.operating[mode].temperature)?.value ?? '-';
    }
    for (const [mode,col,out] of [['normal','C','I'],['hydro','D','J']]) {
      put(col+'4',n(node.operating[mode].pressure)); put(col+'5',n(node.operating[mode].temperature)); put(col+'7',node.operating[mode].medium);
      put(col+'20',gasket.seatingPressureMPa); put(col+'24',gasket.elasticModulusMPa); put(col+'25',gasket.minimumPressureMPa);
      const groups=Object.keys(gasket.mediumGroups);
      let mediumFormula='"-"';
      for (const group of groups.reverse()) mediumFormula=`IF(OR(${gasket.mediumGroups[group].map(text => `${col}7="${text.replaceAll('"','""')}"`).join(',')}),${gasket.mediumCoefficients[group]},${mediumFormula})`;
      f(col+'21',mediumFormula);
      let alpha='"-"';
      for (const [t,a] of [...alphaRows].reverse()) alpha=`IF(${col}5<=${t},${a},${alpha})`;
      f(col+'27',alpha);
      for (const [ref,rows] of [[node.fastener.material,{E:45,Alpha:46,RTm:50,RTp:51}],
        [primary?.material,{RTm:81,RTp:82}],[node.connection.sideA.material,{E:85,Alpha:86,RTm:90,RTp:91}],
        [node.connection.sideB.material,{E:94,Alpha:95,RTm:102,RTp:103}]]) {
        for (const [key,row] of Object.entries(rows)) { const value=property(ref,key,mode); put(col+row,key === 'E' && typeof value === 'number' ? value*1000 : value); }
      }
      for (const [side,row] of [['a',64],['b',73]]) {
        const active=[side,'both'].includes(node.washers.placement);
        put(col+row,active ? property(node.washers.material,'E',mode)*1000 : 0); put(col+(row+1),active ? property(node.washers.material,'Alpha',mode) : 0);
      }
      f(out+'8',`IFERROR($C$60/($C$63*${col}64*3.1415*$C$61*$C$62),0)`);
      f(out+'9',`IFERROR($C$69/($C$72*${col}73*3.1415*$C$70*$C$71),0)`);
      if (extraCount === 1) put(col+'106',property(node.extras[0].material,'E',mode)*1000);
      put(col+'78',hasNut ? 0.87 : '-'); put(col+'79',hasNut ? 0.55 : '-');
      put(col+'96',mount.body ? 0.87 : '-'); put(col+'97',mount.body ? 0.65 : '-');
      put(col+'49',0); put(out+'22',0);
      const expansion = ['C28','C66','C75',mount.body !== 'sideA' && 'C88',mount.body !== 'sideB' && 'C100'];
      f(out+'23',mode === 'hydro' ? '0' : expansion.filter(Boolean).join('+'));
      const checkCol = mode === 'normal' ? 'N' : 'O';
      if (!hasNut) {
        for (const row of [20,21,22,23,24,25,34,35,36,37,38,39,71,73]) put(checkCol+row,'-');
      }
      if (second) {
        if (node.fastener.differentNuts) put(col+'55',property(second.material,'RTp',mode)); else f(col+'55',col+'82');
        f(checkCol+'41','C54'); f(checkCol+'27','C54');
        f(checkCol+'42',col+'78'); f(checkCol+'43',col+'79');
        f(checkCol+'45',mode === 'normal' ? '(C55/2)*0.64' : 'D55*0.25');
      } else if (mount.body === 'sideA') {
        f(checkCol+'45',`IFERROR((${col}91/2)*0.64,"-")`);
      }
      f(out+'32',mode === 'hydro' ? '0' : '(I23-I22)/(I4+I10+I11+I17+I5+I6+I7+I8+I9+I12)');
      // These expansions are informational in ГВ; the agreed total remains zero.
      for (const [row,height,aRow] of [[28,15,27],[66,60,65],[75,69,74],[88,87,86],[100,99,95]]) f(col+row,`IFERROR(C${height}*${col}${aRow}*(${col}5-20)*10^-6,"-")`);
    }
    // Standalone workbook records the missing cast-iron Rp as text, so IFERROR
    // omits N74/O74 just as the source. Never substitute a numeric zero.
    for (const [side,c,hydro,rmRow,rpRow] of [['sideB','R','S',102,103],['sideA','W','X',90,91]]) {
      const config=node.flanges[side];
      const cast=/чавун|сч\s*\d/u.test(C.canonical(node.connection[side].material.name));
      put(side === 'sideA' ? 'V2' : 'Q2',node.connection[side].material.name);
      if (config.mode === 'none') {
        for (const row of [4,5,6,7,8,9,10,11,12]) put(c+row,'-');
      } else {
        for (const [key,row] of [['innerDiameter',4],['boltCircle',5],['outerDiameter',6],['height',9],['coneHeight',10],['wallCylinder',11],['wallCone',12]]) put(c+row,n(config[key]));
        if (node.gasket.mode === 'area') put(c+'7',n(config.gasketDiameter));
        else f(c+'7','F22');
        if (String(config.holeDiameter ?? '').trim() === '') f(c+'8','IF(C34>=27,C34+3,IF(C34>10,C34+2,C34+1))');
        else put(c+'8',n(config.holeDiameter));
      }
      const steel=`MIN(IFERROR((2.5-C${rpRow}/C${rmRow})*C${rpRow},2*C${rpRow}),2*C${rpRow})`;
      f(c+'19',`IF(${c}4="-","-",IFERROR(${cast ? `C${rmRow}/2.2` : `MIN(IFERROR(C${rmRow}/2.6,C${rpRow}/1.5),IFERROR(C${rpRow}/1.5,C${rmRow}/2.6))`},"-"))`);
      f(hydro+'19',`IF(${c}4="-","-",IFERROR(MIN(IFERROR(D${rmRow}/2.6,D${rpRow}/1.5),IFERROR(D${rpRow}/1.5,D${rmRow}/2.6)),"-"))`);
      for (const row of [32,39]) f(c+row,`IFERROR(${cast ? `C${rmRow}/2.2` : `${c}19*1.3`},"-")`);
      for (const [row,section] of [[35,'A'],[42,'B'],[46,'C']]) {
        const allowed=cast && (section !== 'C' || side === 'sideB') ? `C${rmRow}/2.2` : steel;
        f(c+row,`IF(OR(${c}4="-"${section === 'C' ? `,${c}9>${c}12` : ''}),"-",IFERROR(${allowed},"-"))`);
        put(hydro+row,'-');
      }
    }
    // Original body-side pressure cells hide zero pressure, while the app keeps
    // a valid zero. Align these two informational cells with the approved engine.
    f('R31','IFERROR(4*$I$30/(PI()*((R4+2*R12)^2-R4^2)),"-")');
    f('R38','IFERROR(4*$I$30/(PI()*((R4+2*R11)^2-R4^2)),"-")');
    return v;
  }
  const relationPath = path => path.replace(/(^|\/)([^/]+)$/,'$1_rels/$2.rels');
  function resolvePath(source,target) {
    const parts=(source.slice(0,source.lastIndexOf('/')+1)+target).split('/'), stack=[];
    for (const part of parts) { if (part === '..') stack.pop(); else if (part && part !== '.') stack.push(part); }
    return stack.join('/');
  }
  const relativePath=(from,to) => '../'.repeat(from.split('/').length-1)+to;
  const attrs = text => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(match => [match[1],unxml(match[2])]));
  async function create({equipment,nodes,materials,catalog,torques,template = root.FlangeExcelTemplate}) {
    if (!nodes?.length) throw new Error('Немає вузлів для експорту.');
    if (nodes.length > 100) throw new Error('За один раз можна експортувати до 100 вузлів.');
    nodes.forEach((node,i) => {
      const report=inspect(node,materials,catalog);
      if (report.errors.length) throw new Error(`${node.name}: ${report.errors.join(' ')}`);
      if (!(Number.isFinite(torques?.[i]) && torques[i] >= 0)) throw new Error(`${node.name}: задайте невід’ємний момент перевірки.`);
    });
    const bytes = Uint8Array.from(atob(template.base64),c => c.charCodeAt(0));
    const source=openZip(bytes), files=new Map(source.files), types=await source.read('[Content_Types].xml');
    const overrides=new Map([...types.matchAll(/<Override\s([^>]+)\/>/g)].map(match => {const a=attrs(match[1]); return [a.PartName.slice(1),a.ContentType];}));
    // Original sheets and their private assets are replaced by copies for the
    // selected nodes; shared styles, images and strings remain byte-for-byte.
    const privatePart = name => /^xl\/(worksheets\/|tables\/|comments\d|drawings\/)/.test(name) || name === 'xl/calcChain.xml';
    for (const name of files.keys()) if (privatePart(name)) files.delete(name);
    const newOverrides = new Map([...overrides].filter(([name]) => !privatePart(name)));
    const names=safeNames(nodes), extraRows=[], sheetRecords=[], definedNames=[];
    const workbookOriginal=await source.read('xl/workbook.xml');
    for (let i=0;i<nodes.length;i++) {
      const node=nodes[i], index=i+1, sourceIndex=C.mounting(node).bolt ? 2 : 1;
      const originalSheet=`xl/worksheets/sheet${sourceIndex}.xml`, targetSheet=`xl/worksheets/sheet${index}.xml`, copied=new Map();
      async function clone(part,target) {
        if (copied.has(part)) return copied.get(part);
        if (part.startsWith('xl/media/') || part.startsWith('xl/printerSettings/')) return part;
        const dest=target || part.replace(/([^/]+)$/,`export${index}-$1`);
        copied.set(part,dest);
        let content=await source.read(part);
        if (part.startsWith('xl/tables/')) content=content.replace(/<table\s[^>]*>/,tag => tag.replace(/\b(id|name|displayName)="[^"]*"/g,(whole,key) => `${key}="${key === 'id' ? index : 'ExportTable'+index}"`));
        const relsPart=relationPath(part);
        if (source.files.has(relsPart)) {
          let rels=await source.read(relsPart);
          for (const match of [...rels.matchAll(/<Relationship\s[^>]*\/>/g)]) {
            const a=attrs(match[0]);
            if (a.TargetMode === 'External') { rels=rels.replace(match[0],''); continue; }
            const child=await clone(resolvePath(part,a.Target));
            rels=rels.replace(match[0],match[0].replace(/Target="[^"]*"/,`Target="${xml(relativePath(dest,child))}"`));
          }
          setXml(files,relationPath(dest),rels);
        }
        setXml(files,dest,content);
        if (overrides.has(part)) newOverrides.set(dest,overrides.get(part));
        return dest;
      }
      await clone(originalSheet,targetSheet);
      const values=inputs(node,equipment,materials,catalog,torques[i],extraRows);
      let sheet=patchSheet(await source.read(originalSheet),values);
      sheet=sheet.replace(/tabSelected="[^"]*"/g,`tabSelected="${i === 0 ? 1 : 0}"`);
      const notes=['Схеми з оригінального шаблону; за новими розмірами не перебудовуються. Характеристики матеріалів — на момент експорту.',...inspect(node,materials,catalog).warnings];
      const footer=notes.map((note,j) => `<row r="${112+j}"><c r="B${112+j}" t="inlineStr"><is><t>${xml(note)}</t></is></c></row>`).join('');
      // The source retains formatted empty rows through 167. Keep worksheet
      // rows in ascending order; Excel repairs out-of-order cell records.
      let inserted=false;
      sheet=sheet.replace(/<row\b[^>]*\br="(\d+)"[^>]*>/g,(tag,row) => {
        if (!inserted && +row > 111+notes.length) { inserted=true; return footer+tag; }
        return tag;
      });
      if (!inserted) sheet=sheet.replace('</sheetData>',footer+'</sheetData>');
      setXml(files,targetSheet,sheet);
      sheetRecords.push(`<sheet name="${xml(names[i])}" sheetId="${index}" r:id="exportSheet${index}"/>`);
      for (const match of workbookOriginal.matchAll(/<definedName\s([^>]*)>([\s\S]*?)<\/definedName>/g)) {
        const a=attrs(match[1]);
        if (+a.localSheetId === sourceIndex-1 && a.localSheetId !== undefined) {
          const oldName=unxml(match[2]).match(/^'((?:[^']|'')*)'!/)?.[1];
          const value=oldName ? unxml(match[2]).replace(`'${oldName}'!`,`'${names[i].replaceAll("'","''")}'!`) : unxml(match[2]);
          definedNames.push(`<definedName name="${xml(a.name)}" localSheetId="${i}">${xml(value)}</definedName>`);
        }
      }
    }
    if (extraRows.length) {
      const rows=[['Вузол','Елемент','Висота, мм','Площа, мм²','E НУЕ, МПа','E ГВ, МПа','λ НУЕ, мм/Н','λ ГВ, мм/Н'],...extraRows];
      const data=rows.map((row,i) => `<row r="${i+1}">${row.map((value,j) => {
        const address=String.fromCharCode(65+j)+(i+1);
        return typeof value === 'number' ? `<c r="${address}"><v>${value}</v></c>` : value?.formula ? `<c r="${address}"><f>${xml(value.formula)}</f></c>` : `<c r="${address}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
      }).join('')}</row>`).join('');
      const path=`xl/worksheets/sheet${nodes.length+1}.xml`;
      setXml(files,path,`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="28" customWidth="1"/><col min="3" max="8" width="19" customWidth="1"/></cols><sheetData>${data}</sheetData></worksheet>`);
      newOverrides.set(path,overrides.get('xl/worksheets/sheet1.xml'));
      sheetRecords.push(`<sheet name="Проставки" sheetId="${nodes.length+1}" r:id="exportSheet${nodes.length+1}"/>`);
    }
    let workbook=workbookOriginal.replace(/<sheets>[\s\S]*?<\/sheets>/,`<sheets>${sheetRecords.join('')}</sheets>`).replace(/<definedNames>[\s\S]*?<\/definedNames>/,`<definedNames>${definedNames.join('')}</definedNames>`).replace(/<calcPr[^>]*\/>/,'<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>').replace(/activeTab="\d+"/g,'activeTab="0"');
    // Remove source-machine paths and collaborative revision state.
    workbook=workbook.replace(/<mc:AlternateContent[\s\S]*?<\/mc:AlternateContent>/g,'').replace(/<xr:revisionPtr[^>]*\/>/g,'');
    setXml(files,'xl/workbook.xml',workbook);
    let rels=(await source.read('xl/_rels/workbook.xml.rels')).replace(/<Relationship\s[^>]*Type="[^"]*\/(?:worksheet|calcChain)"[^>]*\/>/g,'');
    const sheetRels=sheetRecords.map((_,i) => `<Relationship Id="exportSheet${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('');
    setXml(files,'xl/_rels/workbook.xml.rels',rels.replace('</Relationships>',sheetRels+'</Relationships>'));
    const defaults=[...types.matchAll(/<Default\s[^>]*\/>/g)].map(match => match[0]).join('');
    setXml(files,'[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}${[...newOverrides].map(([name,type]) => `<Override PartName="/${xml(name)}" ContentType="${xml(type)}"/>`).join('')}</Types>`);
    // The extended properties' sheet list belongs to the original four nodes.
    setXml(files,'docProps/app.xml','<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Прокладки</Application></Properties>');
    return zip(files);
  }
  const api={create,inspect,safeNames,inputs,pendingReference,pendingMessage};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.FlangeExcel=api;
})(typeof window !== 'undefined' ? window : globalThis);
