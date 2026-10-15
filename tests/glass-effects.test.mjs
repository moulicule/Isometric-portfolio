import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

function checkGlassRules(css, file) {
  let count = 0;
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*backdrop-filter:[^{}]*)\}/g)) {
    const standard = declarations.match(/(?:^|;)\s*backdrop-filter:\s*([^;}]+)/);
    const webkit = declarations.match(/(?:^|;)\s*-webkit-backdrop-filter:\s*([^;}]+)/);
    assert.ok(standard, `${file}: ${selector.trim()} lost the standard backdrop-filter`);
    assert.ok(webkit, `${file}: ${selector.trim()} lost the Safari fallback`);
    assert.equal(standard[1].trim(), webkit[1].trim(), `${file}: ${selector.trim()} has different blur values`);
    count++;
  }
  return count;
}

test('production glass styles retain matching standard and Safari filters, including Zen mode', async () => {
  // Exercise Vite's production minifier without rebuilding or writing the scene bundle.
  const result = await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    publicDir: false,
    logLevel: 'silent',
    build: {
      write: false,
      rolldownOptions: { input: fileURLToPath(new URL('../src/style.css', import.meta.url)) }
    }
  });
  const css = result.output
    .filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    .map(asset => String(asset.source)).join('\n');
  const source = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const expected = checkGlassRules(source, 'src/style.css');
  assert.ok(expected > 0);
  assert.equal(checkGlassRules(css, 'production CSS'), expected, 'No glass surface may lose its filters');
  assert.match(css, /\.zen-overlay\{[^{}]*;backdrop-filter:blur\(24px\)/);
  const pin = css.match(/\.hotspot-pin\{([^{}]*)\}/)[1];
  assert.doesNotMatch(pin, /will-change:[^;}]*(?:opacity|filter)/,
    'The hotspot anchor must let its child label blur the room');

  // Files in public/ are copied verbatim, so check their fallbacks separately.
  const publicRoot = new URL('../public/', import.meta.url);
  for (const file of readdirSync(publicRoot, { recursive: true }).filter(file => file.endsWith('.css'))) {
    checkGlassRules(readFileSync(new URL(file, publicRoot), 'utf8'), file);
  }
});
