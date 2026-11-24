import { toCanvas } from 'html-to-image';

type ImageRect = { x: number; y: number; width: number; height: number };
type ImageSize = { width: number; height: number };

export function getContainedImageRect(container: ImageRect, image: ImageSize): ImageRect {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: container.x + (container.width - width) / 2,
    y: container.y + (container.height - height) / 2,
    width,
    height,
  };
}

export async function passportToPng(card: HTMLElement): Promise<string> {
  const logoElement = card.querySelector<HTMLImageElement>('[data-passport-logo] img');
  if (!logoElement) throw new Error('Logo pasport tidak ditemui.');

  // Draw originals directly: SVG foreignObject can omit nested images on mobile.
  const imageElements = [logoElement, ...Array.from(card.querySelectorAll<HTMLImageElement>('[data-passport-theme] img'))];
  const images = await Promise.all(imageElements.map(async element => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = element.currentSrc || element.src;
    await image.decode();
    return { element, image };
  }));
  await document.fonts.ready;

  const cardBounds = card.getBoundingClientRect();
  // Snapshot all coordinates together before asynchronous rasterization.
  const placements = images.map(({ element, image }) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = parseFloat(style.paddingLeft) || 0;
    const right = parseFloat(style.paddingRight) || 0;
    const top = parseFloat(style.paddingTop) || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    const placement = getContainedImageRect({
      x: bounds.left - cardBounds.left + left,
      y: bounds.top - cardBounds.top + top,
      width: bounds.width - left - right,
      height: bounds.height - top - bottom,
    }, { width: image.naturalWidth, height: image.naturalHeight });
    return { image, placement };
  });

  const canvas = await toCanvas(card, {
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    // Wrappers keep the layout while original images are drawn onto the canvas.
    filter: node => !imageElements.includes(node as HTMLImageElement),
  });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Imej pasport tidak dapat dijana.');

  context.save();
  context.scale(canvas.width / cardBounds.width, canvas.height / cardBounds.height);
  for (const { image, placement } of placements) {
    context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  }
  context.restore();
  return canvas.toDataURL('image/png');
}
