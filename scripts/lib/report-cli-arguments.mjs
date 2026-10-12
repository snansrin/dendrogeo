/* Read the report CLI's existing --name value and presence flags. */
export function createReportCliArguments(argv) {
  return {
    arg(name) {
      const index = argv.indexOf('--' + name);
      return index >= 0 ? argv[index + 1] : null;
    },
    has(name) {
      return argv.includes('--' + name);
    },
  };
}
