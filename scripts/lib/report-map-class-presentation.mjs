/* Resolves map-only class aliases and the existing report-map legend order. */
export function createReportMapClassPresentation({ classes = {}, maskHa = 0 }) {
  const classFor = (key) => {
    const displayKey = key === 'pool' ? 'water' : key;
    return classes[displayKey] || classes[key] || null;
  };
  const rows = ['green', 'hard', 'building', 'water', 'bare', 'other']
    .filter((key) => key === 'water' ? (classes.water || classes.pool) : classes[key])
    .concat(maskHa > 0 ? ['masked'] : [], ['border', 'point', 'outside']);
  return { classFor, rows };
}
