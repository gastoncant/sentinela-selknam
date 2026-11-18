import type { Candidate, Review } from './crop-types';

export type ReviewOrder = 'area' | 'intensity' | 'number';

const zoneNumber = (zone: Candidate) => Number(zone.properties.id.split('-').pop());
const intensity = ({ properties }: Candidate) => properties.signal === 'agua' ? properties.delta_ndwi : -properties.delta_ndvi;

export function reviewQueue(features: Candidate[], reviews: Review[], signal: string, order: ReviewOrder, pendingOnly: boolean) {
  const reviewed = new Set(reviews.map(review => review.candidate_id));
  const matching = features.filter(({ properties }) =>
    (signal === 'todas' || properties.signal === signal) && (!pendingOnly || !reviewed.has(properties.id)));
  return matching.sort((a, b) => {
    if (order === 'number') return zoneNumber(a) - zoneNumber(b);
    const difference = order === 'intensity' ? intensity(b) - intensity(a) : b.properties.area_m2 - a.properties.area_m2;
    return difference || zoneNumber(a) - zoneNumber(b);
  });
}
