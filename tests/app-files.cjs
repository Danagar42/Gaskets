'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../core.js'),P=require('../project.js');
const KEY='flange-workspace-v1';
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject};};

// Isolated document/storage doubles: exercise the real app event handlers,
// without touching the user's browser, files or localStorage.
function app() {
  const equipment=[C.createEquipment('Насос А'),C.createEquipment('Насос Б')];
  equipment.forEach(item=>item.nodes.push(C.createNode('Кришка')));
  const original={version:1,equipment,preferences:{recent:[],favorites:[]}};
  const storage=new Map([[KEY,JSON.stringify(original)]]), elements=new Map(), downloads=[], blobs=new Map();
  const documentEvents={},windowEvents={},pendingExport=deferred();
  const faults={read:false,write:null};
  let downloadButton=null;
  function element() {
    return {open:false,hidden:true,textContent:'',value:'',isConnected:true,events:{},classList:{toggle(){}},
      addEventListener(type,handler){this.events[type]=handler;},showModal(){this.open=true;},close(){this.open=false;},focus(){},
      querySelector(){return {value:'replace'};},querySelectorAll(){return [{value:'100'}];}};
  }
  for (const name of ['#main','#edit-dialog','#material-dialog','#file-dialog','#file-error','#import-preview','#save-status','.header-status','#toast','#breadcrumbs','#desktop-content']) elements.set(name,element());
  const dialog=elements.get('#file-dialog');let dialogHtml='';
  Object.defineProperty(dialog,'innerHTML',{get:()=>dialogHtml,set:html=>{
    dialogHtml=html;
    if(downloadButton)downloadButton.isConnected=false;
    elements.get('#file-error').hidden=true;elements.get('#file-error').textContent='';
  }});
  const document={querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[],
    addEventListener:(event,handler)=>{documentEvents[event]=handler;},
    createElement:()=>({click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}})};
  const location={hash:`#equipment/${equipment[0].id}`};
  const window={FlangeCore:C,FlangeProject:P,FlangeStandardsDB:{},
    FlangeExcel:{inspect:()=>({errors:[],warnings:[],limits:{maximum:{roundedTorqueNm:100}}}),create:()=>pendingExport.promise},
    addEventListener:(event,handler)=>{windowEvents[event]=handler;}};
  const context=vm.createContext({window,document,location,materialsDB:[],Blob,FormData,
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
    navigate(index){location.hash=`#equipment/${equipment[index].id}`;windowEvents.hashchange();}};
}
const importJson=()=>P.serialize({version:1,equipment:[C.createEquipment('Імпортований насос')]});

(async()=>{
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
  console.log('App files: storage denial/quota, import atomicity, stale reads and background export passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
