import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import L from 'leaflet';
import proj4 from 'proj4';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import type {Feature, Polygon, MultiPolygon} from 'geojson';
import 'leaflet/dist/leaflet.css';
import './style.css';

type Props = {id:string;signal:'agua'|'vegetacion';area_m2:number;delta_ndwi:number;delta_ndvi:number};
type Candidate = Feature<Polygon|MultiPolygon,Props>;
type Review = {candidate_id:string;state:string;reason:string;version:number;at:string};
type Pilot = {features:Candidate[];manifest:{scenes:string[];common_pixels:number;pixels:number;method_sha256:string;bounds_m:number[]}};
const endpoint=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const cloud:SupabaseClient|null=endpoint&&key?createClient(endpoint,key):null;
const states=['Compatible con impacto de castor','Otra causa','Información insuficiente'];
const org='00000000-0000-4000-8000-000000000001';
const projection='+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs';
const savedKey='sentinela-costero-68eaf776-revisiones-v1';

function readLocal():Review[] {
  try {
    const data=JSON.parse(localStorage.getItem(savedKey)||'[]');
    return Array.isArray(data)?data.filter(r=>typeof r.candidate_id==='string'&&states.includes(r.state)&&Number.isInteger(r.version)&&typeof r.reason==='string'&&typeof r.at==='string'):[];
  } catch(e) {
    console.warn('No se pudieron recuperar las revisiones locales.',e);
    return [];
  }
}
function SpectralMap({features,selected,onSelect,signal,swipe,show,extent}:{features:Candidate[];selected:string;onSelect:(id:string)=>void;signal:string;swipe:number;show:boolean;extent:number[]}) {
  const element=useRef<HTMLDivElement>(null);
  const map=useRef<L.Map|null>(null);
  const polygons=useRef<L.GeoJSON|null>(null);
  const after=useRef<L.ImageOverlay|null>(null);
  useEffect(()=>{
    const m=L.map(element.current!,{crs:L.CRS.Simple,minZoom:-6,maxZoom:1,zoomSnap:0.25,attributionControl:false});
    map.current=m;
    const bounds=L.latLngBounds([extent[1],extent[0]],[extent[3],extent[2]]);
    L.imageOverlay('./pilot/before.png',bounds).addTo(m);
    after.current=L.imageOverlay('./pilot/after.png',bounds).addTo(m);
    m.fitBounds(bounds.pad(0.1));
    const resize=new ResizeObserver(()=>m.invalidateSize());
    resize.observe(element.current!);
    return ()=>{resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(polygons.current)polygons.current.remove();
    polygons.current=L.geoJSON(features.filter(f=>signal==='todas'||f.properties.signal===signal),{
      coordsToLatLng:(coords)=>{const [x,y]=proj4('EPSG:4326',projection,[coords[0],coords[1]]);return L.latLng(y,x);},
      style:(f)=>({color:f?.properties.id===selected?'#fff':f?.properties.signal==='agua'?'#40d8ff':'#ffd078',weight:f?.properties.id===selected?3:1,fillOpacity:0.25}),
      onEachFeature:(f,layer)=>layer.on('click',()=>onSelect(f.properties.id))
    });
    if(show)polygons.current.addTo(map.current!);
    return ()=>{polygons.current?.remove();};
  },[features,signal,show,selected,onSelect]);
  useEffect(()=>{
    const img=after.current?.getElement();
    if(img)img.style.clipPath='inset(0 0 0 '+swipe+'%)';
  },[swipe]);
  return <div ref={element} className="leaflet-map" aria-label="Mapa del área piloto. La lista de candidatos ofrece una alternativa textual."/>;
}

function App() {
  const [pilot,setPilot]=useState<Pilot|null>(null);
  const [error,setError]=useState('');
  const [signal,setSignal]=useState('todas');
  const [selected,setSelected]=useState('agua-1');
  const [page,setPage]=useState(1);
  const [swipe,setSwipe]=useState(50);
  const [show,setShow]=useState(true);
  const [reviews,setReviews]=useState<Review[]>(cloud?[]:readLocal);
  const [state,setState]=useState(states[2]);
  const [reason,setReason]=useState('');
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [login,setLogin]=useState(false);
  const [user,setUser]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const select=React.useCallback((id:string)=>{setSelected(id);setStatus('');setReason('');},[]);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(['manifest.json','candidates.geojson'].map(async name=>{
      const r=await fetch('./pilot/'+name,{signal:controller.signal});
      if(!r.ok)throw Error('No se pudo abrir el producto '+name);
      return r.json();
    })).then(([manifest,data])=>setPilot({manifest,features:data.features})).catch(e=>{if(e.name!=='AbortError')setError('No se pudieron cargar los productos. Recargá la página o verificá la conexión.');});
    return ()=>controller.abort();
  },[]);
  async function loadReviews() {
    if(!cloud)return;
    const {data,error}=await cloud.from('review_heads').select('candidate_id,state,reason,version,at').eq('org_id',org);
    if(error){setStatus('No se pudieron cargar las revisiones de tu organización.');return;}
    setReviews(data||[]);
  }
  useEffect(()=>{
    if(!cloud)return;
    let active=true;
    cloud.auth.getUser().then(({data})=>{if(active)setUser(data.user?.email||'');});
    const {data}=cloud.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user.email||'');setReviews([]);}});
    return ()=>{active=false;data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(user)void loadReviews();},[user]);
  const features=pilot?.features||[];
  const filtered=features.filter(f=>signal==='todas'||f.properties.signal===signal);
  const countPages=Math.max(1,Math.ceil(filtered.length/12));
  const shown=filtered.slice((page-1)*12,page*12);
  const chosen=features.find(f=>f.properties.id===selected);
  const current=reviews.find(r=>r.candidate_id===selected);
  async function save(e:React.FormEvent) {
    e.preventDefault();
    if(!reason.trim()||busy)return;
    setBusy(true);setStatus('');
    const revision={candidate_id:selected,state,reason:reason.trim(),version:(current?.version||0)+1,at:new Date().toISOString()};
    try {
      if(cloud) {
        if(!user){setLogin(true);return;}
        const {error}=await cloud.rpc('record_review',{p_candidate:selected,p_state:state,p_reason:reason.trim(),p_expected:current?.version||0});
        if(error){
          setStatus(error.code==='40001'?'Otra persona actualizó la ficha. Revisá la versión nueva antes de guardar.':'No se pudo guardar. Verificá la sesión y tu pertenencia al equipo.');
          await loadReviews();return;
        }
        await loadReviews();
      } else {
        const latest=readLocal();
        if((latest.find(r=>r.candidate_id===selected)?.version||0)!==(current?.version||0)){
          setReviews(latest);setStatus('La ficha cambió en otra pestaña. Revisá la versión nueva.');return;
        }
        const next=[...latest.filter(r=>r.candidate_id!==selected),revision];
        localStorage.setItem(savedKey,JSON.stringify(next));setReviews(next);
      }
      setReason('');setStatus(cloud?'Revisión guardada en Supabase.':'Ensayo guardado en este navegador.');
    } catch(e) {console.error('Falló el guardado',e);setStatus('No se pudo guardar. Verificá el almacenamiento y reintentá.');}
    finally {setBusy(false);}
  }
  async function signIn(e:React.FormEvent) {
    e.preventDefault();if(!cloud)return;
    setBusy(true);
    try {
      const {error}=await cloud.auth.signInWithPassword({email,password});
      setPassword('');
      if(error){setStatus('No se pudo ingresar. Revisá las credenciales o la conexión.');return;}
      setLogin(false);setStatus('Sesión iniciada.');
    } catch(e) {console.error('Falló el ingreso',e);setStatus('No se pudo contactar al servicio de ingreso.');}
    finally {setBusy(false);}
  }
  return <>
    <header><a className="brand" href="./"><span className="mark">S</span><span>Sentinela <strong>Selknam</strong><small>OBSERVACIÓN AMBIENTAL · TIERRA DEL FUEGO</small></span></a><div className="header-actions"><span>Primer avance</span>{cloud?<button onClick={()=>setLogin(true)}>{user?'Sesión de operador':'Ingresar'}</button>:<span className="mode">Ensayo local de revisión</span>}</div></header>
    <main><div className="heading"><div><p className="eyebrow">ÁREA DE ANÁLISIS · 19FFV</p><h1>Observar el cambio.<br/>Orientar la revisión.</h1><p>Comparación histórica de agua y vegetación para apoyar el trabajo de operadores ambientales.</p></div><div className="area"><strong>3,69 <small>km²</small></strong><span>Recorte rectangular piloto</span><span>Centro −54,5262° · −67,3003°</span></div></div>
    <section className="workspace" aria-label="Explorador temporal"><div className="map-column"><div className="map-header"><h2>Comparación temporal</h2><span>Sentinel-2 L2A · 10 m</span></div><div className="map-wrap">{pilot?<SpectralMap features={features} selected={selected} onSelect={select} signal={signal} swipe={swipe} show={show} extent={pilot.manifest.bounds_m}/>:<p role="status">{error||'Cargando observaciones…'}</p>}<div className="date before">08 FEB 2020</div><div className="date after">13 MAR 2026</div><span className="north">N ↑</span><div className="map-note">Falso color NIR · rojo · verde</div></div><div className="map-controls"><label htmlFor="swipe">Cortina temporal</label><input id="swipe" type="range" min="0" max="100" value={swipe} onChange={e=>setSwipe(+e.target.value)} aria-valuetext={swipe+' por ciento de la primera fecha'}/><label className="toggle"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> Mostrar candidatos</label></div><div className="legend"><span><i className="water"/> Aumento de NDWI</span><span><i className="veg"/> Descenso de NDVI</span><span>Gris · píxel excluido</span></div><div className="coverage"><span className="dot"/><div><strong>{pilot?((pilot.manifest.common_pixels/pilot.manifest.pixels)*100).toFixed(2).replace('.',','):'—'} % de cobertura común válida</strong><p>Dos observaciones. La diferencia estacional puede influir en las señales.</p></div></div></div>
    <aside><div className="aside-head"><p className="eyebrow">REVISIÓN DE CANDIDATOS</p><h2>{selected}</h2><span className="state">{current?.state||'Pendiente de revisión'}</span></div>{chosen&&<><div className="metrics"><div><span>Superficie del polígono</span><strong>{chosen.properties.area_m2.toLocaleString('es-AR')} <small>m²</small></strong></div><div><span>Δ NDWI</span><strong>{chosen.properties.delta_ndwi.toFixed(3)}</strong></div><div><span>Δ NDVI</span><strong>{chosen.properties.delta_ndvi.toFixed(3)}</strong></div></div><p className="caution">La causa del cambio requiere evidencia independiente. Este polígono representa una señal espectral.</p><form onSubmit={save}><label>Resultado de revisión<select value={state} onChange={e=>setState(e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label><label>Motivo<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} required placeholder="Describí qué observás y qué falta verificar." rows={3}/></label><button className="primary" disabled={busy}>{busy?'Guardando…':cloud&&!user?'Ingresar para revisar':cloud?'Guardar revisión':'Guardar ensayo local'}</button></form>{current&&<p className="last-review"><strong>Última revisión · versión {current.version}</strong><br/>{current.reason}</p>}<p role="status" className="status">{status}</p></>}</aside></section>
    <section className="catalog"><div className="catalog-top"><div><p className="eyebrow">CAMBIOS OBSERVADOS</p><h2>Explorar los polígonos</h2></div><label>Filtrar por señal<select value={signal} onChange={e=>{setSignal(e.target.value);setPage(1);}}><option value="todas">Todas las señales</option><option value="agua">Agua</option><option value="vegetacion">Vegetación</option></select></label><a className="download" href="./pilot/candidates.geojson" download>Descargar GeoJSON ↗</a></div><p className="catalog-note">{features.filter(f=>f.properties.signal==='agua').length} componentes de agua y {features.filter(f=>f.properties.signal==='vegetacion').length} de vegetación. Las capas pueden solaparse.</p><div className="candidate-grid">{shown.map(f=><button className={'candidate '+(f.properties.id===selected?'selected':'')} key={f.properties.id} onClick={()=>select(f.properties.id)}><span><i className={f.properties.signal==='agua'?'water':'veg'}/>{f.properties.id}</span><strong>{f.properties.area_m2.toLocaleString('es-AR')} m²</strong><small>{reviews.find(r=>r.candidate_id===f.properties.id)?.state||'Pendiente de revisión'}</small></button>)}</div><nav><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{filtered.length} resultados · Página {page} de {countPages}</span><button disabled={page===countPages} onClick={()=>setPage(page+1)}>Siguiente</button></nav></section>
    <section className="method"><div><p className="eyebrow">TRAZABILIDAD</p><h2>De la imagen<br/>a la ficha.</h2></div><div><p>Datos abiertos Copernicus Sentinel modificados (2020 y 2026), distribuidos por Earth Search. Índices NDWI y NDVI, máscara SCL 4–6, cambio mínimo de 0,25 y componentes de cuatro píxeles o más.</p><details><summary>Ver escenas y versión del método</summary>{pilot?.manifest.scenes.map(s=><p key={s}><code>{s}</code></p>)}<p>SHA-256 del método</p><code>{pilot?.manifest.method_sha256}</code></details><p>La revisión técnica y la validación de campo permitirán evaluar errores y utilidad. El recorte cuenta con observaciones satelitales reales y carece de delimitación oficial de cuenca.</p></div></section></main><footer><strong>Sentinela Selknam</strong><span>Ambiente y Recursos Estratégicos · Primer avance</span><span>{cloud?'Revisión con Supabase':'Revisiones de ensayo guardadas en este navegador'}</span></footer>
    {login&&<div className="modal" role="dialog" aria-modal="true" aria-label="Acceso de operadores"><form onSubmit={signIn}><h2>Ingreso de operadores</h2>{user?<><p>{user}</p><button type="button" onClick={async()=>{const {error}=await cloud!.auth.signOut();setStatus(error?'No se pudo cerrar la sesión.':'Sesión cerrada.');if(!error)setLogin(false);}}>Cerrar sesión</button></>:<><label>Correo<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button disabled={busy} className="primary">Ingresar</button></>}<button type="button" onClick={()=>{setLogin(false);setPassword('');}}>Volver al mapa</button><p role="status">{status}</p></form></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);

