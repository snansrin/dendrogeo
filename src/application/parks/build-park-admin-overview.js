"use strict";

/* Build park-admin counts, visible rows, duplicate groups, and unnamed rows. */
function dgBuildParkAdminOverview({ rows, projects, measurements, showEmpty, normalizeLoose, normalizeName }) {
  const projByPark = {}, measByPark = {};
  (projects || []).forEach(project => {
    if (project.park_id) projByPark[project.park_id] = (projByPark[project.park_id] || 0) + 1;
  });
  (measurements || []).forEach(measurement => {
    if (measurement.park_id) measByPark[measurement.park_id] = (measByPark[measurement.park_id] || 0) + 1;
  });
  const isEmpty = park => !(projByPark[park.id] > 0) && !(measByPark[park.id] > 0);
  const emptyRows = rows.filter(isEmpty);
  const shown = rows.filter(park => !isEmpty(park) || showEmpty);
  const byName = {};
  shown.forEach(park => {
    const key = normalizeLoose(park.name) || ("#" + park.id);
    (byName[key] = byName[key] || []).push(park);
  });
  const dupGroups = Object.values(byName).filter(group => group.length > 1);
  const unnamed = shown.filter(park => !park.name || normalizeName(park.name).indexOf("isimsiz") === 0);
  return { projByPark, measByPark, emptyRows, shown, dupGroups, unnamed };
}

window.DG_PARK_ADMIN_OVERVIEW = Object.freeze({ build: dgBuildParkAdminOverview });
