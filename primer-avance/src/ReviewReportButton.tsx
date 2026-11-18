import { useState } from 'react';
import type { Analysis, Candidate, Review } from './crop-types';
import { captureEvidence, evidenceCrop } from './evidence-crop';
import { downloadExport, reviewPdf } from './review-export';

export function ReviewReportButton({ analysis, candidate, review }: { analysis: Analysis; candidate: Candidate; review: Review }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function download() {
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

  return <div className="pdf-download">
    <button type="button" className="review-shortcut" onClick={download} disabled={pending}>
      {pending ? 'Preparando el informe…' : 'Descargar informe (PDF) ↓'}
    </button>
    <p className="review-storage-note">Incluye las dos imágenes y la última revisión guardada.</p>
    {message && <p className="review-storage-note" role="status">{message}</p>}
  </div>;
}
