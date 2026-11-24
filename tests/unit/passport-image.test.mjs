import test from 'node:test';
import assert from 'node:assert/strict';
import { getContainedImageRect, passportToPng } from '../../lib/passport-image.ts';
import { readFile } from 'node:fs/promises';
import { transpileModule, ModuleKind } from 'typescript';

const rendererSource = transpileModule(await readFile(new URL('../../lib/passport-image.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS },
}).outputText;

function renderer(toCanvas, Image, document, getComputedStyle) {
  const exports = {};
  new Function('exports', 'require', 'Image', 'document', 'getComputedStyle', rendererSource)(
    exports, name => {
      assert.equal(name, 'html-to-image');
      return { toCanvas };
    }, Image, document, getComputedStyle,
  );
  return exports.passportToPng;
}

test('fits a portrait logo inside its space without stretching or clipping', () => {
  assert.deepEqual(getContainedImageRect(
    { x: 24, y: 32, width: 40, height: 40 },
    { width: 100, height: 200 },
  ), { x: 34, y: 32, width: 20, height: 40 });
});

test('centers a landscape logo inside its space', () => {
  assert.deepEqual(getContainedImageRect(
    { x: 24, y: 32, width: 40, height: 40 },
    { width: 200, height: 100 },
  ), { x: 24, y: 42, width: 40, height: 20 });
});

test('keeps a square logo in the full available space', () => {
  assert.deepEqual(getContainedImageRect(
    { x: 24, y: 32, width: 40, height: 40 },
    { width: 500, height: 500 },
  ), { x: 24, y: 32, width: 40, height: 40 });
});

test('does not export a passport when its logo is missing', async () => {
  await assert.rejects(passportToPng({ querySelector: () => null }), /Logo/);
});

test('logo and theme stay in place when the viewer scrolls during passport rendering', async () => {
  let scroll = 0;
  const drawn = [];
  const logo = { getBoundingClientRect: () => ({ left: 20, top: 120 - scroll, width: 40, height: 40 }) };
  const theme = { src: '/theme.png', getBoundingClientRect: () => ({ left: 30, top: 180 - scroll, width: 240, height: 80 }) };
  const card = { querySelector: () => logo, querySelectorAll: () => [theme],
    getBoundingClientRect: () => ({ left: 10, top: 100 - scroll, width: 300, height: 400 }) };
  class DecodedImage {
    naturalWidth = 100;
    naturalHeight = 100;
    async decode() { if (this.src === '/theme.png') { this.naturalWidth = 300; this.naturalHeight = 100; } }
  }
  const render = renderer(async (element, options) => {
    assert.equal(element, card);
    assert.equal(options.filter(logo), false);
    assert.equal(options.filter(theme), false);
    scroll = 40;
    return { width: 900, height: 1200,
      getContext: () => ({ save() {}, scale() {}, restore() {}, drawImage: (...args) => drawn.push(args.slice(1)) }),
      toDataURL: () => 'data:image/png;base64,preview' };
  }, DecodedImage, { fonts: { ready: Promise.resolve() } }, () => ({}));
  assert.equal(await render(card), 'data:image/png;base64,preview');
  assert.deepEqual(drawn, [[10, 20, 40, 40], [20, 80, 240, 80]]);
});

test('a theme image that cannot decode stops the export instead of silently omitting it', async () => {
  let rasterized = false;
  class BrokenImage {
    async decode() { if (this.src === '/theme.png') throw new Error('Theme image unavailable'); }
  }
  const render = renderer(async () => { rasterized = true; }, BrokenImage, {}, () => ({}));
  await assert.rejects(render({ querySelector: () => ({}), querySelectorAll: () => [{ src: '/theme.png' }] }), /Theme image unavailable/);
  assert.equal(rasterized, false);
});
