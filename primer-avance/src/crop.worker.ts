import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { analyse, measure, cropGrid, METHOD, SIZE, RES, UTM, type Bands } from './crop-analysis';
import type { CropRequest, Scene } from './crop-types';
import methodSource from './crop-analysis.ts?raw';
import processorSource from './crop.worker.ts?raw';

const report = (message: string) => self.postMessage({ type: 'progress', message });
const sha = async (bytes: BufferSource) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');

async function search(center: number[], year: number): Promise<Scene[]> {
  const url = new URL('https://earth-search.aws.element84.com/v1/search');
  url.searchParams.set('collections', 'sentinel-2-l2a');
  url.searchParams.set('intersects', JSON.stringify({ type: 'Point', coordinates: center }));
  url.searchParams.set('datetime', `${year}-01-01T00:00:00Z/${year}-03-31T23:59:59Z`);
  url.searchParams.set('query', JSON.stringify({ 'eo:cloud_cover': { lt: 70 } }));
  url.searchParams.set('sortby', '+properties.eo:cloud_cover');
  url.searchParams.set('limit', '8');
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`El catálogo no respondió (${response.status}).`);
  const data = await response.json();
  if (!data.features?.length) throw new Error(`No encontramos escenas para enero–marzo de ${year} en este recorte.`);
  return data.features;
}

async function readAsset(item: Scene, band: string, bounds: number[]) {
  const asset = item.assets[band];
  const url = new URL(asset.href);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.amazonaws.com')) throw new Error('Origen de banda no admitido');
  const tiff = await fromUrl(asset.href, { allowFullFile: false, blockSize: 65536, cacheSize: 64 });
  try {
    const image = await tiff.getImage();
    const keys = image.getGeoKeys();
    const epsg = Number(keys?.ProjectedCSTypeGeoKey);
    if (![32719, 32720].includes(epsg)) throw new Error('Proyección satelital no admitida');
    const sourceProjection = `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`;
    const [ox, oy] = image.getOrigin(), [rx, ry] = image.getResolution();
    if (!(rx > 0 && ry < 0) || ![10, 20].includes(rx)) throw new Error('Grilla satelital incompatible');
    const transform = proj4(UTM, sourceProjection);
    const corners = [[bounds[0], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[1]], [bounds[2], bounds[3]]].map(p => transform.forward(p));
    const left = Math.max(0, Math.floor((Math.min(...corners.map(p => p[0])) - ox) / rx) - 2);
    const right = Math.min(image.getWidth(), Math.ceil((Math.max(...corners.map(p => p[0])) - ox) / rx) + 2);
    const top = Math.max(0, Math.floor((Math.max(...corners.map(p => p[1])) - oy) / ry) - 2);
    const bottom = Math.min(image.getHeight(), Math.ceil((Math.min(...corners.map(p => p[1])) - oy) / ry) + 2);
    const result = new Float64Array(SIZE * SIZE); result.fill(NaN);
    if (right <= left || bottom <= top) return result;
    if ((right - left) * (bottom - top) > 2_000_000) throw new Error('La ventana de lectura excede el límite');
    const raster = await image.readRasters({ window: [left, top, right, bottom], samples: [0], interleave: true });
    const meta = asset['raster:bands']?.[0];
    if (band !== 'scl' && (!meta || typeof item.properties['earthsearch:boa_offset_applied'] !== 'boolean')) throw new Error('Falta la escala radiométrica');
    const offset = item.properties['earthsearch:boa_offset_applied'] ? 0 : meta?.offset || 0;
    const width = right - left;
    for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
      const point = transform.forward([bounds[0] + (col + 0.5) * RES, bounds[3] - (row + 0.5) * RES]);
      const x = Math.floor((point[0] - ox) / rx) - left, y = Math.floor((point[1] - oy) / ry) - top;
      if (x < 0 || x >= width || y < 0 || y >= bottom - top) continue;
      const raw = Number(raster[y * width + x]);
      result[row * SIZE + col] = band === 'scl' ? raw : raw === meta!.nodata ? NaN : raw * meta!.scale + offset;
    }
    return result;
  } finally { await tiff.close(); }
}

