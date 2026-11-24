import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transpileModule, ModuleKind } from 'typescript';
import * as pdfLib from 'pdf-lib';

// Rasterization needs a browser; keep PDF generation and parsing real.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const destination = 'https://drive.google.com/drive/folders/test?usp=drive_link';

async function exporter(renderImage = async () => png) {
  let source;
  try {
    source = await readFile(new URL('../../lib/passport-pdf.ts', import.meta.url), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  }
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, name => {
    if (name === 'pdf-lib') return pdfLib;
    if (name === './passport-image') return { passportToPng: renderImage };
    throw new Error(`Unexpected import: ${name}`);
  });
  return exports.passportToPdf;
}

function cardFixture(link = true) {
  return {
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 300, height: 600 }),
    querySelector: selector => {
      assert.equal(selector, '[data-passport-qr-link]');
      return link ? {
        href: destination,
        getBoundingClientRect: () => ({ left: 190, top: 600, width: 150, height: 150 }),
      } : null;
    },
  };
}

test('downloaded passport PDF contains its image and a clickable link exactly over the QR', async () => {
  const exportPdf = await exporter();
  assert.equal(typeof exportPdf, 'function', 'PDF export is available');
  const bytes = await exportPdf(cardFixture());
  const pdf = await pdfLib.PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  const page = pdf.getPage(0);
  assert.deepEqual(page.getSize(), { width: 384, height: 744 });
  assert.equal(page.node.Resources().lookup(pdfLib.PDFName.of('XObject'), pdfLib.PDFDict).keys().length, 1);
  const annotations = page.node.Annots();
  assert.equal(annotations.size(), 1);
  const link = annotations.lookup(0, pdfLib.PDFDict);
  assert.equal(link.lookup(pdfLib.PDFName.of('Subtype')).toString(), '/Link');
  assert.deepEqual(link.lookup(pdfLib.PDFName.of('Rect'), pdfLib.PDFArray).asArray().map(n => n.asNumber()), [120, 72, 300, 252]);
  const action = link.lookup(pdfLib.PDFName.of('A'), pdfLib.PDFDict);
  assert.equal(action.lookup(pdfLib.PDFName.of('S')).toString(), '/URI');
  assert.equal(action.lookup(pdfLib.PDFName.of('URI'), pdfLib.PDFString).decodeText(), destination);
});

test('PDF export refuses to silently save a passport without a clickable QR', async () => {
  const exportPdf = await exporter();
  assert.equal(typeof exportPdf, 'function', 'PDF export is available');
  await assert.rejects(exportPdf(cardFixture(false)), /QR/);
});

test('PDF export propagates image rendering errors instead of saving an incomplete passport', async () => {
  const exportPdf = await exporter(async () => { throw new Error('Logo unavailable'); });
  assert.equal(typeof exportPdf, 'function', 'PDF export is available');
  await assert.rejects(exportPdf(cardFixture()), /Logo unavailable/);
});
