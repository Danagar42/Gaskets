'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../core.js'),P=require('../project.js');
const KEY='flange-workspace-v1';
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject};};

// Isolated document/storage doubles: exercise the real app event handlers,
// without touching the user's browser, files or localStorage.
function app(options={}) {
  const equipment=options.equipment || [C.createEquipment('Насос А'),C.createEquipment('Насос Б')];
  if (!options.equipment) equipment.forEach(item=>item.nodes.push(C.createNode('Кришка')));
  const original={version:1,equipment,preferences:{recent:[],favorites:[]}};
  const storage=new Map([[KEY,JSON.stringify(original)]]), elements=new Map(), downloads=[], blobs=new Map();
  const documentEvents={},windowEvents={},pendingExport=deferred();
  const faults={read:false,write:null};
  let downloadButton=null;
  function element() {
    const el = {open:false,hidden:true,textContent:'',value:'replace',isConnected:true,events:{},classList:{toggle(){}},dataset:{},style:{},
      closest(){return el;},
      addEventListener(type,handler){this.events[type]=handler;},showModal(){this.open=true;},close(){this.open=false;},focus(){},
      setAttribute(){},append(){},prepend(){},insertAdjacentHTML(){},
      querySelector(sel){return sel==='input[name="import-mode"]:checked'?{value:'replace'}:elements.get(sel)||element();},
      querySelectorAll(sel){return sel==='[data-excel-torque]'?[{value:'100',dataset:{}}]:[element(),element()];}};
    el.parentElement = el;
    return el;
  }
  for (const name of ['#main','#edit-dialog','#material-dialog','#file-dialog','#file-error','#import-preview','#save-status','.header-status','#toast','#breadcrumbs','#desktop-content','#results','.settings','.torque-value','.torque-comparison','#storage-warning-banner']) elements.set(name,element());
  const dialog=elements.get('#file-dialog');let dialogHtml='';
  Object.defineProperty(dialog,'innerHTML',{get:()=>dialogHtml,set:html=>{
    dialogHtml=html;
    if(downloadButton)downloadButton.isConnected=false;
    elements.get('#file-error').hidden=true;elements.get('#file-error').textContent='';
  }});
  const document={querySelector:selector=>elements.get(selector)||element(),querySelectorAll:()=>[element(),element()],
    addEventListener:(event,handler)=>{documentEvents[event]=handler;},
    createElement:()=>({className:'',id:'',innerHTML:'',setAttribute(){},append(){},prepend(){},
      click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}})};
  const location={hash:`#equipment/${equipment[0].id}`};
  const window={FlangeCore:C,FlangeProject:P,FlangeStandardsDB:{},
    FlangeComponentVisuals:{assembly:()=>'<svg></svg>',radialSection:()=>'',stackVisual:()=>'',detailSide:()=>''},
    FlangeExcel:{inspect:()=>({errors:[],warnings:[],limits:{maximum:{roundedTorqueNm:100}}}),create:()=>pendingExport.promise},
    addEventListener:(event,handler)=>{windowEvents[event]=handler;},...options.window};
  const context=vm.createContext({structuredClone,console,window,document,location,materialsDB:options.materials || [],Blob,FormData,
    URL:{createObjectURL(blob){const url=`blob:${blobs.size}`;blobs.set(url,blob);return url;},revokeObjectURL(){}},
    localStorage:{getItem(key){if(faults.read)throw new Error('Storage access denied');return storage.get(key)||null;},
      setItem(key,value){if(faults.write===key)throw new Error('Quota exceeded');storage.set(key,value);}},setTimeout:()=>0,clearTimeout(){}});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8'),context);
  function click(action,data={}) {
    const button={dataset:{action,...data},disabled:false,isConnected:true};
    if(action==='download-excel')downloadButton=button;
    documentEvents.click({target:{closest:()=>button}});
    return button;
  }
  const upload={id:'project-upload',isConnected:true,files:[]};
  const select=file=>{upload.files=[file];return dialog.events.change({target:upload});};
  return {click,select,upload,dialog,elements,storage,downloads,faults,pendingExport,equipment,
    dispatch(type,target){documentEvents[type]({target});},
    navigate(index){location.hash=`#equipment/${equipment[index].id}`;windowEvents.hashchange();},
    navigateNode(eqIndex,nodeIndex){
      location.hash=`#node/${equipment[eqIndex].id}/${equipment[eqIndex].nodes[nodeIndex].id}`;
      windowEvents.hashchange();
    }};
}
const importJson=()=>P.serialize({version:1,equipment:[C.createEquipment('Імпортований насос')]});

