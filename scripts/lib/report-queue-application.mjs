import {createAcceptedSurfacePublisher} from './accepted-surface-publication.mjs';
import {createPublicationRequestHandler} from './report-publication-request.mjs';
import {createReportRetractionHandler} from './report-retraction-workflow.mjs';
import {createReportQueueRunner} from './report-queue-runner.mjs';

export function createReportQueueApplication({root, files, reports, publicationOptions, measureArchive, store, planner, readers, log}) {
  const applyAcceptedSurfaceSnapshot = createAcceptedSurfacePublisher({
    defaultRoot:root, ...files, ...reports
  });
  const handle = createPublicationRequestHandler({
    publishPark:reports.publishPark, publicationOptions, applyAcceptedSurfaceSnapshot, measureArchive
  });
  const handleRetraction = createReportRetractionHandler({
    defaultRoot:root, isReportId:value=>reports.DGR_ID_RE.test(value),
    ...files, renderRetractionNotice:reports.renderRetractionNotice, rebuildIndex:reports.rebuildIndex
  });
  const runQueue = createReportQueueRunner({
    ...store, ...planner, ...readers, handle, handleRetraction, log
  });
  return {applyAcceptedSurfaceSnapshot, handleRetraction, runQueue};
}
