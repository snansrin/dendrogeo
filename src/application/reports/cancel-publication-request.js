"use strict";

window.DG_CANCEL_PUBLICATION_REQUEST = (() => {
  async function execute(ports) {
    if (!ports.canCancel()) return ports.onDenied();
    if (!ports.confirm()) return;
    const { error } = await ports.cancel();
    if (error) return ports.onFailure(error);
    return await ports.onSuccess();
  }

  return Object.freeze({ execute });
})();
