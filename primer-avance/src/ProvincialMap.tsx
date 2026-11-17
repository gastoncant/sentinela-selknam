import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { FeatureCollection } from 'geojson';
import { assetUrl, hasEmbeddedAssets } from './assets';

const island = { id: 'fueguino', bbox: [-71.5, -55.25, -65, -52.35] };

const endpoint = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const layerName = 'MODIS_Terra_CorrectedReflectance_TrueColor';
const dates = ['2020-02-08', '2026-03-13'];
const pilotCenter: L.LatLngTuple = [-54.5262142810433, -67.30029166119341];

function boundsFor(bbox: number[]) {
  return L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
}

export function ProvincialMap({ view, swipe, reset, onOpenPilot }: {
  view: 'before' | 'compare' | 'after';
  swipe: number;
  reset: number;
  onOpenPilot: () => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const liveLayers = useRef<L.TileLayer.WMS[]>([]);
  const [tileError, setTileError] = useState(false);
  const [boundaryError, setBoundaryError] = useState(false);

  useEffect(() => {
    const currentMap = L.map(element.current!, {
      crs: L.CRS.EPSG4326,
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 4,
      maxZoom: 10,
      zoomSnap: 0.25,
      maxBounds: [[-56.5, -73], [-51.5, -63.8]],
      maxBoundsViscosity: 0.8,
    });
    map.current = currentMap;
    currentMap.fitBounds(boundsFor(island.bbox), { padding: [8, 8] });
    currentMap.attributionControl.setPrefix(false);
    currentMap.createPane('regional-before').style.zIndex = '200';
    currentMap.createPane('regional-after').style.zIndex = '210';
    currentMap.createPane('province-outline').style.zIndex = '450';
    currentMap.createPane('place-labels').style.zIndex = '600';
    currentMap.getPane('regional-before')!.setAttribute('aria-hidden', 'true');
    currentMap.getPane('regional-after')!.setAttribute('aria-hidden', 'true');
    currentMap.getPane('province-outline')!.setAttribute('aria-hidden', 'true');

    // Cached previews stay visible if live remote tiles are unavailable.
    dates.forEach((date, index) => {
      const pane = index === 0 ? 'regional-before' : 'regional-after';
      [island].forEach(item => {
        L.imageOverlay(assetUrl(`./province/${item.id}-${index === 0 ? 'before' : 'after'}.jpg`), boundsFor(item.bbox), {
          pane, attribution: 'Imágenes NASA GIBS / MODIS',
        }).addTo(currentMap);
      });
      const options: L.WMSOptions & { time: string } = {
        layers: layerName, format: 'image/jpeg', transparent: false,
        version: '1.1.1', crs: L.CRS.EPSG4326, time: date,
        pane, maxNativeZoom: 9, maxZoom: 10, updateWhenIdle: true,
        keepBuffer: 1, noWrap: true, attribution: 'NASA GIBS / MODIS · IGN',
      };
      if (!hasEmbeddedAssets()) {
        const tiles = L.tileLayer.wms(endpoint, options).addTo(currentMap);
        tiles.on('tileerror', () => setTileError(true));
        liveLayers.current.push(tiles);
      }
    });

    const controller = new AbortController();
    const boundary = L.geoJSON(undefined, {
      pane: 'province-outline',
      style: { color: '#ffffff', weight: 2, opacity: 0.95, fill: false },
      interactive: false,
    }).addTo(currentMap);
    fetch(assetUrl('./province/boundary.geojson'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Contorno no disponible');
        return response.json() as Promise<FeatureCollection>;
      })
      .then(data => boundary.addData(data))
      .catch(error => { if (error.name !== 'AbortError') setBoundaryError(true); });

    fetch(assetUrl('./province/places.json'), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Referencias no disponibles');
        return response.json() as Promise<{ name: string; lat: number; lon: number }[]>;
      })
      .then(places => places.forEach(place => {
        const label = document.createElement('span');
        label.textContent = place.name;
        L.marker([place.lat, place.lon], {
          pane: 'place-labels',
          icon: L.divIcon({ className: 'place-label', html: label, iconSize: [130, 25], iconAnchor: [0, 12] }),
          interactive: false, keyboard: false,
        }).addTo(currentMap);
      }))
      .catch(error => { if (error.name !== 'AbortError') console.warn('No se cargaron los rótulos de referencia.', error); });

    const marker = L.circleMarker(pilotCenter, {
      radius: 10, color: '#ffffff', weight: 3, fillColor: '#08649e',
      fillOpacity: 1, pane: 'place-labels',
    }).addTo(currentMap);
    marker.bindTooltip('Abrir piloto Sentinel-2 de 10 metros');
    marker.on('click', onOpenPilot);
    L.control.scale({ imperial: false, metric: true }).addTo(currentMap);
    const resize = new ResizeObserver(() => currentMap.invalidateSize());
    resize.observe(element.current!);
    return () => {
      controller.abort();
      resize.disconnect();
      liveLayers.current.forEach(layer => layer.off());
      currentMap.remove();
      liveLayers.current = [];
      map.current = null;
    };
  }, [onOpenPilot]);

  useEffect(() => {
    const currentMap = map.current!;
    function updateCurtain() {
      const topLeft = currentMap.containerPointToLayerPoint([0, 0]);
      const bottomRight = currentMap.containerPointToLayerPoint(currentMap.getSize());
      const split = topLeft.x + currentMap.getSize().x * swipe / 100;
      const before = currentMap.getPane('regional-before')!;
      const after = currentMap.getPane('regional-after')!;
      before.style.opacity = view === 'after' ? '0' : '1';
      after.style.opacity = view === 'before' ? '0' : '1';
      before.style.clip = view === 'compare'
        ? `rect(${topLeft.y}px,${split}px,${bottomRight.y}px,${topLeft.x}px)` : '';
      after.style.clip = view === 'compare'
        ? `rect(${topLeft.y}px,${bottomRight.x}px,${bottomRight.y}px,${split}px)` : '';
    }
    updateCurtain();
    currentMap.on('move zoom resize', updateCurtain);
    return () => { currentMap.off('move zoom resize', updateCurtain); };
  }, [view, swipe]);

  useEffect(() => {
    map.current?.fitBounds(boundsFor(island.bbox), { padding: [8, 8] });
    if (reset) {
      setTileError(false);
      liveLayers.current.forEach(layer => layer.redraw());
    }
  }, [reset]);

  return <>
    <div className="map-tools" aria-label="Controles del mapa de la Isla Grande">
      <button type="button" onClick={() => map.current?.zoomIn()}>Acercar +</button>
      <button type="button" onClick={() => map.current?.zoomOut()}>Alejar −</button>
    </div>
    <div ref={element} className="leaflet-map" role="region" aria-label="Mapa de la Isla Grande con imágenes de ambas fechas, contorno del sector argentino IGN y referencias geográficas." />
    {(tileError || boundaryError) && <p className="regional-load-message" role="status">
      {tileError ? 'Algunas imágenes remotas no cargaron. Las vistas regionales guardadas siguen disponibles.' : 'No se pudo cargar el contorno argentino de la isla.'}
    </p>}
  </>;
}
