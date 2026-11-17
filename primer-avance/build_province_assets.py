"""Freeze NASA regional previews and a generalized IGN provincial outline."""
import argparse
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
from shapely.geometry import shape, mapping, box, MultiPolygon

ROOT = Path(__file__).resolve().parent
BOUNDARY_URL = (
    "https://wms.ign.gob.ar/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature"
    "&typeNames=ign:provincia&outputFormat=application/json&srsName=EPSG:4326"
    "&CQL_FILTER=in1%3D%2794%27"
)
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor"
REGIONS = [("fueguino", "Isla Grande de Tierra del Fuego", [-71.5, -55.25, -65, -52.35])]
DATES = ["2020-02-08", "2026-03-13"]

def normalize_coordinates(coordinates):
    if isinstance(coordinates[0], (int, float)):
        longitude, latitude = coordinates[:2]
        if abs(latitude) > 90.000001:
            raise ValueError("Latitud fuera de rango.")
        return [longitude, max(-90, min(90, latitude))]
    return [normalize_coordinates(part) for part in coordinates]

def fetch(url, max_bytes):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                content = response.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise ValueError("La respuesta supera el límite de descarga.")
            return content
        except (OSError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2)

def main(boundary_file):
    out = ROOT / "public/province"
    out.mkdir(parents=True, exist_ok=True)
    raw = boundary_file.read_bytes() if boundary_file else fetch(BOUNDARY_URL, 120_000_000)
    original = json.loads(raw)
    assert len(original["features"]) == 1
    feature = original["features"][0]
    geometry = shape(feature["geometry"])
    assert geometry.bounds[0] < -68 and geometry.bounds[1] < -85
    # Select the largest connected Argentine land polygon inside the island viewport.
    # The complete provincial source also contains Antarctica and offshore islands.
    window = box(*REGIONS[0][2])
    island = max((part for part in geometry.geoms if part.intersects(window)), key=lambda part: part.area)
    assert window.covers(island)
    simplified = MultiPolygon([island.simplify(0.004, preserve_topology=True)])
    display_geometry = mapping(simplified)
    display_geometry["coordinates"] = normalize_coordinates(display_geometry["coordinates"])
    boundary = dict(type="FeatureCollection", features=[dict(
        type="Feature", geometry=display_geometry,
        properties=dict(name=feature["properties"]["fna"], source="IGN", code="94", scope="Sector argentino de la Isla Grande de Tierra del Fuego"),
    )])
    (out/"boundary.geojson").write_text(json.dumps(boundary, ensure_ascii=False), encoding="utf8")
    places_url = "https://apis.datos.gob.ar/georef/api/localidades?provincia=94&max=100"
    places_raw = fetch(places_url, 2_000_000)
    places = [
        dict(name=place["nombre"], lat=place["centroide"]["lat"], lon=place["centroide"]["lon"])
        for place in json.loads(places_raw)["localidades"]
        if REGIONS[0][2][0] <= place["centroide"]["lon"] <= REGIONS[0][2][2]
        and REGIONS[0][2][1] <= place["centroide"]["lat"] <= REGIONS[0][2][3]
    ]
    (out/"places.json").write_text(json.dumps(places, ensure_ascii=False), encoding="utf8")
    manifest = dict(
        product="Vista regional de reconocimiento",
        provider="NASA GIBS", layer=LAYER, native_resolution_m=250,
        dates=DATES, projection="EPSG:4326",
        boundary=dict(url=BOUNDARY_URL, raw_sha256=hashlib.sha256(raw).hexdigest(),
                      display_tolerance_degrees=0.004, purpose="Contorno argentino de Isla Grande para orientación",
                      selection="Mayor polígono terrestre conectado dentro del encuadre insular",
                      pole_normalization="Recorte a 90 grados para errores de redondeo menores de 0,000001 grados"),
        places=dict(url=places_url, raw_sha256=hashlib.sha256(places_raw).hexdigest()),
        regions=[], hashes={},
        limits=[
            "Las imágenes diarias pueden contener nubes, sombras y áreas sin observación.",
            "Las vistas regionales no calculan candidatos ni métricas de castores.",
            "Las miniaturas están remuestreadas. El servicio remoto conserva su detalle disponible.",
        ],
    )
    for key, label, bbox in REGIONS:
        frames = []
        for date, suffix in zip(DATES, ("before", "after")):
            params = dict(service="WMS", version="1.1.1", request="GetMap", layers=LAYER,
                          styles="", format="image/jpeg", srs="EPSG:4326",
                          bbox=",".join(map(str, bbox)), width=1200, height=850, time=date)
            url = WMS + "?" + urllib.parse.urlencode(params)
            filename = f"{key}-{suffix}.jpg"
            image = fetch(url, 8_000_000)
            if not image.startswith(b"\xff\xd8"):
                raise ValueError("El proveedor no devolvió un JPEG: " + filename)
            (out/filename).write_bytes(image)
            frames.append(dict(date=date, file=filename, url=url))
            print(filename, len(image), flush=True)
        manifest["regions"].append(dict(id=key, name=label, bbox=bbox, frames=frames))
    files = ["boundary.geojson", "places.json"] + [frame["file"] for region in manifest["regions"] for frame in region["frames"]]
    for filename in files:
        manifest["hashes"][filename] = hashlib.sha256((out/filename).read_bytes()).hexdigest()
    (out/"manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--boundary", type=Path)
    args = parser.parse_args()
    main(args.boundary)
