import type { Feature, Polygon, MultiPolygon } from 'geojson';

export type Candidate = Feature<Polygon | MultiPolygon, {
  id: string; signal: 'agua' | 'vegetacion'; area_m2: number;
  delta_ndwi: number; delta_ndvi: number;
}>;
export type Analysis = {
  id: string;
  label: string;
  beforeUrl: string;
  afterUrl: string;
  features: Candidate[];
  manifest: {
    scenes: string[]; dates: string[]; center: number[];
    common_pixels: number; pixels: number; method_sha256: string;
    bounds_m: number[]; resolution_m: number; size: number;
    [key: string]: unknown;
  };
};
export type CropRequest = { center: [number, number] };
export type Scene = {
  id: string;
  properties: Record<string, unknown> & { datetime: string; 'eo:cloud_cover': number; 'earthsearch:boa_offset_applied': boolean };
  assets: Record<string, { href: string; 'raster:bands'?: { scale: number; offset: number; nodata: number }[] }>;
};
