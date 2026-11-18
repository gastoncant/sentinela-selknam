import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import proj4 from 'proj4';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import 'leaflet/dist/leaflet.css';
import './style.css';
import './design.css';
import { CropSelector, shortcuts } from './CropSelector';
import CropWorker from './crop.worker?worker&inline';
import type { Analysis } from './crop-types';
import { loadCrops, storeCrop } from './crop-cache';
import { LoadingProgress, progressStage } from './LoadingProgress';
import { EvidencePair } from './EvidencePair';
import { ReadingGuide } from './ReadingGuide';
import { assetUrl } from './assets';

type Properties = {
  id: string;
  signal: 'agua' | 'vegetacion';
  area_m2: number;
  delta_ndwi: number;
  delta_ndvi: number;
};
type Candidate = Feature<Polygon | MultiPolygon, Properties>;
type Review = {
  candidate_id: string;
  state: string;
  reason: string;
  version: number;
  at: string;
};
type View = 'before' | 'compare' | 'after';

const endpoint = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const cloud: SupabaseClient | null = endpoint && key ? createClient(endpoint, key) : null;
const states = ['Compatible con impacto de castor', 'Otra causa', 'Información insuficiente'];
const reviewOptions = [
  { label: 'Puede ser compatible con castores', explanation: 'La imagen sugiere un posible impacto. Requiere comprobarlo.' },
  { label: 'Parece otra causa', explanation: 'Observás un cambio que podría tener otra explicación.' },
  { label: 'Falta información', explanation: 'Con estas imágenes todavía no podés decidir.' },
];
const organization = '00000000-0000-4000-8000-000000000001';
const projection = '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs';
const savedKey = 'sentinela-costero-68eaf776-revisiones-v1';
const pageSize = 6;

function zoneName(candidate: Candidate) {
  const number = candidate.properties.id.split('-').pop();
  return `Zona de ${candidate.properties.signal === 'agua' ? 'agua' : 'vegetación'} ${number}`;
}

function readLocal(): Review[] {
  try {
    const data = JSON.parse(localStorage.getItem(savedKey) || '[]');
    return Array.isArray(data) ? data.filter(review =>
      typeof review.candidate_id === 'string' &&
      states.includes(review.state) &&
      Number.isInteger(review.version) &&
      typeof review.reason === 'string' &&
      typeof review.at === 'string'
    ) : [];
  } catch (error) {
    console.warn('No se pudieron recuperar las revisiones locales.', error);
    return [];
  }
}

function SpectralMap({ features, selected, onSelect, signal, swipe, show, extent, view, reset, beforeUrl, afterUrl, onImageProgress, onImageError }: {
  features: Candidate[];
  selected: string;
  onSelect: (id: string) => void;
  signal: string;
  swipe: number;
  show: boolean;
  extent: number[];
  beforeUrl: string; afterUrl: string;
  onImageProgress: (percent: number) => void;
  onImageError: () => void;
  view: View;
  reset: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const polygons = useRef<L.GeoJSON | null>(null);
  const after = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    const currentMap = L.map(element.current!, {
      crs: L.CRS.Simple,
      minZoom: -6,
      maxZoom: 1,
      zoomSnap: 0.25,
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: false,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
      maxBounds: L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]]).pad(0.02),
      maxBoundsViscosity: 1,
    });
    map.current = currentMap;
    currentMap.getPane('overlayPane')?.setAttribute('aria-hidden', 'true');
    const bounds = L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]]);
    let loaded = 0, failed = false;
    onImageProgress(0);
    const before = L.imageOverlay(beforeUrl, bounds);
    const afterLayer = L.imageOverlay(afterUrl, bounds);
    after.current = afterLayer;
    const imageLoaded = () => { if (!failed) onImageProgress(++loaded * 50); };
    const imageFailed = () => { failed = true; onImageError(); };
    [before, afterLayer].forEach(layer => {
      layer.on('load', imageLoaded); layer.on('error', imageFailed); layer.addTo(currentMap);
    });
    currentMap.fitBounds(bounds.pad(0.04));
    const resize = new ResizeObserver(() => currentMap.invalidateSize());
    resize.observe(element.current!);
    return () => {
      resize.disconnect();
      [before, afterLayer].forEach(layer => { layer.off('load', imageLoaded); layer.off('error', imageFailed); });
      currentMap.stop();
      currentMap.remove();
      map.current = null;
    };
  }, [extent, beforeUrl, afterUrl, onImageProgress, onImageError]);

  useEffect(() => {
    const currentMap = map.current!;
    const overlay = after.current!;
    function updateCurtain() {
      const image = overlay.getElement();
      if (!image) return;
      const imageBox = image.getBoundingClientRect();
      const mapBox = currentMap.getContainer().getBoundingClientRect();
      const split = mapBox.left + mapBox.width * swipe / 100;
      const left = Math.max(0, Math.min(imageBox.width, split - imageBox.left));
      image.style.clipPath = view === 'compare' ? `inset(0 0 0 ${left}px)` : '';
      image.style.opacity = view === 'before' ? '0' : '1';
    }
    updateCurtain();
    overlay.on('load', updateCurtain);
    currentMap.on('move zoom resize', updateCurtain);
    return () => {
      overlay.off('load', updateCurtain);
      currentMap.off('move zoom resize', updateCurtain);
    };
  }, [view, swipe]);

  useEffect(() => {
    polygons.current?.remove();
    const visible = features.filter(feature => signal === 'todas' || feature.properties.signal === signal);
    const layer = L.geoJSON(visible, {
      coordsToLatLng: coordinates => {
        const [x, y] = proj4('EPSG:4326', projection, [coordinates[0], coordinates[1]]);
        return L.latLng(y, x);
      },
      style: feature => ({
        color: feature?.properties.id === selected ? '#ffffff' : feature?.properties.signal === 'agua' ? '#5de2ff' : '#ffd17e',
        weight: feature?.properties.id === selected ? 4 : 1.5,
        fillOpacity: feature?.properties.id === selected ? 0.32 : 0.12,
        dashArray: feature?.properties.signal === 'vegetacion' && feature.properties.id !== selected ? '4 3' : undefined,
      }),
      onEachFeature: (feature, polygon) => {
        polygon.on('click', () => onSelect(feature.properties.id));
        polygon.bindTooltip(zoneName(feature as Candidate), { sticky: true });
      },
    });
    polygons.current = layer;
    if (show) layer.addTo(map.current!);
    return () => { layer.remove(); };
  }, [features, signal, show, selected, onSelect]);

  useEffect(() => {
    if (!selected) return;
    polygons.current?.eachLayer(layer => {
      const polygon = layer as L.Polygon & { feature?: Candidate };
      if (polygon.feature?.properties.id === selected)
        map.current?.fitBounds(polygon.getBounds().pad(0.7), { maxZoom: 0.5, animate: false });
    });
  }, [selected]);

  useEffect(() => {
    if (reset) {
      map.current?.fitBounds(L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]]).pad(0.04));
    }
  }, [reset, extent]);

  return <>
    <div className="map-tools" aria-label="Controles del mapa">
      <button type="button" onClick={() => map.current?.zoomIn()}>Acercar +</button>
      <button type="button" onClick={() => map.current?.zoomOut()}>Alejar −</button>
    </div>
    <div ref={element} className="leaflet-map" role="region" aria-label="Imagen satelital del recorte seleccionado. También podés elegir una zona en la lista." />
  </>;
}

