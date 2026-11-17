import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const folder = 'public/province/';
const manifest = JSON.parse(await readFile(folder + 'manifest.json', 'utf8'));
assert.deepEqual(manifest.dates, ['2020-02-08', '2026-03-13']);
assert.equal(manifest.native_resolution_m, 250);
assert.equal(manifest.regions.length, 1);
for (const [name, expected] of Object.entries(manifest.hashes)) {
  const bytes = await readFile(folder + name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
}
for (const region of manifest.regions) {
  assert(region.bbox[0] < region.bbox[2] && region.bbox[1] < region.bbox[3]);
  assert.deepEqual(region.frames.map(frame => frame.date), manifest.dates);
  for (const frame of region.frames) {
    const url = new URL(frame.url);
    assert.equal(url.origin, 'https://gibs.earthdata.nasa.gov');
    assert.equal(url.searchParams.get('time'), frame.date);
    const bytes = await readFile(folder + frame.file);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
  }
  assert.notEqual(manifest.hashes[region.frames[0].file], manifest.hashes[region.frames[1].file]);
}
const boundary = JSON.parse(await readFile(folder + 'boundary.geojson', 'utf8'));
assert.equal(boundary.features[0].properties.code, '94');
const coordinates = boundary.features[0].geometry.coordinates.flat(2);
assert(coordinates.length > 100);
for (const [longitude, latitude] of coordinates) {
  assert(longitude >= -69 && longitude <= -65);
  assert(latitude >= -55.25 && latitude <= -52.35);
}
assert.equal(boundary.features[0].geometry.coordinates.length, 1, 'El contorno debe limitarse a la Isla Grande.');
const places = JSON.parse(await readFile(folder + 'places.json', 'utf8'));
assert(places.length >= 2);
assert(places.every(place => place.lat >= -55.25 && place.lat <= -52.35 && place.lon >= -71.5 && place.lon <= -65));
assert(coordinates.some(([longitude, latitude]) => longitude < -67 && latitude > -56), 'Falta el sector fueguino.');
console.log('OK · Isla Grande · dos imágenes fechadas · hashes y ejes geográficos verificados.');
