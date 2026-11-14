'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');

const root = path.join(__dirname,'..');
const files = (folder,extension) => fs.readdirSync(path.join(root,folder),{withFileTypes:true})
  .filter(entry => entry.isFile() && entry.name.endsWith(extension))
  .map(entry => path.join(folder,entry.name)).sort();
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const sha256 = data => createHash('sha256').update(data).digest('hex');
let passed = 0, failed = 0;

function check(label,run) {
  console.log(`\nПеревірка: ${label}`);
  try { run(); passed++; console.log('OK'); }
  catch (error) { failed++; console.error(`ПОМИЛКА: ${error.message}`); }
}
function node(...args) {
  const result = spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args.join(' ')}: ${result.signal || `код ${result.status}`}`);
}

check('синтаксис JavaScript',() => {
  for (const file of [...files('.','.js'),...files('.','.cjs'),...files('scripts','.cjs'),...files('tests','.cjs')]) node('--check',file);
});

check('автономний каталог відповідає standards/**/*.json',() => {
  const context = vm.createContext({});
  vm.runInContext(read('standards.bundle.js'),context);
  const expected = {version:1,washers:{},nuts:{},threads:{},gaskets:{}};
  for (const category of ['washers','nuts','threads','gaskets']) {
    for (const file of files(path.join('standards',category),'.json')) {
      const record = JSON.parse(read(file));
      assert.equal(record.id,path.basename(file,'.json'),`${file}: ID має відповідати назві файла`);
      expected[category][record.id] = record;
    }
  }
  assert.deepEqual(JSON.parse(JSON.stringify(context.FlangeStandardsDB)),expected,
    'Каталог застарів. Виконайте python scripts/build-standards.py');
});

check('автономний шаблон Excel відповідає оригіналу',() => {
  const context = vm.createContext({});
  vm.runInContext(read('excel-template.bundle.js'),context);
  const template = context.FlangeExcelTemplate;
  assert.equal(template.name,'Насос 600В-1,6_100.xlsx');
  assert.equal(sha256(Buffer.from(template.base64,'base64')),template.sha256,'Пошкоджений вбудований Excel');
  assert.equal(sha256(fs.readFileSync(path.join(root,template.name))),template.sha256,
    'Шаблон застарів. Виконайте python scripts/build-excel-template.py та повторіть нативну звірку');
});

for (const file of ['test_core.cjs',...files('tests','.cjs')]) check(file,() => node(file));
check('наскрізна звірка з контрольними значеннями Excel',() => node('scripts/verify-workbook.cjs','--check'));

console.log(`\nУспішно: ${passed}. Помилок: ${failed}.`);
console.log('Новий перерахунок у Microsoft Excel і перевірка інтерфейсу виконуються окремо (docs/EXPORT.md).');
process.exitCode = failed ? 1 : 0;