function App() {
  const [scope, setScope] = useState<'province' | 'pilot'>('province');
  const [pilot, setPilot] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [signal, setSignal] = useState('todas');
  const [order, setOrder] = useState('area');
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('compare');
  const [swipe, setSwipe] = useState(50);
  const [show, setShow] = useState(true);
  const [reset, setReset] = useState(0);
  const [reviews, setReviews] = useState<Review[]>(cloud ? [] : readLocal);
  const [state, setState] = useState(states[2]);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const loginDialog = useRef<HTMLDialogElement>(null);
  const discardDialog = useRef<HTMLDialogElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);
  const originalPilot = useRef<Analysis | null>(null);
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeRun = useRef('pilot');
  const createdUrls = useRef<string[]>([]);
  const [center, setCenter] = useState<[number, number]>(shortcuts[1].center);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const progressCeiling = useRef(0);
  const imageProgressBase = useRef(0);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [pilotLoadPercent, setPilotLoadPercent] = useState(0);
  const [pilotLoading, setPilotLoading] = useState(true);
  const [cropError, setCropError] = useState('');
  const [recent, setRecent] = useState<Analysis[]>([]);
  const [cacheNotice, setCacheNotice] = useState('');
  const cloudForRun = pilot?.id === 'pilot' ? cloud : null;

  function showAnalysis(analysis: Analysis, fromProcessing = false) {
    setError('');
    imageProgressBase.current = fromProcessing ? 96 : 0;
    setProgressPercent(imageProgressBase.current); setImagesLoading(true);
    setProgress('Preparando las imágenes para comparar…');
    activeRun.current = analysis.id;
    setPilot(analysis); setScope('pilot'); setSelected(''); setReason('');
    setStatus(''); setSaved(false); setPage(1); setSignal('todas'); setView('compare');
    if (!cloud || analysis.id !== 'pilot') setReviews(readLocal());
    else void loadReviews();
    requestAnimationFrame(() => document.getElementById('compare-title')?.focus());
  }
  function openPilot() { if (originalPilot.current) showAnalysis(originalPilot.current); }
  function requestCatalog() {
    if (saving.current || processing) return;
    if (reason.trim()) { setPendingSelection('@catalog'); return; }
    setImagesLoading(false); setProgressPercent(0);
    setScope('province');
  }
  function stopWorker() {
    if (worker.current) { worker.current.onmessage = null; worker.current.onerror = null; worker.current.terminate(); }
    worker.current = null;
    clearTimeout(timeout.current); setProcessing(false);
  }
  function cancelProcessing() {
    stopWorker(); setProgressPercent(0); setProgress('');
  }
  const onImageProgress = useCallback((percent: number) => {
    setImagesLoading(percent < 100);
    setProgressPercent(imageProgressBase.current + (100 - imageProgressBase.current) * percent / 100);
    setProgress(percent === 100 ? 'Listo. Ya podés comparar las imágenes.' : 'Preparando las imágenes para comparar…');
  }, []);
  const onImageError = useCallback(() => {
    setImagesLoading(false); setProgressPercent(0);
    setError('No pudimos cargar una de las imágenes. Revisá la conexión y volvé a abrir este recorte.');
  }, []);
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => setProgressPercent(previous => {
      const ceiling = progressCeiling.current;
      return previous < ceiling ? Math.max(previous, Math.min(ceiling - 0.1, previous + (ceiling - previous) * 0.06)) : previous;
    }), 400);
    return () => clearInterval(timer);
  }, [processing]);
  function startCrop() {
    if (processing) return;
    setCropError(''); setProcessing(true); setImagesLoading(false); setProgressPercent(0);
    progressCeiling.current = 3; setProgress('Preparando la consulta del recorte…');
    const current = new CropWorker(); worker.current = current;
    timeout.current = setTimeout(() => {
      cancelProcessing(); setCropError('La descarga está tardando demasiado. Podés volver a intentar o abrir el piloto ya preparado.');
    }, 240000);
    current.onerror = () => { cancelProcessing(); setCropError('No pudimos ejecutar la comparación en este navegador. Volvé a intentar o abrí el piloto preparado.'); };
    current.onmessage = event => {
      const data = event.data;
      if (data.type === 'progress') {
        const [floor, ceiling] = progressStage(data.message);
        progressCeiling.current = Math.max(progressCeiling.current, ceiling);
        setProgressPercent(previous => Math.max(previous, floor)); setProgress(data.message); return;
      }
      stopWorker();
      if (data.type === 'error') { setProgressPercent(0); setCropError(data.message + ' El piloto preparado sigue disponible.'); return; }
      if (data.type !== 'result') return;
      const beforeUrl = URL.createObjectURL(data.before), afterUrl = URL.createObjectURL(data.after);
      createdUrls.current.push(beforeUrl, afterUrl);
      const analysis: Analysis = { id: data.id, label: 'Recorte de 5,12 × 5,12 km', beforeUrl, afterUrl,
        manifest: data.manifest, features: data.features };
      setRecent(previous => [analysis, ...previous.filter(item => item.id !== analysis.id)].slice(0, 6));
      const { beforeUrl: _before, afterUrl: _after, ...metadata } = analysis;
      void storeCrop({ ...metadata, before: data.before, after: data.after, opened: Date.now() })
        .catch(() => setCacheNotice('No se pudo conservar este recorte en el dispositivo. Podés descargar sus imágenes y datos antes de cerrar.'));
      showAnalysis(analysis, true);
    };
    current.postMessage({ center });
  }
  useEffect(() => () => {
    worker.current?.terminate(); clearTimeout(timeout.current);
    createdUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    let active = true;
    loadCrops().then(crops => {
      if (!active) return;
      setRecent(previous => {
        const loaded = crops.map(({ before, after, opened: _opened, ...metadata }) => {
          const beforeUrl = URL.createObjectURL(before), afterUrl = URL.createObjectURL(after);
          createdUrls.current.push(beforeUrl, afterUrl);
          return { ...metadata, beforeUrl, afterUrl };
        });
        return [...previous, ...loaded.filter(item => !previous.some(existing => existing.id === item.id))].slice(0, 6);
      });
    }).catch(() => { if (active) setCacheNotice('Este navegador no permite conservar los recortes descargados. Las revisiones y descargas tienen controles separados.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const retained = new Set([...recent, ...(pilot ? [pilot] : [])].flatMap(item => [item.beforeUrl, item.afterUrl]));
    createdUrls.current = createdUrls.current.filter(url => {
      if (retained.has(url)) return true;
      URL.revokeObjectURL(url); return false;
    });
  }, [recent, pilot]);

  const select = useCallback((id: string) => {
    if (saving.current) return;
    setSelected(id);
    setStatus('');
    setReason('');
    setState(states[2]);
    setSaved(false);
    if (!id) requestAnimationFrame(() => listHeading.current?.focus());
  }, []);

  const requestSelection = useCallback((id: string) => {
    if (saving.current) return;
    if (reasonField.current?.value.trim()) {
      setPendingSelection(id);
      return;
    }
    select(id);
  }, [select]);

  useEffect(() => {
    const controller = new AbortController();
    let loaded = 0;
    Promise.all(['manifest.json', 'candidates.geojson'].map(async name => {
      const response = await fetch(assetUrl('./pilot/' + name), { signal: controller.signal });
      if (!response.ok) throw Error('No se pudo abrir el producto ' + name);
      const result = await response.json();
      if (!controller.signal.aborted) setPilotLoadPercent(++loaded * 50);
      return result;
    })).then(([manifest, data]) => {
      const original: Analysis = { id: 'pilot', label: 'Piloto costero · 1,92 × 1,92 km',
        beforeUrl: assetUrl('./pilot/before.png'), afterUrl: assetUrl('./pilot/after.png'), manifest, features: data.features };
      originalPilot.current = original;
      setPilot(previous => previous || original);
    })
      .catch(failure => {
        if (failure.name !== 'AbortError') setError('No pudimos cargar las imágenes. Revisá la conexión y volvé a intentar.');
      }).finally(() => { if (!controller.signal.aborted) setPilotLoading(false); });
    return () => controller.abort();
  }, []);

  async function loadReviews() {
    if (!cloud || activeRun.current !== 'pilot') return;
    const requestedRun = activeRun.current;
    const { data, error: failure } = await cloud.from('review_heads')
      .select('candidate_id,state,reason,version,at').eq('org_id', organization);
    if (failure) {
      setStatus('No pudimos cargar las revisiones del equipo. Volvé a intentar.');
      return;
    }
    if (activeRun.current === requestedRun) setReviews(data || []);
  }

  useEffect(() => {
    if (!cloud) return;
    let active = true;
    cloud.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user?.email || '');
    });
    const { data } = cloud.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user.email || '');
        if (activeRun.current === 'pilot') setReviews([]);
      }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (user && pilot?.id === 'pilot') void loadReviews(); }, [user, pilot?.id]);
  useEffect(() => {
    if (selected) reviewHeading.current?.focus();
  }, [selected]);
  useEffect(() => {
    if (login) loginDialog.current?.showModal();
    else loginDialog.current?.close();
  }, [login]);
  useEffect(() => {
    if (pendingSelection !== null) discardDialog.current?.showModal();
    else discardDialog.current?.close();
  }, [pendingSelection]);

  const features = pilot?.features || [];
  const filtered = features.filter(feature => signal === 'todas' || feature.properties.signal === signal)
    .sort((a, b) => order === 'area' ? b.properties.area_m2 - a.properties.area_m2
      : Number(a.properties.id.split('-').pop()) - Number(b.properties.id.split('-').pop()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const chosen = features.find(feature => feature.properties.id === selected);
  const current = reviews.find(review => review.candidate_id === selected);
  const position = filtered.findIndex(feature => feature.properties.id === selected);
  const next = filtered[position + 1];
  const coverage = pilot ? (pilot.manifest.common_pixels / pilot.manifest.pixels * 100).toFixed(1).replace('.', ',') : '';

  const downloads = useMemo(() => {
    if (!pilot) return null;
    return {
      manifest: URL.createObjectURL(new Blob([JSON.stringify(pilot.manifest, null, 2)], { type: 'application/json' })),
      features: URL.createObjectURL(new Blob([JSON.stringify({ type: 'FeatureCollection', features: pilot.features })], { type: 'application/geo+json' })),
    };
  }, [pilot]);
  useEffect(() => () => { if (downloads) Object.values(downloads).forEach(url => URL.revokeObjectURL(url)); }, [downloads]);
  const dateLabel = (index: number) => pilot?.manifest.dates[index]
    ? new Date(pilot.manifest.dates[index]).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '…';

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!reason.trim()) {
      setStatus('Escribí un motivo antes de guardar. Por ejemplo, qué observás o qué falta comprobar.');
      reasonField.current?.focus();
      return;
    }
    setBusy(true);
    saving.current = true;
    setStatus('');
    setSaved(false);
    const revision = {
      candidate_id: selected, state, reason: reason.trim(),
      version: (current?.version || 0) + 1, at: new Date().toISOString(),
    };
    try {
      if (cloudForRun) {
        if (!user) { setLogin(true); return; }
        const { error: failure } = await cloudForRun.rpc('record_review', {
          p_candidate: selected, p_state: state, p_reason: reason.trim(), p_expected: current?.version || 0,
        });
        if (failure) {
          setStatus(failure.code === '40001'
            ? 'Otra persona cambió esta revisión. Leé la última revisión que aparece abajo y volvé a guardar si corresponde.'
            : 'No pudimos guardar. Revisá tu sesión y el acceso al equipo. Tu comentario sigue en la pantalla.');
          await loadReviews();
          return;
        }
        await loadReviews();
      } else {
        const latest = readLocal();
        if ((latest.find(review => review.candidate_id === selected)?.version || 0) !== (current?.version || 0)) {
          setReviews(latest);
          setStatus('Esta zona cambió en otra pestaña. Leé la última revisión y volvé a guardar si corresponde.');
          return;
        }
        const updated = [...latest.filter(review => review.candidate_id !== selected), revision];
        localStorage.setItem(savedKey, JSON.stringify(updated));
        setReviews(updated);
      }
      setReason('');
      setSaved(true);
      setStatus(cloudForRun ? 'Revisión guardada para tu equipo.' : 'Revisión de prueba guardada en este navegador.');
    } catch (failure) {
      console.error('Falló el guardado', failure);
      setStatus('No pudimos guardar. Tu comentario sigue en la pantalla. Revisá la conexión o el almacenamiento y volvé a intentar.');
    } finally { setBusy(false); saving.current = false; }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!cloud) return;
    setBusy(true);
    try {
      const { error: failure } = await cloud.auth.signInWithPassword({ email, password });
      setPassword('');
      if (failure) { setStatus('No pudimos ingresar. Revisá el correo y la contraseña, o la conexión.'); return; }
      setLogin(false);
      setStatus('Sesión iniciada. Ya podés guardar tu revisión.');
    } catch (failure) {
      console.error('Falló el ingreso', failure);
      setStatus('No pudimos contactar al servicio. Revisá la conexión y volvé a intentar.');
    } finally { setBusy(false); }
  }

  return <>
    <a className="skip-link" href="#principal">Ir al contenido</a>
    <header className="site-header">
      <a className="brand" href="./"><img className="brand-logo" src={assetUrl('./brand/ko-taix-sentinela-v2.png')} width="76" height="76" alt="" />
        <span><strong>Sentinela <span className="brand-selknam">Selknam</span></strong><span>Monitoreo de agua y vegetación</span></span>
      </a>
      {cloud && <button className="header-button" onClick={() => setLogin(true)}>
        {user ? 'Mi sesión' : 'Ingresar al equipo'}
      </button>}
    </header>

    <main id="principal">
      <div className={"page-heading " + (scope === 'pilot' ? 'is-analysis' : '')}>
        <div><p className="location">Isla Grande de Tierra del Fuego</p>
          <h1>Comparar cambios en la Isla Grande</h1>
          <p>Elegí un área, contrastá dos fechas y registrá lo que observás.</p>
        </div>
        <details className="quick-help">
          <summary>¿Cómo uso esta página?</summary>
          <ol>
            <li>Elegí una zona con los botones o tocá un lugar dentro del contorno de la isla.</li>
            <li>Presioná <strong>Comparar este recorte</strong>. La aplicación busca y procesa imágenes de 2020 y 2026.</li>
            <li>Deslizá el comparador. Tocá <strong>Elegir una zona para revisar</strong> y después <strong>Revisar</strong> en una zona de la lista.</li>
            <li>En la ficha, tocá <strong>Ir al formulario de revisión</strong>. Escribí lo que observás y presioná <strong>Guardar revisión</strong>.</li>
          </ol>
          <p>Si el recorte no tiene zonas detectadas, podés elegir otro lugar o probar con el piloto preparado.</p>
        </details>
      </div>

      {!cloudForRun && <p className="demo-notice"><strong>Entorno de demostración</strong><span>Imágenes satelitales reales · Revisiones guardadas en este dispositivo</span></p>}

      <div className="scope-options" aria-label="Vista de trabajo">
        <button aria-pressed={scope === 'province'} onClick={requestCatalog} disabled={processing || busy}>Elegir un recorte</button>
        <button aria-pressed={scope === 'pilot'} onClick={() => setScope('pilot')} disabled={!pilot || processing}>Volver al análisis abierto</button>
      </div>

      <LoadingProgress active={imagesLoading} percent={processing ? 0 : progressPercent} label={progress} />

      {scope === 'province' ? <div className="workbench crop-workbench">
        <section className="comparison" aria-labelledby="selector-title">
          <div className="section-heading"><span className="step" aria-hidden="true">1</span><div>
            <h2 id="selector-title">Elegir dónde comparar</h2><p>El cuadro naranja es el recorte que se va a analizar.</p>
          </div></div>
          <div className="crop-shortcuts" aria-label="Elegir una zona de la isla">
            {shortcuts.map(item => <button key={item.label} onClick={() => setCenter(item.center)} disabled={processing}>{item.label}</button>)}
          </div>
          <div className="map-wrap"><CropSelector center={center} onChange={setCenter} disabled={processing} /></div>
          <p className="selector-hint"><strong>Mapa de referencia.</strong> El relieve, los ríos y los caminos ayudan a ubicar el recorte. Esta cartografía no representa las fechas del análisis. Tocá un punto dentro del contorno o usá los botones de zona.</p>
        </section>
        <aside className="review-panel crop-request" aria-label="Preparar comparación del recorte">
          <div className="section-heading"><span className="step" aria-hidden="true">2</span><div><h2>Comparar este lugar</h2><p>Dos temporadas, sobre la misma superficie.</p></div></div>
          <dl className="crop-spec"><dt>Área del recorte</dt><dd>5,12 × 5,12 km</dd><dt>Detalle del análisis</dt><dd>10 metros · Sentinel-2</dd><dt>Períodos</dt><dd>Enero–marzo de 2020 y de 2026</dd></dl>
          <p className="crop-coordinate">Centro: {center[1].toFixed(4)}°, {center[0].toFixed(4)}°</p>
          <button className="save-button" onClick={startCrop} disabled={processing}>{processing ? 'Preparando la comparación…' : 'Comparar este recorte →'}</button>
          {processing && <div className="processing-state">
            <LoadingProgress active percent={progressPercent} label={progress} estimated />
            <p>La primera descarga puede tardar varios minutos. Podés cancelarla.</p><button onClick={cancelProcessing}>Cancelar descarga</button></div>}
          {cropError && <p className="error-message" role="alert">{cropError}</p>}
          <p className="scientific-note">Se comparan únicamente los píxeles válidos en ambas fechas. Las nubes y la falta de observaciones pueden impedir el análisis. Un cambio necesita revisión para atribuirlo a castores.</p>
          <div className="prepared-pilot"><h3>Probar un recorte ya preparado</h3><p>Piloto costero · 3,69 km² · 200 zonas de cambio</p>
            <LoadingProgress active={pilotLoading} percent={pilotLoadPercent} label={pilotLoadPercent === 100 ? 'Piloto preparado.' : 'Cargando los datos del piloto…'} />
            <button onClick={openPilot} disabled={!originalPilot.current || processing}>Abrir piloto preparado →</button></div>
          {recent.length > 0 && <div className="recent-crops"><h3>Recortes de este dispositivo</h3><p>Se conservan hasta seis comparaciones para volver a abrirlas.</p>{recent.map(item => <button key={item.id} onClick={() => showAnalysis(item)} disabled={processing}>{item.manifest.center[1].toFixed(3)}°, {item.manifest.center[0].toFixed(3)}° · {item.features.length} zonas →</button>)}</div>}
          {cacheNotice && <p role="status">{cacheNotice}</p>}
        </aside>
      </div> : error && !pilot ? <div className="error-message" role="alert"><h2>No se pudieron abrir las imágenes</h2><p>{error}</p><button onClick={() => window.location.reload()}>Volver a intentar</button></div> :
        <div className="workbench" aria-busy={!pilot}>
          <section className="comparison" aria-labelledby="compare-title">
            <div className="section-heading"><span className="step" aria-hidden="true">1</span><div>
              <h2 id="compare-title" tabIndex={-1}>{pilot?.label || 'Abrir comparación'}</h2><p>El mismo lugar en dos fechas · imagen infrarroja</p>
            </div></div>
            {pilot && <div className="review-entry">
              {features.length > 0 ? <>
                <button type="button" className="review-shortcut" onClick={() => (chosen ? formHeading : listHeading).current?.focus()}>
                  {chosen ? 'Ir al formulario de revisión' : 'Elegir una zona para revisar'} ↓
                </button>
                {!chosen && <p>La revisión se guarda en la ficha de una zona.</p>}
              </> : <p>Este recorte no tiene zonas para revisar. Podés elegir otro recorte para buscar cambios.</p>}
            </div>}
            <div className="view-options" aria-label="Fecha de la imagen">
              <button aria-pressed={view === 'before'} onClick={() => setView('before')}><strong>Ver 2020</strong><span>{dateLabel(0)}</span></button>
              <button aria-pressed={view === 'compare'} onClick={() => setView('compare')}><strong>Comparar</strong><span>Las dos fechas</span></button>
              <button aria-pressed={view === 'after'} onClick={() => setView('after')}><strong>Ver 2026</strong><span>{dateLabel(1)}</span></button>
            </div>
            <div className="image-caption" aria-live="polite">
              {view === 'before' ? `Estás viendo el ${dateLabel(0)} de 2020` : view === 'after' ? `Estás viendo el ${dateLabel(1)} de 2026` : '2020 a la izquierda · 2026 a la derecha'}
            </div>
            <div className="map-wrap">
              {pilot ? <SpectralMap key={pilot.id} features={features} selected={selected} onSelect={requestSelection} signal={signal}
                swipe={swipe} show={show} extent={pilot.manifest.bounds_m} view={view} reset={reset}
                beforeUrl={pilot.beforeUrl} afterUrl={pilot.afterUrl} onImageProgress={onImageProgress} onImageError={onImageError} />
                : <p className="loading" role="status">Cargando imágenes y zonas…</p>}
              {view === 'compare' && <div className="curtain-line" style={{ left: swipe + '%' }} aria-hidden="true"><span>↔</span></div>}
              <span className="north" aria-hidden="true">N ↑</span>
              <div className="image-date-tags" aria-hidden="true">
                {view !== 'after' && <span className="before-date">2020 · antes</span>}
                {view !== 'before' && <span className="after-date">2026 · después</span>}
              </div>
              {chosen && <p className="map-selection">{zoneName(chosen)} · contorno blanco</p>}
            </div>
            {error && pilot && <p className="error-message" role="alert">{error}</p>}
            {view === 'compare' && <div className="slider-control">
              <label htmlFor="swipe">Deslizá para ver el mismo lugar en cada fecha</label>
              <div><span>2020</span><input id="swipe" type="range" min="0" max="100" value={swipe}
                onChange={event => setSwipe(+event.target.value)} aria-valuetext={swipe + ' por ciento de la imagen de 2020'} /><span>2026</span></div>
            </div>}
            <div className="map-actions">
              <button type="button" onClick={() => setReset(value => value + 1)}>Ver recorte completo</button>
              {<label className="check-control"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} /> Mostrar zonas para revisar</label>}
            </div>
            <div className="analysis-summary" aria-label="Resumen de cambios del recorte">
              <div><strong>{features.filter(feature => feature.properties.signal === 'agua').length}</strong><span>zonas con más señal de agua</span></div>
              <div><strong>{features.filter(feature => feature.properties.signal === 'vegetacion').length}</strong><span>zonas con menos señal de vegetación</span></div>
              <div><strong>{coverage || '…'} %</strong><span>del recorte se pudo comparar</span></div>
            </div>
            <div className="map-legend" aria-label="Colores de las zonas">
              <span><i className="water-key" aria-hidden="true" /> Aumento de señal de agua</span><span><i className="vegetation-key" aria-hidden="true" /> Disminución de señal de vegetación</span>
            </div>
            <p className="coverage-notice"><strong>Superficie comparable: {coverage || '…'} %.</strong> {Number(coverage.replace(',', '.')) < 70 ? 'Cobertura limitada: interpretá los resultados con especial cuidado.' : 'El gris marca los píxeles excluidos por falta de observación válida.'}</p>
            {pilot && !features.length && <p className="coverage-notice">No se encontraron componentes que superen los criterios en la superficie observable. Esto no demuestra ausencia de castores.</p>}
            <ReadingGuide />
          </section>

          <aside className="review-panel" aria-label="Elegir y revisar una zona">
            {!chosen ? <>
              <div className="section-heading"><span className="step" aria-hidden="true">2</span><div>
                <h2 ref={listHeading} tabIndex={-1}>Cambios para revisar</h2><p>{features.length ? 'Tocá Revisar para abrir la ficha de una zona.' : pilot ? 'Elegí otro recorte para buscar cambios.' : 'Esperando el análisis.'}</p>
              </div></div>
              {features.length > 0 && <>
              <label className="filter-label" htmlFor="signal">¿Qué cambios querés revisar?</label>
              <select id="signal" value={signal} onChange={event => { setSignal(event.target.value); setPage(1); }}>
                <option value="todas">Agua y vegetación</option><option value="agua">Solo agua</option><option value="vegetacion">Solo vegetación</option>
              </select>
              <label className="filter-label order-label" htmlFor="order">Orden de la lista</label>
              <select id="order" value={order} onChange={event => { setOrder(event.target.value); setPage(1); }}>
                <option value="area">Mayor superficie primero</option><option value="number">Número de zona</option>
              </select>
              <p className="sort-hint">La superficie no indica gravedad ni prioridad de intervención.</p>
              <p className="result-count" aria-live="polite">{pilot ? filtered.length + ' zonas disponibles' : 'Cargando zonas…'}</p>
              <ul className="zone-list">
                {shown.map(feature => {
                  const reviewed = reviews.some(review => review.candidate_id === feature.properties.id);
                  return <li key={feature.properties.id}><button onClick={() => requestSelection(feature.properties.id)}>
                    <span className={'zone-description signal-' + feature.properties.signal}><strong>{zoneName(feature)}</strong>
                      <span>{feature.properties.area_m2.toLocaleString('es-AR')} m² · {reviewed ? 'Ya revisada' : 'Sin revisar'}</span>
                    </span><span className="open-zone">Revisar →</span>
                  </button></li>;
                })}
              </ul>
              <nav className="pagination" aria-label="Páginas de zonas">
                <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>← Anterior</button>
                <span>{page} de {pageCount}</span>
                <button disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Siguiente →</button>
              </nav>
              <p className="scientific-note">Estas zonas muestran cambios en las imágenes. Para conocer su causa hace falta revisarlas.</p>
              </>}
            </> : <>
              <button className="back-button" onClick={() => requestSelection('')} disabled={busy}>← Volver a la lista de zonas</button>
              <h2 className="zone-title" ref={reviewHeading} tabIndex={-1}>{zoneName(chosen)}</h2>
              <button type="button" className="review-shortcut zone-review-shortcut" onClick={() => formHeading.current?.focus()}>
                Ir al formulario de revisión ↓
              </button>
              <p className="zone-area">Superficie del cambio <strong>{chosen.properties.area_m2.toLocaleString('es-AR')} m²</strong></p>
              <p className="signal-explanation">{chosen.properties.signal === 'agua'
                ? 'En esta superficie aumentó la señal espectral asociada al agua. Puede haber habido agua en ambas fechas: el cambio de índice no demuestra una inundación nueva. Compará las dos ampliaciones.'
                : 'En esta superficie disminuyó el índice de vegetación. Compará el aspecto del área roja y su entorno entre las dos fechas.'}</p>
              {pilot && <EvidencePair analysis={pilot} candidate={chosen} />}
              <p className="evidence-caution">El cambio puede ser sutil en la imagen. La estación, las sombras y el nivel de agua también influyen. Para atribuirlo a castores hace falta evidencia adicional.</p>
              <div className="section-heading review-step"><span className="step" aria-hidden="true">3</span><h3 id="review-form-title" ref={formHeading} tabIndex={-1}>Registrar lo observado</h3></div>
              <form onSubmit={save} aria-labelledby="review-form-title">
                <fieldset disabled={busy}>
                  <legend>¿Qué podés decir de esta zona?</legend>
                  {reviewOptions.map((option, index) => <label className={'review-option ' + (state === states[index] ? 'checked' : '')} key={option.label}>
                    <input type="radio" name="review-state" value={states[index]} checked={state === states[index]}
                      onChange={() => { setState(states[index]); setSaved(false); }} />
                    <span><strong>{option.label}</strong><span>{option.explanation}</span></span>
                  </label>)}
                </fieldset>
                <label className="reason-label" htmlFor="reason">Motivo de la revisión</label>
                <p className="field-hint" id="reason-hint">Escribí qué observás o qué falta comprobar.</p>
                <textarea id="reason" ref={reasonField} value={reason} maxLength={1000} rows={3}
                  aria-describedby="reason-hint" disabled={busy}
                  onChange={event => { setReason(event.target.value); setSaved(false); }}
                  placeholder="Por ejemplo, necesito otra imagen para decidir." />
                <button type="submit" className="save-button" disabled={busy}>{busy ? 'Guardando revisión…' : 'Guardar revisión'}</button>
                <p className="review-storage-note">{cloudForRun ? user ? 'Se guarda para tu equipo.' : 'Te vamos a pedir que ingreses al equipo para guardar.' : 'Se guarda solo en este navegador.'}</p>
              </form>
              {status && <p className={'save-message ' + (saved ? 'success' : '')} role="status">{saved && <strong>Listo. </strong>}{status}</p>}
              {saved && next && <button className="next-zone" onClick={() => requestSelection(next.properties.id)}>Revisar la siguiente zona →</button>}
              {current && <details className="previous-review" open={saved}><summary>Ver la última revisión guardada</summary>
                <p><strong>{current.state}</strong></p><p>{current.reason}</p>
                <p>{new Date(current.at).toLocaleString('es-AR')}</p>
              </details>}
              <details className="technical-details"><summary>Ver datos técnicos de esta zona</summary>
                <dl><dt>Identificador</dt><dd>{chosen.properties.id}</dd>
                  <dt>Cambio en índice de agua (NDWI)</dt><dd>{chosen.properties.delta_ndwi.toLocaleString('es-AR', { maximumFractionDigits: 3 })}</dd>
                  <dt>Cambio en índice de vegetación (NDVI)</dt><dd>{chosen.properties.delta_ndvi.toLocaleString('es-AR', { maximumFractionDigits: 3 })}</dd></dl>
              </details>
            </>}
          </aside>
        </div>}

      <section className="analysis-information" aria-label="Información del análisis">
        <details><summary>Datos del análisis y descarga para especialistas</summary>
          <h3>Recorte abierto</h3>
          <p>{pilot?.label || 'Sin análisis abierto'}. Grilla de 10 metros en UTM 19 Sur. Fechas efectivas: {pilot?.manifest.dates.map(value => new Date(value).toLocaleDateString('es-AR', { timeZone: 'UTC' })).join(' y ')}.</p>
          <p>Se compararon {pilot?.manifest.common_pixels.toLocaleString('es-AR') || '…'} de {pilot?.manifest.pixels.toLocaleString('es-AR') || '…'} píxeles. Hay {features.filter(feature => feature.properties.signal === 'agua').length} componentes de agua y {features.filter(feature => feature.properties.signal === 'vegetacion').length} de vegetación. Las capas pueden solaparse.</p>
          <p>Se usaron índices NDWI y NDVI, máscara SCL 4–6, un cambio mínimo de 0,25 y componentes de al menos cuatro píxeles. Los umbrales requieren validación. Un cambio espectral necesita evidencia adicional para atribuir su causa a castores.</p>
          {downloads && <><a className="download-link" href={downloads.features} download={`${pilot!.id}-candidatos.geojson`}>Descargar las zonas de este recorte en GeoJSON</a>
            <a className="download-link" href={downloads.manifest} download={`${pilot!.id}-manifest.json`}>Descargar fuentes, fechas y parámetros de este recorte</a></>}
          {pilot && <><a className="download-link" href={pilot.beforeUrl} download={`${pilot.id}-2020.png`}>Descargar imagen de 2020</a>
            <a className="download-link" href={pilot.afterUrl} download={`${pilot.id}-2026.png`}>Descargar imagen de 2026</a></>}
          {cacheNotice && <p role="status">{cacheNotice}</p>}
          <h3>Escenas utilizadas</h3>{pilot?.manifest.scenes.map(scene => <p key={scene}><code>{scene}</code></p>)}
          <h3>Método</h3><code>{pilot?.manifest.method_sha256}</code>
          <p>Contiene datos Copernicus Sentinel modificados (2020 y 2026), distribuidos por Earth Search.</p>
        </details>
      </section>
    </main>
    <footer className="government-footer">
      <div className="footer-identity">
        <img src={assetUrl('./brand/ko-taix-sentinela-v2.png')} width="84" height="84" alt="Logo de Sentinela Selknam: Ko’taix con cuernos laterales y colores fueguinos" />
        <div><strong>Sentinela Selknam</strong><span>Gobierno de TDF</span></div>
      </div>
      <p className="footer-event">Hackathon Soberanía Tech 2026</p>
      <div className="footer-notices">
        <p>© 2026 Sentinela Selknam. Todos los derechos reservados sobre los contenidos originales del proyecto.</p>
        <p>Datos, cartografía y dependencias de terceros bajo sus respectivas licencias.</p>
        <p>Prototipo demostrativo. Resultados orientativos que requieren revisión y validación en campo.</p>
      </div>
    </footer>

    <dialog ref={discardDialog} onClose={() => setPendingSelection(null)} aria-labelledby="discard-title">
      <h2 id="discard-title">Tu comentario todavía no está guardado</h2>
      <p>Podés volver a la ficha para guardarlo, o salir y descartar lo que escribiste.</p>
      <button className="save-button" onClick={() => setPendingSelection(null)} autoFocus>Seguir escribiendo</button>
      <button className="dialog-close" onClick={() => {
        if (pendingSelection === '@catalog') { setReason(''); setImagesLoading(false); setProgressPercent(0); setScope('province'); }
        else if (pendingSelection !== null) select(pendingSelection);
        setPendingSelection(null);
      }}>Descartar comentario y salir</button>
    </dialog>

    <dialog ref={loginDialog} onClose={() => { setLogin(false); setPassword(''); }} aria-labelledby="login-title">
      <h2 id="login-title">Ingreso del equipo</h2>
      <p>Usá la cuenta que te habilitó la persona administradora.</p>
      {user ? <><p>Sesión de {user}</p><button onClick={async () => {
        const { error: failure } = await cloud!.auth.signOut();
        setStatus(failure ? 'No pudimos cerrar la sesión. Volvé a intentar.' : 'Sesión cerrada.');
        if (!failure) setLogin(false);
      }}>Cerrar sesión</button></> : <form onSubmit={signIn}>
        <label htmlFor="email">Correo electrónico</label><input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" />
        <label htmlFor="password">Contraseña</label><input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" />
        <button className="save-button" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>}
      <button className="dialog-close" onClick={() => setLogin(false)}>Volver al mapa</button>
      <p role="status">{status}</p>
    </dialog>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
