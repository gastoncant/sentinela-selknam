import { useMemo } from 'react';
import type { Analysis, Candidate } from './crop-types';
import { evidenceCrop } from './evidence-crop';

export function EvidencePair({ analysis, candidate }: { analysis: Analysis; candidate: Candidate }) {
  const crop = useMemo(() => evidenceCrop(analysis, candidate), [analysis, candidate]);
  return <section className="evidence-pair" aria-label="La misma zona ampliada en ambas fechas">
    <h3>Mirar el mismo lugar de cerca</h3>
    <div className="evidence-frames">{[analysis.beforeUrl, analysis.afterUrl].map((url, index) => <figure key={index}>
      <figcaption><strong>{index === 0 ? 'Antes · 2020' : 'Después · 2026'}</strong><span>{new Date(analysis.manifest.dates[index]).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</span></figcaption>
      <svg viewBox={[crop.left, crop.top, crop.side, crop.side].join(' ')} role="img" aria-label={`Zona seleccionada en ${index === 0 ? 2020 : 2026}, ampliada con su contorno`}>
        <image href={url} width={crop.size} height={crop.size} style={{ imageRendering: 'pixelated' }} />
        <path d={crop.path} fill="none" stroke={crop.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </figure>)}</div>
    <p>El contorno marca la misma superficie en las dos imágenes. El encuadre ampliado abarca unos {crop.width.toLocaleString('es-AR')} metros de lado; cada píxel representa 10 metros.</p>
  </section>;
}
