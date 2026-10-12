/* Bind report-relative reads to the repository root at the report entry point. */
export function createReportRepositoryAccess({moduleUrl, fileURLToPath, dirname, join, readFileSync}) {
  const root = join(dirname(fileURLToPath(moduleUrl)), '..');
  const read = path => readFileSync(join(root, path), 'utf8');
  return {root, read};
}
