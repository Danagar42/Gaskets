'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const repo = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(repo,name),'utf8');
const html = read('index.html');
const header = html.match(/<header class="app-header">([\s\S]+?)<\/header>/)[1];
assert.equal((header.match(/data-action="open-standards"/g) || []).length,1);
assert.match(html,/id="main"/);
const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
for (const name of ['standards.bundle.js','flange-catalog.bundle.js','standards-base/src/catalog-adapter.js',
  'standards-base/src/flange-reference.js','standards-base/src/drawing-templates.js','standards-base/src/drawing-engine.js',
  'standards-base/src/app.js']) {
  assert.ok(scripts.includes(name) && scripts.indexOf(name) < scripts.indexOf('app.js'),`${name} must load before app.js`);
  assert.ok(read(name).length > 0);
}
assert.match(html,/<link rel="stylesheet" href="standards-base\/styles\.css">/);
assert.match(read('standards-base/styles.css'),/\.reference-table-scroll[^}]+overflow:\s*auto/);

const formerPage = read('standards-base/index.html');
let redirect;
vm.runInNewContext(formerPage.match(/<script>([\s\S]+?)<\/script>/)[1],{
  location:{replace(value){redirect = value;}}
});
assert.equal(redirect,'../index.html#standards');
assert.match(formerPage,/href="\.\.\/index\.html#standards"/);
console.log('Integrated standards reference assets and legacy redirect passed.');
