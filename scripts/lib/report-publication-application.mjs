import {createReportArtifactWriter} from './report-artifact-writer.mjs';
import {createParkReportPublisher} from './park-report-publication.mjs';
import {createReportCli} from './report-cli.mjs';

export function createReportPublicationApplication({artifacts, publication, cli}) {
  const writeReportArtifacts = createReportArtifactWriter(artifacts);
  const publishPark = createParkReportPublisher({...publication, writeReportArtifacts});
  const main = createReportCli({...cli, publishPark});
  return {publishPark, main};
}
