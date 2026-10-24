// Isolated research draft. No engine, map, storage, network or global state.
import {createHash} from 'node:crypto';

export const geometryDigest = geometry => createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);}
  return value;
};
function structuralGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  return Array.isArray(polygons) && polygons.length > 0 && polygons.every(p => Array.isArray(p) && p.length > 0 && p.every(ring => {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    const positions = ring.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90);
    if (!positions || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return false;
    return new Set(ring.slice(0,-1).map(p => JSON.stringify(p))).size >= 3;
  }));
}
function eligible(section) {
  const review = section.review;
  return section.boundaryStatus === 'verified' && structuralGeometry(section.geometry) &&
    typeof review?.reviewer === 'string' && !!review.reviewer.trim() &&
    typeof review?.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)) &&
    review?.topology === 'validated' && /^https:\/\//.test(section.boundarySource?.url || '') &&
    !!section.boundarySource?.version && !!section.boundarySource?.license &&
    review.geometrySha256 === geometryDigest(section.geometry);
}
export function describeScope(catalog, parkKey) {
  if (!Array.isArray(catalog?.groups)) return freeze({parkKey, status:'invalid-catalog', sections:[]});
  const matches = catalog.groups.filter(g => Array.isArray(g?.parkKeys) && g.parkKeys.includes(parkKey));
  if (matches.length !== 1) return freeze({parkKey, status:matches.length ? 'ambiguous-identity' : 'unlinked', sections:[]});
  const group = matches[0];
  if (!group.id || catalog.groups.filter(g => g?.id === group.id).length !== 1 ||
    !Array.isArray(group.sections) || !Array.isArray(group.sources) ||
    group.sections.some(s => !s?.id || !s.name || !group.sources.some(source => source.id === s.nameSource)) ||
    new Set(group.sections.map(s => s.id)).size !== group.sections.length) {
    return freeze({parkKey, status:'invalid-catalog', sections:[]});
  }
  return freeze({parkKey, groupId:group.id, name:group.name, revision:catalog.revision, status:'names-evidenced', sections:group.sections.map(s => ({
    id:s.id, name:s.name, boundaryStatus:s.boundaryStatus, selectable:eligible(s), nameSource:s.nameSource
  }))});
}
export function selectStageDraft({catalog, parkKey, sectionIds = [], enabled = false}) {
  const reject = reason => freeze({ok:false, reason, analysisEnabled:false});
  // The default is the original scope. Do not even resolve experimental data.
  if (!enabled) return freeze({ok:true, kind:'existing-scope', analysisEnabled:false});
  const scope = describeScope(catalog, parkKey);
  if (!scope.groupId) return reject(scope.status);
  if (!Array.isArray(sectionIds) || !sectionIds.length) return reject('empty-selection');
  if (new Set(sectionIds).size !== sectionIds.length) return reject('duplicate-selection');
  const group = catalog.groups.find(g => g.id === scope.groupId);
  const selected = sectionIds.map(id => group.sections.find(s => s.id === id));
  if (selected.some(s => !s)) return reject('unknown-section');
  if (selected.some(s => !eligible(s))) return reject('boundary-not-verified');
  // Concatenation cannot safely union overlaps. Multi-selection waits for a
  // separately tested union adapter; never use bbox/hull or silently double count.
  if (selected.length !== 1) return reject('union-not-implemented');
  const section = selected[0];
  return freeze({ok:true, kind:'stage-preview', analysisEnabled:false, parkKey,
    groupId:group.id, sectionIds:[section.id], catalogRevision:catalog.revision,
    geometry:clone(section.geometry), geometrySha256:geometryDigest(section.geometry),
    boundarySource:clone(section.boundarySource), review:clone(section.review)});
}