(async()=>{
  const sample=require('../examples/pump-600v-first-three.json');
  const readAppFile=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
  const sampleApp=app({equipment:sample.equipment,materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:require('../excel-export.js')}});
  sampleApp.click('excel-export',{scope:'equipment'});
  const cards=sampleApp.dialog.innerHTML.split('<section class="export-node">').slice(1).map(card=>card.split('</section>')[0]);
  assert.equal(cards.length,3);
  for (const index of [0,2]) {
    assert(cards[index].includes('data-id="'+sample.equipment[0].nodes[index].id+'" data-path="connection.sideB.material"'));
    assert(cards[index].includes('НУЕ (45 °C) — E; ГВ (20 °C) — E.'),'A stud uses body modulus in both modes and excludes body expansion');
    assert(cards[index].includes('Деталі перевірки'));
  }
  assert(!cards[1].includes('focus-input'),'A complete node has no correction link');

  const preciseEquipment = structuredClone(sample.equipment);
  const preciseNode = preciseEquipment[0].nodes[1];
  preciseNode.operating.normal.pressure = '1.23456';
  preciseNode.operating.hydro.pressure = '0.00123456';
  preciseNode.fastener.torqueNm = '0.00000012345';
  preciseNode.fastener.targetTorqueMinNm = '100.12345';
  preciseNode.fastener.targetTorqueMaxNm = '200.56789';
  const excel = require('../excel-export.js');
  let exportedTorques;
  const precisionApp = app({equipment:preciseEquipment,materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:{...excel,create:async options => {
        exportedTorques = options.torques;
        return new Uint8Array();
      }}}});
  const register = precisionApp.elements.get('#desktop-content').innerHTML;
  assert.match(register,/1,23 МПа/,'Node summaries show at most two decimal places');
  assert.match(register,/1,23[EЕ]-3 МПа/,'Small nonzero values keep their magnitude in scientific notation');
  assert.match(register,/100,12–200,57/,'Torque ranges use the same precision');
  assert.doesNotMatch(register,/100[,.]12345|200[,.]56789/,'Torque tooltips use the same precision');
  precisionApp.click('excel-export',{scope:'equipment'});
  const torqueMarkup = precisionApp.dialog.innerHTML.match(/data-excel-torque="1"[^>]*value="([^"]+)" data-raw-value="([^"]+)"/);
  assert.match(torqueMarkup?.[1] ?? '',/^1,23[EЕ]-7$/,'Export dialog displays two decimal places');
  const torqueInput = {value:torqueMarkup[1],dataset:{excelTorque:'1',rawValue:torqueMarkup[2]},isConnected:true};
  precisionApp.dispatch('focusin',torqueInput);
  assert.equal(torqueInput.value,'0,00000012345','Focusing the input reveals the exact value');
  precisionApp.dispatch('focusout',torqueInput);
  assert.equal(torqueInput.value,torqueMarkup[1],'The blurred input shows the rounded value again');
  precisionApp.dialog.querySelectorAll = () => [torqueInput];
  precisionApp.click('download-excel');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(Array.from(exportedTorques),[0.00000012345],'Excel uses the full precision of the torque');
  precisionApp.click('project-file');
  precisionApp.click('save-project');
  const savedPrecise = P.parse(await precisionApp.downloads.at(-1).blob.text()).equipment[0].nodes[1];
  assert.equal(savedPrecise.operating.normal.pressure,'1.23456','Saving retains the original precision');

  let selected = false;
  const numInput = {value:'123',dataset:{number:'true',field:'operating.normal.pressure'},isConnected:true,select(){selected = true;}};
  precisionApp.dispatch('focusin',numInput);
  assert.equal(selected, true, 'Numeric input calls select() on focusin');

  const collideNode = structuredClone(sample.equipment[0].nodes[1]);
  collideNode.fastener.nominalDiameter = '24';
  collideNode.fastener.targetTorqueMinNm = '140';
  collideNode.fastener.targetTorqueMaxNm = '143';
  const collideApp = app({equipment:[{...sample.equipment[0], nodes:[collideNode]}],
    materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:require('../excel-export.js')}});
  const collideHtml = collideApp.elements.get('#desktop-content').innerHTML;
  assert(collideHtml.includes('ruler-labels-track top collision'), 'Top ruler track has collision class when target limits collide');
  assert(collideHtml.includes('ruler-marker-label tu staggered'), 'Target max marker has staggered class when colliding');

  const copyEquip = structuredClone(sample.equipment);
  const copyNode = copyEquip[0].nodes[1];
  copyNode.connection.kind = 'flange-flange';
  copyNode.connection.sideA.name = 'Фланець 1';
  copyNode.connection.sideB.name = 'Фланець 2';
  copyNode.connection.sideA.material = {name:'Сталь 20',kp:'215',description:''};
  copyNode.connection.sideB.material = {name:'12Х18Н10Т',kp:'240',description:''};
  const copyAppState = app({equipment:copyEquip,
    materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:require('../excel-export.js')}});
  copyAppState.navigateNode(0, 1);
  const editDialog = copyAppState.elements.get('#edit-dialog');
  copyAppState.click('copy-connection-side', {side:'sideA'});
  assert.equal(editDialog.open, true, 'Confirmation dialog opens before copying Side A to Side B');
  assert(editDialog.innerHTML.includes('Замінити матеріал і геометричні розміри деталі Б параметрами деталі А'), 'Dialog has correct confirmation message');
  copyAppState.click('close-edit');
  assert.equal(editDialog.open, false, 'Dialog closes on cancel');
  assert.equal(copyNode.connection.sideB.material.name, '12Х18Н10Т', 'Material not overwritten when cancelled');
  copyAppState.click('copy-connection-side', {side:'sideA'});
  assert.equal(editDialog.open, true);
  copyAppState.click('confirm-action');
  assert.equal(editDialog.open, false, 'Dialog closes on confirm');
  assert.equal(copyAppState.elements.get('#toast').textContent, 'Параметри деталі А скопійовано в деталь Б.');
  copyAppState.click('project-file');
  copyAppState.click('save-project');
  const savedNode = P.parse(await copyAppState.downloads.at(-1).blob.text()).equipment[0].nodes[1];
  assert.equal(savedNode.connection.sideB.material.name, 'Сталь 20', 'Material is copied upon confirmation');
  assert.equal(savedNode.connection.sideB.name, 'Фланець 2', 'Target name is preserved');

  copyAppState.click('editor-step', {step:'results'});
  const resultsHtml = copyAppState.elements.get('#results').innerHTML;
  assert(resultsHtml.includes('data-action="editor-previous"'), 'Results view includes persistent back button');
  assert(resultsHtml.includes('Назад до параметрів'), 'Back button has correct text');
  assert(resultsHtml.includes('Розрахунок геометрії, навантаження, температурних зусиль, міцності кріплення та рекомендованих меж моменту затягування.'), 'Notice has updated text');

  let state=app();state.faults.read=true;
  assert.doesNotThrow(()=>state.click('project-file'),'Storage read failure must not prevent saving an in-memory project to JSON');
  assert(state.dialog.open);
  state.click('save-project');
  assert.equal(P.parse(await state.downloads[0].blob.text()).equipment.length,2,'A JSON backup still downloads when storage cannot be read');

  state=app();state.click('project-file');
  const slow=deferred();const first=state.select({size:1,text:()=>slow.promise});
  await state.select({size:1,text:async()=>importJson()});
  assert(!state.elements.get('#import-preview').hidden);
  slow.reject(new Error('Old file read failed'));await first;
  assert(state.elements.get('#file-error').hidden,'An old read failure must not overwrite the new valid import preview');

  for (const failingKey of [KEY,`${KEY}-before-import`]) {
    state=app();const original=state.storage.get(KEY);state.click('project-file');
    await state.select({size:1,text:async()=>importJson()});state.faults.write=failingKey;state.click('apply-import');
    assert.equal(state.storage.get(KEY),original);
    assert(!state.elements.get('#file-error').hidden);
    state.click('save-project');
    const saved=P.parse(await state.downloads[0].blob.text());
    assert.deepEqual(saved.equipment.map(item=>item.id),state.equipment.map(item=>item.id),'Failed import must preserve the in-memory workspace too');
  }

  for (const outcome of ['success','failure']) {
    state=app();state.click('excel-export',{scope:'equipment'});state.click('download-excel');
    state.navigate(1);state.click('excel-export',{scope:'equipment'});
    if(outcome==='success')state.pendingExport.resolve(new Uint8Array([1,2]));
    else state.pendingExport.reject(new Error('Previous export failed'));
    await new Promise(resolve=>setImmediate(resolve));
    if(outcome==='success') {
      assert.equal(state.downloads.length,1,'The original export must still download after navigation');
      assert.equal(state.downloads[0].name,'Насос А — Кришка.xlsx','Background export retains its original equipment name');
    } else assert(state.elements.get('#file-error').hidden,'A previous export failure must not appear in the new dialog');
    assert(state.dialog.open,'Finishing a previous export must not close the new dialog');
  }
  // AUD-038: Storage warning banner on quota exceeded
  const quotaApp = app({equipment:sample.equipment});
  quotaApp.faults.write = KEY;
  quotaApp.click('copy-node', {id: sample.equipment[0].nodes[0].id});
  assert.equal(quotaApp.elements.get('#storage-warning-banner').hidden, false, 'Storage warning banner becomes visible when quota is exceeded');
  quotaApp.faults.write = null;
  quotaApp.click('copy-node', {id: sample.equipment[0].nodes[0].id});
  assert.equal(quotaApp.elements.get('#storage-warning-banner').hidden, true, 'Storage warning banner hides when save succeeds');

  // AUD-010: Connection type 'flange-cover'
  const fcNode = C.createNode('Фланцева кришка', 'flange-cover');
  assert.equal(fcNode.connection.kind, 'flange-cover');
  assert.equal(fcNode.connection.sideA.name, 'Фланець');
  assert.equal(fcNode.connection.sideB.name, 'Кришка');
  const fcEquip = structuredClone(sample.equipment);
  fcEquip[0].nodes.push(fcNode);
  const fcApp = app({equipment:fcEquip,
    materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:require('../excel-export.js')}});
  fcApp.navigateNode(0, fcEquip[0].nodes.length - 1);
  const fcHtml = fcApp.elements.get('#main').innerHTML;
  assert(fcHtml.includes('Фланець — кришка'), 'UI displays flange-cover connection type');

  // AUD-009: Pressure unit conversion
  const pressureNode = fcEquip[0].nodes[1];
  pressureNode.operating.normal.pressure = '2';
  pressureNode.operating.normal.pressureUnit = 'bar';
  const unitApp = app({equipment:fcEquip,
    materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:require('../excel-export.js')}});
  unitApp.navigateNode(0, 1);
  unitApp.dispatch('change', {dataset:{pressureUnit:'normal'}, value:'bar'});
  unitApp.dispatch('input', {dataset:{field:'operating.normal.pressure',pressureKey:'normal',number:'true'}, value:'30'});
  unitApp.click('project-file');
  unitApp.click('save-project');
  const savedUnitNode = P.parse(await unitApp.downloads.at(-1).blob.text()).equipment[0].nodes[1];
  assert.equal(savedUnitNode.operating.normal.pressure, '3', 'Entering 30 bar converts to 3 MPa internally');
  assert.equal(savedUnitNode.operating.normal.pressureUnit, 'bar', 'Pressure unit is stored as bar');

  // AUD-001: Selective valid node export
  const exportEquip = structuredClone(sample.equipment);
  const exportApp = app({equipment:exportEquip,
    materials:vm.runInNewContext(readAppFile('data.js')+';materialsDB'),
    window:{FlangeStandardsDB:vm.runInNewContext(readAppFile('standards.bundle.js')+';FlangeStandardsDB'),
      FlangeCalculations:require('../calculations.js'),FlangeExcel:require('../excel-export.js')}});
  exportApp.click('excel-export', {scope:'equipment'});
  const exportDialogHtml = exportApp.dialog.innerHTML;
  assert(exportDialogHtml.includes('data-excel-node-select="1" checked'), 'Valid node has checked checkbox');
  assert(exportDialogHtml.includes('data-excel-node-select="0" disabled'), 'Invalid node has disabled checkbox');

  console.log('App files: storage denial/quota, import atomicity, stale reads and background export passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
