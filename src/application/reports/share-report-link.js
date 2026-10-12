"use strict";

window.DG_SHARE_REPORT_LINK = (() => {
  async function share(reportId, ports) {
    const url = ports.url(reportId);
    if (!url) return ports.invalidLink();
    const title = (ports.parkName ? ports.parkName + " — " : "") + "DendroGeo bilimsel rapor " + reportId;
    const text = title + " · karbon stoku, belirsizlik aralığı ve doğrulama izleri";
    try {
      if (ports.share) {
        await ports.share({ title, text, url });
        return;
      }
    } catch (error) { /* user dismissed share; clipboard remains the fallback */ }
    try {
      await ports.copy(url);
      ports.copied(url);
    } catch (error) {
      ports.prompt(url);
    }
  }

  function open(reportId, ports) {
    const url = ports.url(reportId);
    if (!url) return ports.invalidLink();
    ports.open(url);
  }

  return Object.freeze({ share, open });
})();
