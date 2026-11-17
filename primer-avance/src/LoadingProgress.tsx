import { useEffect, useState } from 'react';

// The worker already emits these milestones. Keep presentation out of its
// scientific source hash so existing result IDs and reviews remain unchanged.
export function progressStage(message: string): [number, number] {
  if (message.startsWith('Buscando escenas')) return [4, 14];
  if (message.startsWith('Buscando una observación')) {
    const attempt = Number(message.match(/\((\d+) de/)?.[1] || 1);
    const start = message.includes('2026') ? 48 : 16;
    return [start + (attempt - 1) * 2, start + 8];
  }
  if (message.startsWith('Leyendo bandas')) return message.includes('2026') ? [60, 79] : [28, 47];
  if (message.startsWith('Comparando agua')) return [82, 95];
  return [0, 3];
}

export function LoadingProgress({ active, percent, label, estimated = false }: {
  active: boolean; percent: number; label: string; estimated?: boolean;
}) {
  const [completed, setCompleted] = useState(false);
  const value = Math.max(0, Math.min(100, Math.floor(percent)));
  useEffect(() => {
    if (active || percent < 100) { setCompleted(false); return; }
    setCompleted(true);
    const timer = setTimeout(() => setCompleted(false), 1800);
    return () => clearTimeout(timer);
  }, [active, percent === 100]);
  if (!active && (!completed || percent < 100)) return null;
  return <section className={'loading-progress ' + (active ? 'is-loading' : 'is-complete')} aria-label="Progreso de la tarea">
    <div className="loading-progress-heading"><p aria-live="polite">{label}</p><strong aria-hidden="true">{value} %</strong></div>
    <div className="loading-progress-track" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
      aria-valuetext={`${value} por ciento${estimated && active ? ', estimado' : ''}`}>
      <span style={{ width: `${value}%` }} />
    </div>
    {estimated && active && <p className="loading-progress-note">Progreso estimado por etapas.</p>}
  </section>;
}
