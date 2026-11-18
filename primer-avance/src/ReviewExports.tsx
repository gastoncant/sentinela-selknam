import { useState } from 'react';
import type { Analysis, Candidate, Review } from './crop-types';
import { captureEvidence, evidenceCrop } from './evidence-crop';
import { downloadExport, reviewCsv, reviewPdf, type reviewedZones } from './review-export';

export function ReviewExports({ analysis, candidate, review, rows }: {
  analysis: Analysis; candidate?: Candidate; review?: Review; rows: ReturnType<typeof reviewedZones>;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function downloadPdf() {
    if (!candidate || !review) return;
    setPending(true);
    setMessage('');
    try {
      const crop = evidenceCrop(analysis, candidate);
      const images = await captureEvidence(analysis, crop);
      const pdf = await reviewPdf(analysis, candidate, review, images, crop.width);
      const filename = 'sentinela-' + candidate.properties.id + '-r' + review.version + '.pdf';
      downloadExport(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), filename);
      setMessage('Si no aparece el archivo, revisá las descargas del navegador.');
    } catch (error) {
      console.error('No se pudo crear el PDF.', error);
      setMessage('No pudimos preparar el PDF. Volvé a abrir el recorte y reintentá cuando se vean las dos imágenes.');
    } finally { setPending(false); }
  }

  function downloadCsv() {
    const file = new Blob([reviewCsv(analysis, rows)], { type: 'text/csv;charset=utf-8' });
    downloadExport(file, analysis.id + '-revisiones.csv');
  }

  return <section className="review-exports" aria-labelledby="review-exports-title">
    <h3 id="review-exports-title">Descargar revisiones</h3>
    <button type="button" className="review-shortcut" onClick={downloadPdf} disabled={!review || pending} aria-describedby="review-pdf-hint">
      {pending ? 'Preparando el informe…' : 'Informe de esta zona (PDF)'}
    </button>
    <p className="review-storage-note" id="review-pdf-hint">
      {review ? 'Incluye las dos imágenes y la última revisión de esta zona.' : candidate
        ? 'Guardá la revisión de esta zona para habilitar el PDF.'
        : 'Abrí una zona revisada para descargar su informe.'}
    </p>
    {message && <p className="review-storage-note" role="status">{message}</p>}
    <button type="button" className="review-shortcut" onClick={downloadCsv} aria-describedby="review-csv-hint">
      Revisiones del recorte (CSV)
    </button>
    <p className="review-storage-note" id="review-csv-hint">Incluye todas las zonas revisadas de este recorte. Se abre en Excel.</p>
  </section>;
}
