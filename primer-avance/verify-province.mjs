import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const folder = 'public/province/';
const manifest = JSON.parse(await readFile(folder + 'manifest.json', 'utf8'));
assert.equal(manifest.projection, 'EPSG:4326');
assert.equal(new URL(manifest.boundary.url).hostname, 'wms.ign.gob.ar');
assert.equal(new URL(manifest.places.url).hostname, 'apis.datos.gob.ar');
assert.deepEqual(Object.keys(manifest.hashes).sort(), ['boundary.geojson', 'places.json']);
for (const [name, expected] of Object.entries(manifest.hashes)) {
  const bytes = await readFile(folder + name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
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
console.log('OK · selector de Isla Grande · contorno · localidades · hashes y ejes geográficos verificados.');
