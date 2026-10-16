import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=path=>readFileSync(join(root,path),'utf8');

test('Python research client is a dependency-free installable package with tests',()=>{
  const pyproject=read('clients/python/pyproject.toml');
  assert.match(pyproject,/name = "dendrogeo-client"/);
  assert.match(pyproject,/dependencies = \[\]/);
  assert.match(pyproject,/license = "MIT"/);
  assert.match(read('clients/python/src/dendrogeo_client/client.py'),/SHA-256 mismatch/);
  assert.match(read('clients/python/src/dendrogeo_client/client.py'),/DGR-\[0-9\]/);
  assert.ok(existsSync(join(root,'clients/python/LICENSE')));
  assert.ok(existsSync(join(root,'clients/python/tests/test_client.py')));
});

test('R research client follows an R package layout and checks manifest hashes',()=>{
  const description=read('clients/r/dendrogeo/DESCRIPTION');
  assert.match(description,/^Package: dendrogeo$/m);
  assert.match(description,/^License: MIT \+ file LICENSE$/m);
  assert.match(read('clients/r/dendrogeo/R/client.R'),/SHA-256 mismatch/);
  assert.ok(existsSync(join(root,'clients/r/dendrogeo/tests/testthat/test-validation.R')));
});

test('JOSS draft contains current required substantive sections and marks author confirmations',()=>{
  const paper=read('papers/joss/paper.md');
  for(const heading of ['Summary','Statement of need','State of the field','Software design','Research impact statement','AI usage disclosure','Acknowledgements','References']) {
    assert.ok(paper.includes('# '+heading),'Missing JOSS section: '+heading);
  }
  assert.match(paper,/Institution and department to confirm/);
  assert.match(paper,/No external adoption or peer-reviewed publication/);
});

test('Scientific Data draft has Data Descriptor sections and does not invent a DOI',()=>{
  const paper=read('papers/scientific-data/data-descriptor.md');
  for(const heading of ['Background & Summary','Methods','Data Records','Technical Validation','Data Availability','Code Availability','Author Contributions','Competing Interests','Funding','References']) {
    assert.ok(paper.includes('## '+heading),'Missing Data Descriptor section: '+heading);
  }
  assert.match(paper,/internal working draft/);
  assert.match(paper,/repository.*Deposit|deposit.*repository/is);
  assert.match(paper,/must not be cited as one/);
});

test('open-review schema, policy, and tests are present and publication is opt-in',()=>{
  const schema=JSON.parse(read('docs/schemas/dgr-open-peer-review-v1.schema.json'));
  assert.equal(schema.properties.schema.const,'dendrogeo-open-peer-review/1');
  assert.deepEqual(schema.properties.events.items.properties.public.const,true);
  assert.match(read('docs/dgr-open-peer-review.md'),/does not imply journal review/);
  assert.match(read('scripts/lib/report-document-composition.mjs'),/renderPublicPeerReview/);
  assert.match(read('scripts/lib/report-metadata.mjs'),/peerReviewContributors/);
});

