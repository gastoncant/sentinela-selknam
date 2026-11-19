"""Produce aligned, bounded pilot products from the two frozen Earth Search items."""
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import shapes
from rasterio.transform import from_origin
from rasterio.windows import from_bounds
from rasterio.warp import transform, transform_geom
from rasterio.enums import Resampling

ROOT = Path(__file__).resolve().parent
EPSG = 32719
SIZE = 192
RES = 10
CENTER = (-67.305, -54.555)
THRESHOLD = 0.25
MIN_PIXELS = 4
x, y = transform(4326, EPSG, [CENTER[0]], [CENTER[1]])
GRID = from_origin(math.floor(x[0]/20)*20 - 960, math.floor(y[0]/20)*20 + 960, RES, RES)
BOUNDS = rasterio.transform.array_bounds(SIZE, SIZE, GRID)


def read_scene(item):
    values = {}
    for name in ("green", "red", "nir", "scl"):
        asset = item["assets"][name]
        with rasterio.open(asset["href"]) as ds:
            window = from_bounds(*BOUNDS, transform=ds.transform)
            if ds.crs.to_epsg() != EPSG or ds.window_bounds(window) != BOUNDS:
                raise ValueError("Grilla incompatible")
            if min(window.flatten()) < 0 or window.col_off+window.width > ds.width or window.row_off+window.height > ds.height:
                raise ValueError("Recorte fuera de escena")
            if not all(float(v).is_integer() for v in window.flatten()):
                raise ValueError("Desalineación subpíxel")
            a = ds.read(1, window=window, out_shape=(SIZE, SIZE), resampling=Resampling.nearest)
        if name != "scl":
            meta = asset["raster:bands"][0]
            offset = 0 if item["properties"]["earthsearch:boa_offset_applied"] else meta["offset"]
            a = np.where(a == meta["nodata"], np.nan, a.astype(float)*meta["scale"] + offset)
        values[name] = a
    return values


def index(a, b):
    total = a+b
    return np.divide(a-b, total, out=np.full(a.shape, np.nan), where=np.isfinite(total) & (total > 0))


def measure(scene):
    w = index(scene["green"], scene["nir"])
    v = index(scene["nir"], scene["red"])
    ok = np.isin(scene["scl"], [4, 5, 6]) & np.isfinite(w) & np.isfinite(v)
    return w, v, ok


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(out):
    out.mkdir(parents=True, exist_ok=True)
    items = [json.loads((ROOT/"sources"/f"{year}.json").read_text(encoding="utf-8-sig")) for year in (2020, 2026)]
    scenes = [read_scene(item) for item in items]
    (w0,v0,ok0),(w1,v1,ok1) = map(measure, scenes)
    common = ok0 & ok1
    water = common & (w1-w0 >= THRESHOLD)
    veg = common & (v0-v1 >= THRESHOLD)
    features = []
    layers = []
    for kind, mask in (("agua", water), ("vegetacion", veg)):
        kept = np.zeros_like(mask)
        for geom, _ in shapes(mask.astype("uint8"), mask=mask, transform=GRID):
            cells = rasterio.features.geometry_mask([geom], mask.shape, GRID, invert=True)
            count = int(cells.sum())
            if count < MIN_PIXELS:
                continue
            kept |= cells
            rows, cols = np.where(cells)
            box = [round(n*100/SIZE,3) for n in (cols.min(),rows.min(),cols.max()-cols.min()+1,rows.max()-rows.min()+1)]
            features.append(dict(type="Feature", geometry=transform_geom(EPSG, 4326, geom),
                properties=dict(id=f"{kind}-{len(features)+1}", signal=kind, area_m2=count*100, box_pct=box,
                delta_ndwi=round(float((w1-w0)[cells].mean()),4), delta_ndvi=round(float((v1-v0)[cells].mean()),4))))
        layers.append(kept)
    overlay = np.zeros((SIZE,SIZE,4), dtype="uint8")
    overlay[layers[0]] = [25,185,255,220]
    overlay[layers[1]] = [255,162,40,220]
    overlay[layers[0]&layers[1]] = [219,98,222,255]
    Image.fromarray(overlay).save(out/"signals.png")
    for label, scene in zip(("before","after"), scenes):
        rgb = np.stack([scene[k] for k in ("nir","red","green")],axis=-1)
        frame = np.nan_to_num(np.clip(rgb/0.4,0,1)*255).astype("uint8")
        frame[~common] = [85,85,85]
        Image.fromarray(frame).save(out/f"{label}.png")
    (out/"candidates.geojson").write_text(json.dumps(dict(type="FeatureCollection",features=features)),encoding="utf-8")
    manifest = dict(center=CENTER, crs=EPSG, bounds_m=BOUNDS, size=SIZE,resolution_m=RES,
        threshold=THRESHOLD,min_pixels=MIN_PIXELS,common_pixels=int(common.sum()),pixels=SIZE**2,
        scenes=[i["id"] for i in items],dates=[i["properties"]["datetime"] for i in items],
        source_hashes=[digest(ROOT/"sources"/f"{y}.json") for y in (2020,2026)],
        method_sha256=digest(Path(__file__)),count=len(features),
        hashes={n:digest(out/n) for n in ("before.png","after.png","signals.png","candidates.geojson")})
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print(json.dumps(manifest))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python process_pilot.py DIRECTORIO")
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT="25",GDAL_HTTP_MAX_RETRY="2"):
        build(Path(sys.argv[1]))

