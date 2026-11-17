import unittest
import json
from pathlib import Path
import numpy as np
from rasterio.features import rasterize
from rasterio.warp import transform_geom
from process_pilot import measure, index, GRID, EPSG, SIZE


class SpectralTests(unittest.TestCase):
    def test_indices(self):
        scene=dict(green=np.array([0.3]),nir=np.array([0.1]),red=np.array([0.05]),scl=np.array([6]))
        w,v,good=measure(scene)
        self.assertAlmostEqual(w.item(),0.5)
        self.assertAlmostEqual(v.item(),1/3)
        self.assertTrue(good.item())

    def test_zero_nodata(self):
        self.assertTrue(np.isnan(index(np.array([0.,np.nan]),np.array([0.,1.]))).all())

    def test_common_mask(self):
        scene={k:np.array([0.2,0.1,0.3]) for k in ("green","red","nir")}
        before=measure(dict(**scene,scl=np.array([4,8,11])))[2]
        after=measure(dict(**scene,scl=np.array([3,6,5])))[2]
        self.assertFalse((before & after).any())

    def test_exported_geometry_round_trip(self):
        root = Path(__file__).resolve().parent/"pilot"
        features = json.loads((root/"candidates.geojson").read_bytes())["features"]
        for signal in ("agua","vegetacion"):
            group = [f for f in features if f["properties"]["signal"] == signal]
            pixels = rasterize([(transform_geom(4326,EPSG,f["geometry"]),i+1) for i,f in enumerate(group)],
                               out_shape=(SIZE,SIZE), transform=GRID,dtype="int32")
            counts = np.bincount(pixels.ravel(),minlength=len(group)+1)[1:]
            self.assertEqual((counts*100).tolist(),[f["properties"]["area_m2"] for f in group])

