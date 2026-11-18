import proj4 from 'proj4';
import type { Analysis, Candidate } from './crop-types';

const projection = '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs';

export function evidenceCrop(analysis: Analysis, candidate: Candidate) {
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
  const path = pixelPolygons.flatMap(polygon => polygon.map(ring => ring.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ') + ' Z')).join(' ');
  return { left, top, side, path, size, width: Math.round(side * resolution), color: candidate.properties.signal === 'agua' ? '#5de2ff' : '#ffd17e' };
}

export async function captureEvidence(analysis: Analysis, crop: ReturnType<typeof evidenceCrop>) {
  return Promise.all([analysis.beforeUrl, analysis.afterUrl].map(async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');
    context.imageSmoothingEnabled = false;
    const scale = canvas.width / crop.side;
    context.setTransform(scale, 0, 0, scale, -crop.left * scale, -crop.top * scale);
    context.drawImage(image, 0, 0, crop.size, crop.size);
    const outline = new Path2D(crop.path);
    context.lineJoin = 'round';
    context.lineWidth = 6 / scale;
    context.strokeStyle = '#163442';
    context.stroke(outline);
    context.lineWidth = 3.5 / scale;
    context.strokeStyle = crop.color;
    context.stroke(outline);
    return canvas.toDataURL('image/png');
  }));
}
