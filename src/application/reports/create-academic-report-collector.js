"use strict";

window.DG_CREATE_ACADEMIC_REPORT_COLLECTOR = (() => {
  function create(factory, ports) {
    return factory.createReportPublicationRequestCollector({
      getRequestKey: parkId => {
        const userId = ports.userId();
        return userId ? userId + ":" + parkId : null;
      },
      getProjectName: ports.getProjectName,
      collectContext: ports.collectContext,
      insertRequest: ports.insertRequest,
      onSubmitted: ports.onSubmitted,
    });
  }

  return Object.freeze({ create });
})();
