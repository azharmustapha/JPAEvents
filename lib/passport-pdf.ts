import { PDFDocument, PDFString } from 'pdf-lib';
import { passportToPng } from './passport-image';

export async function passportToPdf(card: HTMLElement): Promise<Uint8Array> {
  const qrLink = card.querySelector<HTMLAnchorElement>('[data-passport-qr-link]');
  if (!qrLink) throw new Error('Pautan QR pasport tidak ditemui.');

  const png = await passportToPng(card);
  const bounds = card.getBoundingClientRect();
  const qrBounds = qrLink.getBoundingClientRect();
  const width = 360;
  const scale = width / bounds.width;
  const height = bounds.height * scale;
  const margin = 12;

  const pdf = await PDFDocument.create();
  pdf.setTitle('Pasport Digital JPAEvents');
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([width + margin * 2, height + margin * 2]);
  page.drawImage(image, { x: margin, y: margin, width, height });

  // Browser coordinates start at the top; PDF coordinates start at the bottom.
  const x = margin + (qrBounds.left - bounds.left) * scale;
  const y = margin + (bounds.height - (qrBounds.top - bounds.top) - qrBounds.height) * scale;
  const annotation = pdf.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + qrBounds.width * scale, y + qrBounds.height * scale],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(qrLink.href) },
  });
  page.node.addAnnot(pdf.context.register(annotation));
  return pdf.save();
}

export async function downloadPassportPdf(card: HTMLElement, officerName: string): Promise<void> {
  const bytes = await passportToPdf(card);
  const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.download = `Pasport-JPAEvents-${officerName.replace(/\s+/g, '_')}.pdf`;
  link.href = url;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Keep the blob alive while mobile browsers begin the download.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
