'use strict';
const catalog = FlangeStandardsDB;
const d = 24;
const pitch = FlangeCore.threadPitch(catalog,'gost-24705-2004',d).pitchMm;
const nutHeight = FlangeCore.nutDimensions(catalog,'gost-5915-70',d).heightMm;
const w = FlangeCore.washerDimensions(catalog,'gost-11371-78',d);
const number = FlangeCore.formatNumber;
const parts = {
  stud:{length:112,name:'Шпилька',spec:`М${number(d)} × ${number(pitch)}`,detail:'Витки різьби',outer:d,inner:0,h:112},
  nut:{diameter:24,acrossFlats:36,name:'Гайка',spec:`М${d} · m = ${number(nutHeight)}`,detail:'Внутрішня різьба',outer:42,inner:d,h:nutHeight},
  gasket:{name:'Прокладка',spec:'Ø 320 × Ø 200 × 3',detail:'Кромка графіту',outer:320,inner:200,h:3},
  washer:{diameter:24,name:'Шайба',spec:`Ø ${number(w.outerDiameterMm)} × Ø ${number(w.innerDiameterMm)} × ${number(w.thicknessMm)}`,detail:'Кромка отвору',outer:w.outerDiameterMm,inner:w.innerDiameterMm,h:w.thicknessMm}
};
const styles=FlangeComponentVisuals.styles;
const selector=document.querySelector('#part'), grid=document.querySelector('#grid');
const styleSelector=document.querySelector('#styles');
let activeStyle=0;
const cache=new Map();
function display() {
  const selected=selector.value, comparison=selected!=='all';
  grid.classList.toggle('compare',comparison);
  document.querySelector('#heading').textContent=comparison?parts[selected].name:styles[activeStyle].name;
  document.querySelector('#description').textContent=comparison?parts[selected].spec+' · Два способи відображення':styles[activeStyle].desc;
  styleSelector.value=String(activeStyle);
  const entries=comparison?styles.map((_,i)=>[selected,i]):Object.keys(parts).map(key=>[key,activeStyle]);
  grid.replaceChildren(...entries.map(([key,index])=>{
    const p=parts[key],s=styles[index],id=s.id+'-'+key;
    if(!cache.has(id)) {
      cache.set(id,FlangeComponentVisuals.create(s.id,key,p,pitch));
    }
    const card=document.createElement('article');
    card.innerHTML=`<div class="scene ${s.id}"></div><div class="card-foot"><div><h3>${comparison?s.name:p.name}</h3><small>${p.spec}</small></div><button type="button">${comparison?'Комплект':'Порівняти'}</button></div>`;
    card.firstElementChild.append(cache.get(id));
    const button=card.querySelector('button');
    button.setAttribute('aria-label',comparison?'Переглянути комплект · '+s.name:'Порівняти два варіанти · '+p.name);
    button.onclick=()=>{activeStyle=index;selector.value=comparison?'all':key;display()};
    return card;
  }));
}
for(const [i,s] of styles.entries()) styleSelector.add(new Option(s.name,String(i)));
styleSelector.onchange=()=>{activeStyle=Number(styleSelector.value);selector.value='all';display()};
for(const [key,p] of Object.entries(parts))selector.add(new Option(p.name,key));
selector.onchange=display;
display();
