/* Pure, deterministic report summaries for the approved measurement rows.
 * Monte Carlo estimators are injected so this module owns no random policy.
 */
export function summarizeReportMeasurements(rows, parkAreaM2, { mcTotalCI, mcRowCI }) {
  const ci = mcTotalCI(rows);
  const bySpecies = {};
  for (const row of rows) {
    const group = bySpecies[row.species] ||= {
      n: 0, carbon: 0, dbh: 0, height: 0, group: row.grp, ci: null,
    };
    group.n++;
    group.carbon += +row.carbon_kg;
    group.dbh += +row.dbh_cm;
    group.height += +row.height_m;
  }
  for (const [species, group] of Object.entries(bySpecies))
    group.ci = mcRowCI(rows.find((row) => row.species === species));

  const accuracy = rows.map((row) => +row.accuracy_m).filter((value) => Number.isFinite(value) && value > 0);
  const dates = rows.map((row) => row.created_at).sort();
  return {
    totals: {
      n: rows.length,
      carbon_kg: +rows.reduce((sum, row) => sum + +row.carbon_kg, 0).toFixed(2),
      ci: { mean: +ci.mean.toFixed(2), lo: +ci.lo.toFixed(2), hi: +ci.hi.toFixed(2) },
      per_ha_kg: parkAreaM2 > 0
        ? +(rows.reduce((sum, row) => sum + +row.carbon_kg, 0) / (parkAreaM2 / 10000)).toFixed(2)
        : null,
    },
    species: Object.entries(bySpecies).map(([species, group]) => ({
      species,
      grp: group.group,
      n: group.n,
      mean_dbh: +(group.dbh / group.n).toFixed(1),
      mean_h: +(group.height / group.n).toFixed(1),
      carbon_kg: +group.carbon.toFixed(2),
      share_pct: +(100 * group.carbon / rows.reduce((sum, row) => sum + +row.carbon_kg, 0)).toFixed(1),
    })),
    gps: {
      n: rows.length,
      n_with_acc: accuracy.length,
      n_null_acc: rows.length - accuracy.length,
      mean_acc_m: accuracy.length ? +((accuracy.reduce((sum, value) => sum + value, 0) / accuracy.length)).toFixed(1) : null,
    },
    period: { from: dates[0], to: dates[dates.length - 1] },
    moderation: { approved: rows.length, reviewed: rows.filter((row) => row.reviewed_at).length },
  };
}