async function choose(items: Scene[], bounds: number[], year: number) {
  let best: { item: Scene; scl: Float64Array; valid: number } | null = null;
  for (const [i, item] of items.slice(0, 4).entries()) {
    report(`Buscando una observación utilizable de ${year} (${i + 1} de hasta 4)…`);
    try {
      const scl = await readAsset(item, 'scl', bounds);
      const valid = scl.reduce((sum, v) => sum + ([4, 5, 6].includes(v) ? 1 : 0), 0);
      if (!best || valid > best.valid) best = { item, scl, valid };
      if (valid / scl.length >= 0.97) break;
    } catch (error) { console.warn('Escena no disponible', item.id, error); }
  }
  if (!best || best.valid === 0) throw new Error(`No hay observación despejada utilizable de ${year}. Elegí otro recorte.`);
  report(`Leyendo bandas de ${year}: ${best.item.properties.datetime.slice(0, 10)}…`);
  const [green, red, nir] = await Promise.all(['green', 'red', 'nir'].map(band => readAsset(best!.item, band, bounds)));
  return { item: best.item, bands: { green, red, nir, scl: best.scl } as Bands };
}

async function frame(bands: Bands, common: Uint8Array) {
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let i = 0; i < common.length; i++) {
    for (const [channel, name] of (['nir', 'red', 'green'] as const).entries())
      rgba[i * 4 + channel] = common[i] ? Math.sqrt(Math.max(0, Math.min(1, bands[name][i] / 0.4))) * 255 : 85;
    rgba[i * 4 + 3] = 255;
  }
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, SIZE, SIZE), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

self.onmessage = async (event: MessageEvent<CropRequest>) => {
  try {
    const { center } = event.data;
    if (!center.every(Number.isFinite) || center[0] < -68.8 || center[0] > -65 || center[1] < -55.2 || center[1] > -52.5) throw new Error('Recorte fuera del sector argentino de la isla');
    const bounds = cropGrid(center);
    report('Buscando escenas Sentinel-2 de las dos temporadas…');
    const [itemsBefore, itemsAfter] = await Promise.all([search(center, 2020), search(center, 2026)]);
    const before = await choose(itemsBefore, bounds, 2020), after = await choose(itemsAfter, bounds, 2026);
    report('Comparando agua y vegetación a 10 metros…');
    const methodHash = await sha(new TextEncoder().encode(methodSource + '\n' + processorSource));
    const signature = JSON.stringify({ method: METHOD, method_sha256: methodHash, bounds, scenes: [before.item.id, after.item.id] });
    const id = 'recorte-' + (await sha(new TextEncoder().encode(signature))).slice(0, 16);
    const result = analyse(before.bands, after.bands, bounds, id);
    if (!result.commonPixels) throw new Error('Las dos observaciones no tienen superficie válida en común. Elegí otro recorte.');
    const sourceMetadata = [before.item, after.item];
    const sourceHashes = await Promise.all(sourceMetadata.map(item => sha(new TextEncoder().encode(JSON.stringify(item)))));
    const pixelHashes = await Promise.all([before, after].map(async scene => Object.fromEntries(await Promise.all(Object.entries(scene.bands).map(async ([name, array]) => [name, await sha(array.buffer as ArrayBuffer)])))));
    const manifest = { center, bounds_m: bounds, crs: 32719, size: SIZE, resolution_m: RES,
      scenes: sourceMetadata.map(item => item.id), dates: sourceMetadata.map(item => item.properties.datetime),
      common_pixels: result.commonPixels, pixels: SIZE * SIZE, method_sha256: methodHash,
      method_version: METHOD, threshold: 0.25, min_pixels: 4, count: result.features.length,
      source_metadata: sourceMetadata, source_hashes: sourceHashes, sampled_band_sha256: pixelHashes,
      floating_point: 'IEEE 754 float64, bandas calibradas e índices sin redondeo intermedio',
      season_windows: ['2020-01-01/2020-03-31', '2026-01-01/2026-03-31'],
      selection: 'Menor nubosidad de catálogo, hasta cuatro escenas por temporada; primera con >=97% SCL válida o la mejor entre las examinadas.',
      valid_pixels_by_date: [measure(before.bands).valid, measure(after.bands).valid].map(values => values.reduce((sum, v) => sum + v, 0)),
      scope: 'Recorte rectangular; no es una cuenca ni una detección confirmada de castores.' };
    self.postMessage({ type: 'result', id, manifest, features: result.features,
      before: await frame(before.bands, result.common), after: await frame(after.bands, result.common) });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo preparar el recorte.' });
  }
};
