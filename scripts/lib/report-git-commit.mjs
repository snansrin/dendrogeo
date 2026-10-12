import {execSync} from 'node:child_process';

/* Read the report build's current Git commit using the existing quiet command. */
export function readReportGitCommit(root, run = execSync) {
  return run('git rev-parse HEAD', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}
