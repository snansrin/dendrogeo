"use strict";

window.DG_REQUEST_PUBLICATION = (() => {
  async function execute(parkId, includeLandCover, ports) {
    const result = await ports.collect(parkId, includeLandCover);
    if (!result) return;
    if (result.ok) return await ports.onSuccess();
    return ports.onFailure(result);
  }

  return Object.freeze({ execute });
})();
