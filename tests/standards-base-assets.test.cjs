// tests/standards-base-assets.test.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = path.resolve(__dirname, '..', 'standards-base');
assert.ok(fs.existsSync(path.join(baseDir, 'assets', 'tailwind-local.css')), 'tailwind-local.css must exist');
assert.ok(fs.existsSync(path.join(baseDir, 'assets', 'favicon.png')), 'favicon.png must exist');
assert.ok(fs.existsSync(path.join(baseDir, 'styles.css')), 'styles.css must exist');

const tailwindStat = fs.statSync(path.join(baseDir, 'assets', 'tailwind-local.css'));
assert.ok(tailwindStat.size > 10000, 'tailwind-local.css must not be empty');

const faviconStat = fs.statSync(path.join(baseDir, 'assets', 'favicon.png'));
assert.ok(faviconStat.size > 100, 'favicon.png must not be empty');

const cssContent = fs.readFileSync(path.join(baseDir, 'styles.css'), 'utf8');
assert.ok(cssContent.includes('.glass-panel'), 'styles.css must define .glass-panel');
assert.ok(cssContent.includes('.fluent-card'), 'styles.css must define .fluent-card');
assert.ok(cssContent.includes('.cad-canvas'), 'styles.css must define .cad-canvas');
console.log('Task 1 assets test passed');
