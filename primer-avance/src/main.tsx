import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import proj4 from 'proj4';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { ProvincialMap } from './ProvincialMap';
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
type Pilot = {
  features: Candidate[];
  manifest: {
    scenes: string[];
    common_pixels: number;
    pixels: number;
    method_sha256: string;
    bounds_m: number[];
  };
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

function SpectralMap({ features, selected, onSelect, signal, swipe, show, extent, view, reset }: {
  features: Candidate[];
  selected: string;
  onSelect: (id: string) => void;
  signal: string;
  swipe: number;
  show: boolean;
  extent: number[];
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
    });
    map.current = currentMap;
    currentMap.getPane('overlayPane')?.setAttribute('aria-hidden', 'true');
    const bounds = L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]]);
    L.imageOverlay(assetUrl('./pilot/before.png'), bounds).addTo(currentMap);
    after.current = L.imageOverlay(assetUrl('./pilot/after.png'), bounds).addTo(currentMap);
    currentMap.fitBounds(bounds.pad(0.04));
    const resize = new ResizeObserver(() => currentMap.invalidateSize());
    resize.observe(element.current!);
    return () => {
      resize.disconnect();
      currentMap.remove();
      map.current = null;
    };
  }, [extent]);

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
    if (reset) {
      map.current?.fitBounds(L.latLngBounds([extent[1], extent[0]], [extent[3], extent[2]]).pad(0.04));
    }
  }, [reset, extent]);

  return <>
    <div className="map-tools" aria-label="Controles del mapa">
      <button type="button" onClick={() => map.current?.zoomIn()}>Acercar +</button>
      <button type="button" onClick={() => map.current?.zoomOut()}>Alejar −</button>
    </div>
    <div ref={element} className="leaflet-map" role="region" aria-label="Imagen satelital del área piloto. También podés elegir una zona en la lista." />
  </>;
}

