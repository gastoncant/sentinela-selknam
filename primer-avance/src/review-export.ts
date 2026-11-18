import type { PDFPage } from 'pdf-lib';
import type { Analysis, Candidate, Review } from './crop-types';

export const zoneName = (candidate: Candidate) => {
  const number = candidate.properties.id.split('-').pop();
  return 'Zona de ' + (candidate.properties.signal === 'agua' ? 'agua ' : 'vegetación ') + number;
};

const signalName = (candidate: Candidate) => candidate.properties.signal === 'agua' ? 'Más señal de agua' : 'Menos señal de vegetación';
const dateLabel = (date: string) => new Date(date).toLocaleDateString('es-AR', { timeZone: 'UTC' });
const format = (value: number, digits = 0) => value.toLocaleString('es-AR', { maximumFractionDigits: digits });
const coverage = (analysis: Analysis) => 100 * analysis.manifest.common_pixels / analysis.manifest.pixels;

export function reviewedZones(analysis: Analysis, reviews: Review[]) {
  const byZone = new Map(reviews.map(review => [review.candidate_id, review]));
  return analysis.features.flatMap(candidate => {
    const review = byZone.get(candidate.properties.id);
    return review ? [{ candidate, review }] : [];
  });
}

function csvCell(value: string | number | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  const text = value ?? '';
  // Keep reviewer text literal when the CSV is opened in spreadsheet software.
  const escaped = /^[\s\uFEFF]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/u.test(text) ? "'" + text : text;
  return '"' + escaped.replaceAll('"', '""') + '"';
}

