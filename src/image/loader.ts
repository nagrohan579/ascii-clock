export interface LoadedImage {
  image: HTMLImageElement;
  data: ImageData;
  width: number;
  height: number;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/** Draws the image to an offscreen canvas at the given pixel size and returns ImageData. */
export function rasterize(img: HTMLImageElement, w: number, h: number): LoadedImage {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // cover-fit
  const ir = img.width / img.height;
  const tr = w / h;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (ir > tr) {
    sw = img.height * tr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / tr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return { image: img, data, width: w, height: h };
}

export async function loadAndRasterize(url: string, w: number, h: number): Promise<LoadedImage> {
  const img = await loadImage(url);
  return rasterize(img, w, h);
}