function App() {
  const [scope, setScope] = useState<'province' | 'pilot'>('province');
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [error, setError] = useState('');
  const [signal, setSignal] = useState('todas');
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('after');
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
  const loginDialog = useRef<HTMLDialogElement>(null);
  const discardDialog = useRef<HTMLDialogElement>(null);
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);
  const openPilot = useCallback(() => {
    setScope('pilot');
    requestAnimationFrame(() => document.getElementById('compare-title')?.focus());
  }, []);

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
    Promise.all(['manifest.json', 'candidates.geojson'].map(async name => {
      const response = await fetch(assetUrl('./pilot/' + name), { signal: controller.signal });
      if (!response.ok) throw Error('No se pudo abrir el producto ' + name);
      return response.json();
    })).then(([manifest, data]) => setPilot({ manifest, features: data.features }))
      .catch(failure => {
        if (failure.name !== 'AbortError') setError('No pudimos cargar las imágenes. Revisá la conexión y volvé a intentar.');
      });
    return () => controller.abort();
  }, []);

  async function loadReviews() {
    if (!cloud) return;
    const { data, error: failure } = await cloud.from('review_heads')
      .select('candidate_id,state,reason,version,at').eq('org_id', organization);
    if (failure) {
      setStatus('No pudimos cargar las revisiones del equipo. Volvé a intentar.');
      return;
    }
    setReviews(data || []);
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
        setReviews([]);
      }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (user) void loadReviews(); }, [user]);
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
  const filtered = features.filter(feature => signal === 'todas' || feature.properties.signal === signal);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const chosen = features.find(feature => feature.properties.id === selected);
  const current = reviews.find(review => review.candidate_id === selected);
  const position = filtered.findIndex(feature => feature.properties.id === selected);
  const next = filtered[position + 1];
  const coverage = pilot ? (pilot.manifest.common_pixels / pilot.manifest.pixels * 100).toFixed(1).replace('.', ',') : '';

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
      if (cloud) {
        if (!user) { setLogin(true); return; }
        const { error: failure } = await cloud.rpc('record_review', {
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
      setStatus(cloud ? 'Revisión guardada para tu equipo.' : 'Revisión de prueba guardada en este navegador.');
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
      <a className="brand" href="./"><span className="province-mark" aria-hidden="true" />
        <span><strong>Sentinela Selknam</strong><span>Tierra del Fuego · Observación ambiental</span></span>
      </a>
      {cloud && <button className="header-button" onClick={() => setLogin(true)}>
        {user ? 'Mi sesión' : 'Ingresar al equipo'}
      </button>}
    </header>

    <main id="principal">
      <div className="page-heading">
        <div><p className="location">Isla Grande de Tierra del Fuego</p>
          <h1>Revisar cambios en el territorio</h1>
          <p>Recorré la Isla Grande y abrí los análisis disponibles.</p>
        </div>
        <details className="quick-help">
          <summary>¿Cómo uso esta página?</summary>
          <ol>
            <li>Elegí <strong>Ver 2020</strong> o <strong>Ver 2026</strong> para mirar cada imagen. Con <strong>Comparar</strong> podés deslizar entre las dos.</li>
            <li>En el mapa de la isla, acercá la zona que querés recorrer. El punto azul abre el piloto de 10 metros.</li>
            <li>Dentro del piloto, elegí una zona de la lista o tocá un contorno en el mapa.</li>
            <li>Marcá una opción, escribí un motivo y presioná <strong>Guardar revisión</strong>.</li>
          </ol>
          <p>Para volver al encuadre inicial, usá <strong>Ver toda la isla</strong> o, dentro del piloto, <strong>Ver área completa</strong>.</p>
        </details>
      </div>

      {!cloud && <p className="demo-notice"><strong>Estás en una demostración.</strong> Las imágenes son reales. Las revisiones de prueba quedan guardadas en este navegador.</p>}

      <div className="scope-options" aria-label="Vista del territorio">
        <button aria-pressed={scope === 'province'} onClick={() => setScope('province')}>Mapa de la isla</button>
        <button aria-pressed={scope === 'pilot'} onClick={openPilot}>Piloto de 10 metros</button>
      </div>

      {error && scope === 'pilot' ? <div className="error-message" role="alert"><h2>No se pudieron abrir las imágenes</h2><p>{error}</p><button onClick={() => window.location.reload()}>Volver a intentar</button></div> :
        <div className="workbench" aria-busy={scope === 'pilot' && !pilot}>
          <section className="comparison" aria-labelledby="compare-title">
            <div className="section-heading"><span className="step" aria-hidden="true">1</span><div>
              <h2 id="compare-title" tabIndex={-1}>{scope === 'province' ? 'Recorrer el mapa de la isla' : 'Mirar el piloto de 10 metros'}</h2><p>Elegí qué fecha querés ver.</p>
            </div></div>
            <div className="view-options" aria-label="Fecha de la imagen">
              <button aria-pressed={view === 'before'} onClick={() => setView('before')}><strong>Ver 2020</strong><span>8 de febrero</span></button>
              <button aria-pressed={view === 'compare'} onClick={() => setView('compare')}><strong>Comparar</strong><span>Las dos fechas</span></button>
              <button aria-pressed={view === 'after'} onClick={() => setView('after')}><strong>Ver 2026</strong><span>13 de marzo</span></button>
            </div>
            <div className="image-caption" aria-live="polite">
              {view === 'before' ? 'Estás viendo el 8 de febrero de 2020' : view === 'after' ? 'Estás viendo el 13 de marzo de 2026' : '2020 a la izquierda · 2026 a la derecha'}
            </div>
            <div className="map-wrap">
              {scope === 'province' ? <ProvincialMap view={view} swipe={swipe} reset={reset} onOpenPilot={openPilot} /> :
                pilot ? <SpectralMap features={features} selected={selected} onSelect={requestSelection} signal={signal}
                swipe={swipe} show={show} extent={pilot.manifest.bounds_m} view={view} reset={reset} />
                : <p className="loading" role="status">Cargando imágenes y zonas…</p>}
              {view === 'compare' && <div className="curtain-line" style={{ left: swipe + '%' }} aria-hidden="true"><span>↔</span></div>}
              <span className="north" aria-hidden="true">N ↑</span>
              {scope === 'pilot' && chosen && <p className="map-selection">{zoneName(chosen)} · contorno blanco</p>}
            </div>
            {view === 'compare' && <div className="slider-control">
              <label htmlFor="swipe">Mové el control para comparar las imágenes</label>
              <div><span>2020</span><input id="swipe" type="range" min="0" max="100" value={swipe}
                onChange={event => setSwipe(+event.target.value)} aria-valuetext={swipe + ' por ciento de la imagen de 2020'} /><span>2026</span></div>
            </div>}
            <div className="map-actions">
              <button type="button" onClick={() => setReset(value => value + 1)}>{scope === 'province' ? 'Ver toda la isla' : 'Ver área completa'}</button>
              {scope === 'pilot' && <label className="check-control"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} /> Mostrar zonas para revisar</label>}
            </div>
            <div className="map-legend" aria-label="Colores de las zonas">
              {scope === 'province' ? <><span><i className="boundary-key" aria-hidden="true" /> Sector argentino · contorno IGN</span><span><i className="pilot-key" aria-hidden="true" /> Piloto con análisis de 10 m</span></> :
                <><span><i className="water-key" aria-hidden="true" /> Cambios en agua</span><span><i className="vegetation-key" aria-hidden="true" /> Cambios en vegetación</span></>}
            </div>
            {scope === 'province' ? <details className="image-help"><summary>¿Qué muestra el mapa de la isla?</summary>
              <p>Imágenes diarias NASA GIBS / MODIS de las dos fechas, en color natural. Su resolución nativa es de 250 metros. Las vistas guardadas están reducidas para cargar rápido.</p>
              <p>Esta vista permite reconocer el territorio y comparar su apariencia. Las nubes, sombras y luz solar pueden ocultar sectores. Los cambios calculados a 10 metros están disponibles en el piloto.</p>
              <p>El contorno blanco delimita el sector argentino de la Isla Grande y está simplificado para visualización. La imagen incluye el entorno chileno como referencia geográfica. Las referencias de localidades provienen de Georef.</p>
            </details> : <details className="image-help"><summary>¿Por qué la vegetación se ve roja?</summary>
              <p>La imagen combina bandas satelitales para facilitar la comparación. El rojo ayuda a distinguir la vegetación. El gris marca lugares que quedaron fuera de la comparación por falta de datos válidos.</p>
              <p>Se pudo comparar el {coverage || '…'} % del área. La diferencia de estación y las sombras pueden influir en los cambios.</p>
            </details>}
          </section>

          <aside className="review-panel" aria-label="Elegir y revisar una zona">
            {scope === 'province' ? <>
              <div className="section-heading"><span className="step" aria-hidden="true">2</span><div><h2>Análisis disponibles</h2><p>Elegí un análisis para revisar sus zonas.</p></div></div>
              <div className="available-analysis">
                <h3>Piloto costero Sentinel-2</h3>
                <p>Recorte de 3,69 km² · detalle de 10 metros</p>
                <p>{pilot ? features.length : '…'} zonas calculadas para revisar</p>
                <button className="save-button" onClick={openPilot}>Abrir el análisis detallado →</button>
              </div>
              <p className="scientific-note"><strong>Cobertura de detección actual</strong><br />Los candidatos calculados corresponden al recorte piloto. La cobertura de análisis de la isla se incorporará por sectores y períodos.</p>
              <section className="alert-plan"><h3>Seguimiento y alertas</h3>
                <p>El plan del proyecto incluye una bandeja de novedades y avisos al equipo por correo, Slack o WhatsApp, según la configuración institucional.</p>
                <p>La integración de envíos externos está planificada y requiere configurar los servicios y destinatarios.</p>
                <a href="https://github.com/gastoncant/sentinela-selknam/blob/master/ARQUITECTURA_OBJETIVO.md" target="_blank" rel="noreferrer">Ver la arquitectura y el plan de alertas ↗</a>
              </section>
            </> : !chosen ? <>
              <div className="section-heading"><span className="step" aria-hidden="true">2</span><div>
                <h2 ref={listHeading} tabIndex={-1}>Elegir una zona</h2><p>Tocá una fila para abrir su ficha.</p>
              </div></div>
              <label className="filter-label" htmlFor="signal">¿Qué cambios querés revisar?</label>
              <select id="signal" value={signal} onChange={event => { setSignal(event.target.value); setPage(1); }}>
                <option value="todas">Agua y vegetación</option><option value="agua">Solo agua</option><option value="vegetacion">Solo vegetación</option>
              </select>
              <p className="result-count" aria-live="polite">{pilot ? filtered.length + ' zonas disponibles' : 'Cargando zonas…'}</p>
              <ul className="zone-list">
                {shown.map(feature => {
                  const reviewed = reviews.some(review => review.candidate_id === feature.properties.id);
                  return <li key={feature.properties.id}><button onClick={() => requestSelection(feature.properties.id)}>
                    <span className="zone-description"><strong>{zoneName(feature)}</strong>
                      <span>{feature.properties.area_m2.toLocaleString('es-AR')} m² · {reviewed ? 'Ya revisada' : 'Sin revisar'}</span>
                    </span><span className="open-zone">Abrir →</span>
                  </button></li>;
                })}
              </ul>
              <nav className="pagination" aria-label="Páginas de zonas">
                <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>← Anterior</button>
                <span>{page} de {pageCount}</span>
                <button disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Siguiente →</button>
              </nav>
              <p className="scientific-note">Estas zonas muestran cambios en las imágenes. Para conocer su causa hace falta revisarlas.</p>
            </> : <>
              <button className="back-button" onClick={() => requestSelection('')} disabled={busy}>← Volver a la lista de zonas</button>
              <h2 className="zone-title" ref={reviewHeading} tabIndex={-1}>{zoneName(chosen)}</h2>
              <p className="zone-area">Superficie del cambio <strong>{chosen.properties.area_m2.toLocaleString('es-AR')} m²</strong></p>
              <p className="signal-explanation">{chosen.properties.signal === 'agua'
                ? 'Se marcó un posible aumento de agua. Compará las dos imágenes para interpretarlo.'
                : 'Se marcó un posible cambio relacionado con la vegetación. Compará las dos imágenes para interpretarlo.'}</p>
              <div className="section-heading review-step"><span className="step" aria-hidden="true">3</span><h3>Registrar lo observado</h3></div>
              <form onSubmit={save}>
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
                <button className="save-button" disabled={busy}>{busy ? 'Guardando revisión…' : cloud && !user ? 'Ingresar para guardar la revisión' : cloud ? 'Guardar revisión' : 'Guardar revisión de prueba'}</button>
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
          <h3>Vista de la Isla Grande</h3>
          <p>NASA GIBS, producto MODIS Terra Corrected Reflectance True Color, del 8 de febrero de 2020 y del 13 de marzo de 2026. La resolución nativa es de 250 m y la cobertura depende de las observaciones disponibles. El sector argentino de la Isla Grande se extrajo del contorno IGN y se generalizó con una tolerancia de 0,004 grados para facilitar la visualización. Los nombres y posiciones de localidades provienen de Georef.</p>
          <a className="download-link" href={assetUrl('./province/manifest.json')} download="isla-grande-manifest.json">Descargar fuentes y metadatos del mapa de la isla</a>
          <h3>Análisis del recorte piloto</h3>
          <p>Área rectangular de 1,92 × 1,92 km en Tierra del Fuego. Imágenes Sentinel-2 L2A del 8 de febrero de 2020 y del 13 de marzo de 2026, sobre una grilla de 10 metros en UTM 19 Sur.</p>
          <p>Se compararon {pilot?.manifest.common_pixels.toLocaleString('es-AR') || '…'} de {pilot?.manifest.pixels.toLocaleString('es-AR') || '…'} píxeles. Hay {features.filter(feature => feature.properties.signal === 'agua').length} componentes de agua y {features.filter(feature => feature.properties.signal === 'vegetacion').length} de vegetación. Las capas pueden solaparse.</p>
          <p>Se usaron índices NDWI y NDVI, máscara SCL 4–6, un cambio mínimo de 0,25 y componentes de al menos cuatro píxeles. Los umbrales requieren validación. Un cambio espectral necesita evidencia adicional para atribuir su causa a castores.</p>
          <a className="download-link" href={assetUrl('./pilot/candidates.geojson')} download="candidatos-piloto.geojson">Descargar las zonas en formato GeoJSON</a>
          <h3>Escenas utilizadas</h3>{pilot?.manifest.scenes.map(scene => <p key={scene}><code>{scene}</code></p>)}
          <h3>Versión del método</h3><code>{pilot?.manifest.method_sha256}</code>
          <p>Contiene datos Copernicus Sentinel modificados (2020 y 2026), distribuidos por Earth Search.</p>
        </details>
      </section>
    </main>
    <footer><strong>Sentinela Selknam</strong><span>Apoyo a la revisión ambiental · Tierra del Fuego</span><span>Primer avance</span></footer>

    <dialog ref={discardDialog} onClose={() => setPendingSelection(null)} aria-labelledby="discard-title">
      <h2 id="discard-title">Tu comentario todavía no está guardado</h2>
      <p>Podés volver a la ficha para guardarlo, o salir y descartar lo que escribiste.</p>
      <button className="save-button" onClick={() => setPendingSelection(null)} autoFocus>Seguir escribiendo</button>
      <button className="dialog-close" onClick={() => {
        if (pendingSelection !== null) select(pendingSelection);
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
