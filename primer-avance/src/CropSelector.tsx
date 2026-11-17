import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import proj4 from 'proj4';
import type { FeatureCollection, MultiPolygon } from 'geojson';
import { assetUrl } from './assets';
import { cropGrid, UTM } from './crop-analysis';

export const shortcuts = [
  { label: 'Zona norte', center: [-68.05, -53.55] as [number, number] },
  { label: 'Zona central', center: [-67.65, -54.48] as [number, number] },
  { label: 'Zona sur', center: [-67.8, -54.78] as [number, number] },
];
function insideRing(point: number[], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function CropSelector({ center, onChange, disabled }: {
  center: [number, number]; onChange: (center: [number, number]) => void; disabled: boolean;
}) {
  const element = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null);
  const selection = useRef<L.FeatureGroup | null>(null);
  const callback = useRef(onChange), locked = useRef(disabled);
  const [message, setMessage] = useState('');
  const [base, setBase] = useState<'terrain' | 'streets'>('terrain');
  const [backgroundError, setBackgroundError] = useState(false);
  callback.current = onChange; locked.current = disabled;
  useEffect(() => {
    const current = L.map(element.current!, { zoomControl: false, scrollWheelZoom: false, minZoom: 6, maxZoom: 14,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
    map.current = current;
    current.attributionControl.setPrefix(false);
    current.fitBounds([[-55.15, -68.75], [-52.55, -65.05]], { padding: [20, 20] });
    const controller = new AbortController();
    let geometry: MultiPolygon | undefined;
    fetch(assetUrl('./province/boundary.geojson'), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Contorno no disponible');
      const data = await response.json() as FeatureCollection<MultiPolygon>;
      geometry = data.features[0].geometry;
      L.geoJSON(data, { style: { color: '#173e60', weight: 4, fill: false, opacity: 0.55 }, interactive: false }).addTo(current);
      L.geoJSON(data, { style: { color: '#ffffff', weight: 1.7, fill: false }, interactive: false,
        attribution: 'Contorno argentino de Isla Grande: IGN, generalizado' }).addTo(current);
      selection.current?.bringToFront();
    }).catch(error => { if (error.name !== 'AbortError') setMessage('No pudimos cargar el selector. Podés usar los botones de zona o el piloto.'); });
    fetch(assetUrl('./province/places.json'), { signal: controller.signal }).then(response => response.json()).then(places => {
      places.forEach((place: { lat: number; lon: number; name: string }) => {
        L.circleMarker([place.lat, place.lon], { radius: 3, color: '#173e60', fillOpacity: 1, interactive: false }).addTo(current);
        const label = document.createElement('span'); label.textContent = place.name;
        L.marker([place.lat, place.lon], { icon: L.divIcon({ className: 'selector-place', html: label, iconAnchor: [-6, 10], iconSize: [125, 26] }), interactive: false, keyboard: false }).addTo(current);
      });
    }).catch(error => { if (error.name !== 'AbortError') console.warn('Rótulos no disponibles', error); });
    current.on('click', event => {
      if (locked.current) return;
      const point: [number, number] = [event.latlng.lng, event.latlng.lat];
      if (!geometry || !geometry.coordinates.some(polygon => insideRing(point, polygon[0]) && !polygon.slice(1).some(hole => insideRing(point, hole)))) {
        setMessage('Elegí un punto dentro del contorno de la Isla Grande.'); return;
      }
      setMessage('Recorte seleccionado. Presioná «Comparar este recorte».');
      callback.current(point);
    });
    const observer = new ResizeObserver(() => current.invalidateSize()); observer.observe(element.current!);
    return () => { controller.abort(); observer.disconnect(); current.stop(); current.remove(); map.current = null; selection.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    setBackgroundError(false);
    const layer = base === 'terrain'
      ? L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 15, maxZoom: 14, keepBuffer: 1,
        attribution: 'Datos © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · Mapa © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      })
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 14, keepBuffer: 1,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
    const onTileError = () => setBackgroundError(true);
    layer.on('tileerror', onTileError);
    layer.addTo(map.current);
    return () => { layer.off('tileerror', onTileError); layer.remove(); };
  }, [base]);
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    selection.current?.remove();
    const bounds = cropGrid(center);
    const points = [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]].map(p => {
      const [lon, lat] = proj4(UTM, 'EPSG:4326', p); return L.latLng(lat, lon);
    });
    selection.current = L.featureGroup([
      L.polygon(points, { color: '#fff', weight: 6, fill: false, interactive: false }),
      L.polygon(points, { color: '#b65200', fillColor: '#f49a38', fillOpacity: 0.18, weight: 2.5, interactive: false }),
      L.circleMarker([center[1], center[0]], { radius: 4, color: '#a84400', fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }),
    ]).addTo(current);
  }, [center]);
  return <>
    <div className="map-tools" aria-label="Controles del selector">
      <button onClick={() => map.current?.zoomIn()} type="button">Acercar +</button>
      <button onClick={() => map.current?.zoomOut()} type="button">Alejar −</button>
      <button onClick={() => map.current?.fitBounds([[-55.15, -68.75], [-52.55, -65.05]], { padding: [20, 20] })} type="button">Ver isla</button>
    </div>
    <div className="basemap-options" aria-label="Capas del terreno">
      <button type="button" aria-pressed={base === 'terrain'} onClick={() => setBase('terrain')}>Relieve y ríos</button>
      <button type="button" aria-pressed={base === 'streets'} onClick={() => setBase('streets')}>Caminos y lugares</button>
    </div>
    <div ref={element} className="leaflet-map crop-selector" role="region" aria-label="Selector de recortes de la Isla Grande. Tocá un lugar dentro del contorno o usá los botones de zona." />
    {(message || backgroundError) && <p className="selector-message" role="status">{backgroundError ? 'Algunas teselas no cargaron. Probá la otra capa o elegí una zona con los botones.' : message}</p>}
  </>;
}
