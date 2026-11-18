import assert from 'node:assert/strict';
import proj4 from 'proj4';
import { cropIdentity, sha256 } from './src/run-identity.ts';
import { reviewQueue } from './src/review-queue.ts';
import { analyse, measure, index, cropGrid, cellRings, UTM } from './src/crop-analysis.ts';

assert(Number.isNaN(index(0, 0)));
assert(Number.isNaN(index(NaN, 1)));
assert.equal(index(3, 1), 0.5);
const bounds = cropGrid([-67.65, -54.48]);
assert.equal(bounds[2] - bounds[0], 5120);
assert.equal(bounds[3] - bounds[1], 5120);
assert(bounds.every(v => v % 20 === 0));

const size = 8, n = size ** 2;
function base() { return { green: new Float64Array(n).fill(0.1), red: new Float64Array(n).fill(0.1), nir: new Float64Array(n).fill(0.3), scl: new Float64Array(n).fill(4) }; }
const before = base(), after = base();
// Two valid four-cell components, one cloud-contaminated region, isolated noise.
const water = [0, 1, 8, 9], vegetation = [36, 37, 44, 45];
for (const i of water) after.green[i] = 0.6;
for (const i of vegetation) after.red[i] = 0.3;
after.green[63] = 0.6;
for (const i of [4, 5, 12, 13]) { after.green[i] = 0.6; before.scl[i] = 9; }
const grid = [610000, 3950000, 610080, 3950080];
const result = analyse(before, after, grid, 'test', size);
assert.equal(result.commonPixels, 60);
assert.equal(result.features.length, 2);
assert.deepEqual(result.features.map(f => f.properties.signal), ['agua', 'vegetacion']);
assert(result.features.every(f => f.properties.area_m2 === 400));
assert(result.features.every(f => f.properties.id.startsWith('test-')));
assert.equal(result.features[0].properties.delta_ndwi, 0.8333);
assert.equal(result.features[1].properties.delta_ndvi, -0.5);
const restored = result.features[0].geometry.coordinates[0].map(p => proj4('EPSG:4326', UTM, p));
const area = Math.abs(restored.slice(0, -1).reduce((sum, p, i) => sum + p[0] * restored[i + 1][1] - restored[i + 1][0] * p[1], 0) / 2);
assert(Math.abs(area - 400) < 0.1, 'El polígono debe conservar la superficie de las celdas, no su caja envolvente.');
const hole = cellRings([0, 1, 2, 3, 5, 6, 7, 8], 3);
assert.equal(hole.length, 2, 'Se debe conservar el hueco central.');
const ringArea = ring => ring.slice(0, -1).reduce((sum, p, i) => sum + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0) / 2;
assert.equal(hole.reduce((sum, ring) => sum + ringArea(ring), 0), 8);
const cloud = base(); cloud.scl.fill(8);
const empty = analyse(cloud, after, grid, 'empty', size);
assert.equal(empty.commonPixels, 0); assert.equal(empty.features.length, 0);
const invalid = base(); invalid.green[0] = NaN;
assert.equal(measure(invalid).valid[0], 0);
assert.throws(() => analyse(base(), base(), grid, 'wrong', 9), /Grilla incompatible/);
// Four-neighbor connectivity must not merge diagonal-only components.
const diagonal = base();
for (const i of [0, 1, 8, 9, 18, 19, 26, 27]) diagonal.green[i] = 0.6;
assert.equal(analyse(base(), diagonal, grid, 'diagonal', size).features.length, 2);
const bytes = new Uint8Array([0, 1, 2]);
const first = await sha256(bytes);
const scene = { id: 'mismo-id', date: '2026-03-13', bands: { red: first, nir: 'otra-banda' } };
const id = await cropIdentity('metodo', grid, [scene]);
assert.equal(id, await cropIdentity('metodo', grid, [{ ...scene, bands: { nir: 'otra-banda', red: first } }]));
bytes[1] = 3;
assert.notEqual(id, await cropIdentity('metodo', grid, [{ ...scene, bands: { ...scene.bands, red: await sha256(bytes) } }]));
assert.notEqual(id, await cropIdentity('metodo', grid, [{ ...scene, date: '2026-03-14' }]));
const [waterZone, vegetationZone] = result.features;
const reviewed = [{ candidate_id: waterZone.properties.id }];
assert.deepEqual(reviewQueue(result.features, reviewed, 'todas', 'area', true), [vegetationZone]);
const larger = { ...vegetationZone, properties: { ...vegetationZone.properties, area_m2: 500 } };
assert.deepEqual(reviewQueue([waterZone, larger], [], 'todas', 'area', false), [larger, waterZone]);
assert.deepEqual(reviewQueue([waterZone, larger], [], 'todas', 'intensity', false), [waterZone, larger]);
assert.deepEqual(reviewQueue([waterZone, larger], [], 'vegetacion', 'intensity', false), [larger]);
console.log('OK · grilla 10 m · índices · nubes y nodata · ruido · conectividad · áreas y huecos · IDs por ejecución');