export function reviewCsv(analysis: Analysis, zones: ReturnType<typeof reviewedZones>) {
  const { dates, scenes, center, method_sha256: methodHash } = analysis.manifest;
  const headers = ['recorte_id', 'zona_id', 'señal', 'superficie_m2', 'cambio_ndwi', 'cambio_ndvi',
    'observación_antes_utc', 'observación_después_utc', 'escena_antes', 'escena_después',
    'longitud_centro_recorte', 'latitud_centro_recorte', 'cobertura_común_pct',
    'estado_revisión', 'observación', 'fecha_revisión', 'versión_revisión', 'método_sha256'];
  const rows = zones.map(({ candidate, review }) => {
    const { id, signal, area_m2, delta_ndwi, delta_ndvi } = candidate.properties;
    return [analysis.id, id, signal, area_m2, delta_ndwi, delta_ndvi,
      dates[0], dates[1], scenes[0], scenes[1], center?.[0], center?.[1],
      Number(coverage(analysis).toFixed(2)), review.state, review.reason, review.at, review.version, methodHash];
  });
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function downloadExport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function wrapLines(text: string, fits: (line: string) => boolean): string[] {
  const lines: string[] = [];
  for (const paragraph of text.trim().replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const combined = line ? line + ' ' + word : word;
      if (fits(combined)) { line = combined; continue; }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && !fits(line + character)) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function reviewPdf(analysis: Analysis, candidate: Candidate, review: Review,
  images: readonly (string | Uint8Array)[], extentM: number) {
  const { PDFDocument, PageSizes, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Sentinela Selknam - ' + zoneName(candidate));
  pdf.setSubject('Informe de revisión de un recorte Sentinel-2');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const glyphs = new Set(font.getCharacterSet());
  const [width, height] = PageSizes.A4;
  const margin = 40;
  const bodyWidth = width - 2 * margin;
  const navy = rgb(0.09, 0.23, 0.33);
  const secondary = rgb(0.24, 0.35, 0.42);
  const orange = rgb(0.91, 0.53, 0.19);
  const bodySize = 11;
  const leading = 16;
  const label = (page: PDFPage, text: string, top: number, size = 11, options: { x?: number; bold?: boolean; hint?: boolean } = {}) => {
    page.drawText(text, { x: options.x ?? margin, y: height - top - size, size,
      font: options.bold ? bold : font, color: options.hint ? secondary : navy });
  };
  function createPage(heading: string) {
    const page = pdf.addPage(PageSizes.A4);
    page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: orange });
    label(page, 'SENTINELA SELKNAM  /  ISLA GRANDE DE TIERRA DEL FUEGO', 32, 10, { bold: true });
    label(page, heading, 52, 25, { bold: true });
    return page;
  }
  let page = createPage('Informe de revisión');
  label(page, zoneName(candidate), 91, 17, { bold: true });
  label(page, signalName(candidate) + '  /  Superficie: ' + format(candidate.properties.area_m2) + ' m²', 121);
  label(page, 'Cobertura común del recorte: ' + format(coverage(analysis), 1) + ' %  /  Resolución: ' + analysis.manifest.resolution_m + ' m', 140);
  if (analysis.manifest.center?.length >= 2) {
    const [longitude, latitude] = analysis.manifest.center;
    label(page, 'Centro del recorte: ' + latitude.toFixed(4) + '°, ' + longitude.toFixed(4) + '°', 159, 10, { hint: true });
  }

  const gap = 15;
  const frame = (bodyWidth - gap) / 2;
  const imageTop = 210;
  for (const [index, imageData] of images.entries()) {
    const x = margin + index * (frame + gap);
    label(page, (index === 0 ? 'Antes' : 'Después') + '  /  ' + dateLabel(analysis.manifest.dates[index]), 188, 12, { x, bold: true });
    const image = await pdf.embedPng(imageData);
    page.drawImage(image, { x, y: height - imageTop - frame, width: frame, height: frame });
  }
  let top = imageTop + frame + 11;
  label(page, 'La línea del mismo color marca la zona revisada en ambas imágenes.', top, 10, { hint: true });
  top += 15;
  label(page, 'Imágenes infrarrojas Sentinel-2. El encuadre abarca aprox. ' + format(extentM) + ' m de lado.', top, 10, { hint: true });
  top += 15;
  const scenes = analysis.manifest.scenes.filter(Boolean).join(' / ');
  if (scenes) {
    for (const line of wrapLines('Escenas: ' + scenes, text => font.widthOfTextAtSize(text, 9) <= bodyWidth)) {
      label(page, line, top, 9, { hint: true }); top += 13;
    }
  }
  top += 17;
  page.drawLine({ start: { x: margin, y: height - top + 8 }, end: { x: width - margin, y: height - top + 8 }, thickness: 0.6, color: secondary });
  label(page, 'Revisión guardada', top, 14, { bold: true });
  top += 22;
  label(page, review.state, top, 11, { bold: true });
  top += 17;
  const reviewedAt = new Date(review.at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Ushuaia', dateStyle: 'short', timeStyle: 'short' });
  label(page, reviewedAt + ' (hora argentina)  /  Versión ' + review.version, top, 10, { hint: true });
  top += 21;

  const encoded = (line: string) => Array.from(line).every(character => glyphs.has(character.codePointAt(0)!));
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const scale = 3;
  if (canvas) {
    canvas.width = Math.ceil(bodyWidth * scale);
    canvas.height = leading * scale;
  }
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    ctx.font = bodySize * scale + 'px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#173b54';
  }
  const fits = (line: string) => encoded(line) ? font.widthOfTextAtSize(line, bodySize) <= bodyWidth :
    !!ctx && ctx.measureText(line).width <= bodyWidth * scale;
  for (const line of wrapLines(review.reason.normalize(), fits)) {
    if (top + leading > height - 72) {
      page = createPage('Continuación de la revisión');
      label(page, zoneName(candidate), 92, 13, { bold: true });
      top = 119;
    }
    if (line) {
      if (encoded(line)) label(page, line, top, bodySize);
      else {
        if (!ctx || !canvas) throw new Error('No se pudo representar el comentario.');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillText(line, 0, canvas.height / 2, bodyWidth * scale);
        const image = await pdf.embedPng(canvas.toDataURL('image/png'));
        page.drawImage(image, { x: margin, y: height - top - leading, width: bodyWidth, height: leading });
      }
    }
    top += leading;
  }

  const pages = pdf.getPages();
  for (const [index, sheet] of pages.entries()) {
    label(sheet, 'Zona: ' + candidate.properties.id, height - 56, 7, { hint: true });
    label(sheet, 'El cambio observado requiere comprobación antes de atribuirlo a castores.', height - 38, 9, { hint: true });
    label(sheet, (index + 1) + ' / ' + pages.length, height - 38, 9, { hint: true, x: width - margin - 25 });
  }
  return pdf.save();
}
