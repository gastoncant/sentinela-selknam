import { useMemo } from 'react';
import proj4 from 'proj4';
import type { Analysis, Candidate } from './crop-types';

const projection = '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs';

export function EvidencePair({ analysis, candidate }: { analysis: Analysis; candidate: Candidate }) {
  const crop = useMemo(() => {
    const { bounds_m: bounds, resolution_m: resolution, size } = analysis.manifest;
    const polygons = candidate.geometry.type === 'Polygon' ? [candidate.geometry.coordinates] : candidate.geometry.coordinates;
    const pixelPolygons = polygons.map(polygon => polygon.map(ring => ring.map(point => {
      const [x, y] = proj4('EPSG:4326', projection, point.slice(0, 2));
      return [(x - bounds[0]) / resolution, (bounds[3] - y) / resolution];
    })));
    const points = pixelPolygons.flat(2);
    const [minX, maxX, minY, maxY] = points.reduce(([x0, x1, y0, y1], p) =>
      [Math.min(x0, p[0]), Math.max(x1, p[0]), Math.min(y0, p[1]), Math.max(y1, p[1])], [Infinity, -Infinity, Infinity, -Infinity]);
    const side = Math.min(size, Math.max(24, (maxX - minX) * 1.7, (maxY - minY) * 1.7));
    const left = Math.max(0, Math.min(size - side, (minX + maxX - side) / 2));
    const top = Math.max(0, Math.min(size - side, (minY + maxY - side) / 2));
    const path = pixelPolygons.flatMap(polygon => polygon.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ') + ' Z')).join(' ');
    return { viewBox: `${left} ${top} ${side} ${side}`, path, size, width: Math.round(side * resolution) };
  }, [analysis, candidate]);
  const color = candidate.properties.signal === 'agua' ? '#5de2ff' : '#ffd17e';
  return <section className="evidence-pair" aria-label="La misma zona ampliada en ambas fechas">
    <h3>Mirar el mismo lugar de cerca</h3>
    <div className="evidence-frames">{[analysis.beforeUrl, analysis.afterUrl].map((url, index) => <figure key={index}>
      <figcaption><strong>{index === 0 ? 'Antes · 2020' : 'Después · 2026'}</strong><span>{new Date(analysis.manifest.dates[index]).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span></figcaption>
      <svg viewBox={crop.viewBox} role="img" aria-label={`Zona seleccionada en ${index === 0 ? 2020 : 2026}, ampliada con su contorno`}>
        <image href={url} width={crop.size} height={crop.size} style={{ imageRendering: 'pixelated' }} />
        <path d={crop.path} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>)}</div>
    <p>El contorno marca la misma superficie en las dos imágenes. El encuadre ampliado abarca unos {crop.width.toLocaleString('es-AR')} metros de lado; cada píxel representa 10 metros.</p>
  </section>;
}
