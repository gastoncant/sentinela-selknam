import proj4 from 'proj4';
import type { Candidate } from './crop-types';

export const UTM = '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs';
export const METHOD = 'sentinela-recortes-v1-10m-scl456-delta025-4px';
export const SIZE = 512;
export const RES = 10;
export const THRESHOLD = 0.25;

export function cropGrid(center: number[], size = SIZE) {
  const [x, y] = proj4('EPSG:4326', UTM, center);
  const left = Math.floor(x / 20) * 20 - size * RES / 2;
  const top = Math.floor(y / 20) * 20 + size * RES / 2;
  return [left, top - size * RES, left + size * RES, top];
}

export function index(a: number, b: number) {
  return Number.isFinite(a + b) && a + b > 0 ? (a - b) / (a + b) : NaN;
}

export type Bands = { green: Float64Array; red: Float64Array; nir: Float64Array; scl: Float64Array };
export function measure(bands: Bands) {
  const n = bands.green.length;
  const water = new Float64Array(n), vegetation = new Float64Array(n), valid = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    water[i] = index(bands.green[i], bands.nir[i]);
    vegetation[i] = index(bands.nir[i], bands.red[i]);
    valid[i] = [4, 5, 6].includes(bands.scl[i]) && Number.isFinite(water[i]) && Number.isFinite(vegetation[i]) ? 1 : 0;
  }
  return { water, vegetation, valid };
}

// Exact cell boundaries for a four-connected raster component, including holes.
export function cellRings(cells: number[], size: number) {
  const inside = new Set(cells);
  type Edge = { start: number; end: number; dir: number; used: boolean };
  const edges: Edge[] = [], outgoing = new Map<number, Edge[]>();
  const vertex = (x: number, y: number) => y * (size + 1) + x;
  function add(x: number, y: number, xx: number, yy: number, dir: number) {
    const edge = { start: vertex(x, y), end: vertex(xx, yy), dir, used: false };
    edges.push(edge);
    outgoing.set(edge.start, [...(outgoing.get(edge.start) || []), edge]);
  }
  for (const cell of cells) {
    const x = cell % size, y = Math.floor(cell / size);
    if (y === 0 || !inside.has(cell - size)) add(x, y, x + 1, y, 0);
    if (x === size - 1 || !inside.has(cell + 1)) add(x + 1, y, x + 1, y + 1, 1);
    if (y === size - 1 || !inside.has(cell + size)) add(x + 1, y + 1, x, y + 1, 2);
    if (x === 0 || !inside.has(cell - 1)) add(x, y + 1, x, y, 3);
  }
  const rings: number[][][] = [];
  for (const first of edges) {
    if (first.used) continue;
    const points: number[][] = [];
    let edge = first;
    for (let step = 0; step <= edges.length; step++) {
      edge.used = true;
      points.push([edge.start % (size + 1), Math.floor(edge.start / (size + 1))]);
      if (edge.end === first.start) { points.push(points[0]); break; }
      const options = (outgoing.get(edge.end) || []).filter(item => !item.used);
      const priority = [1, 0, 3, 2];
      options.sort((a, b) => priority.indexOf((a.dir - edge.dir + 4) % 4) - priority.indexOf((b.dir - edge.dir + 4) % 4));
      if (!options.length) throw new Error('Contorno de componente incompleto');
      edge = options[0];
    }
    // Remove collinear vertices while retaining exact raster geometry.
    const clean = points.slice(0, -1).filter((p, i, array) => {
      const a = array[(i + array.length - 1) % array.length], b = array[(i + 1) % array.length];
      return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
    });
    clean.push(clean[0]);
    rings.push(clean);
  }
  return rings;
}

function signedArea(ring: number[][]) {
  return ring.slice(0, -1).reduce((sum, a, i) => sum + a[0] * ring[i + 1][1] - ring[i + 1][0] * a[1], 0) / 2;
}
function contains(ring: number[][], p: number[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

export function analyse(before: Bands, after: Bands, bounds: number[], run: string, size = SIZE) {
  const a = measure(before), b = measure(after), n = size * size;
  if ([before, after].some(bands => Object.values(bands).some(values => values.length !== n))) throw new Error('Grilla incompatible');
  const common = new Uint8Array(n), dw = new Float64Array(n), dv = new Float64Array(n);
  let commonPixels = 0;
  for (let i = 0; i < n; i++) {
    common[i] = a.valid[i] && b.valid[i] ? 1 : 0;
    commonPixels += common[i];
    dw[i] = b.water[i] - a.water[i]; dv[i] = b.vegetation[i] - a.vegetation[i];
  }
  const features: Candidate[] = [];
  for (const signal of ['agua', 'vegetacion'] as const) {
    const mask = Uint8Array.from(common, (valid, i) => valid && (signal === 'agua' ? dw[i] >= THRESHOLD : -dv[i] >= THRESHOLD) ? 1 : 0);
    for (let start = 0; start < n; start++) {
      if (!mask[start]) continue;
      const cells = [start]; mask[start] = 0;
      for (let head = 0; head < cells.length; head++) {
        const cell = cells[head], x = cell % size;
        const neighbors = [cell - size, cell + size, ...(x > 0 ? [cell - 1] : []), ...(x < size - 1 ? [cell + 1] : [])];
        for (const next of neighbors) if (next >= 0 && next < n && mask[next]) { mask[next] = 0; cells.push(next); }
      }
      if (cells.length < 4) continue;
      const rings = cellRings(cells, size);
      const outers = rings.filter(ring => signedArea(ring) > 0), holes = rings.filter(ring => signedArea(ring) < 0);
      const polygons = outers.map(outer => [outer, ...holes.filter(hole => contains(outer, hole[0]))].map(ring =>
        ring.slice().reverse().map(([x, y]) => proj4(UTM, 'EPSG:4326', [bounds[0] + x * RES, bounds[3] - y * RES]))));
      features.push({ type: 'Feature', geometry: polygons.length === 1
        ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons },
      properties: { id: `${run}-${signal}-${features.length + 1}`, signal, area_m2: cells.length * RES ** 2,
        delta_ndwi: Number((cells.reduce((sum, i) => sum + dw[i], 0) / cells.length).toFixed(4)),
        delta_ndvi: Number((cells.reduce((sum, i) => sum + dv[i], 0) / cells.length).toFixed(4)) } });
    }
  }
  return { features, common, commonPixels };
}
