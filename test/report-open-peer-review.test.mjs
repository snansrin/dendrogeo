import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicPeerReview, peerReviewContributors, renderPublicPeerReview} from '../scripts/lib/report-open-peer-review.mjs';

const id = 'DGR-2026-0026';
const hash = 'a'.repeat(64);
const source = (events, resultHash = 'sha256:' + hash) => ({reportId:id, resultHash, policy:{version:'1.0'}, events});
const baseEvent = {
  eventId:'123e4567-e89b-42d3-a456-426614174000',
  role:'Reviewer',
  eventType:'review',
  publishedAt:'2026-10-16T12:00:00Z',
  public:true,
  text:'Methods are reproducible.',
  identityDisclosure:'open',
  displayName:'Reviewer One',
  orcid:'0000-0002-1825-0097',
  conflictOfInterest:'None declared.'
};

test('public DGR review keeps only explicitly public events and emits roles as contributors',()=>{
  const privateEvent={...baseEvent,eventId:'223e4567-e89b-42d3-a456-426614174000',public:false,displayName:'Private invite'};
  const result=createPublicPeerReview(source([baseEvent,privateEvent]),{id,hash});
  assert.equal(result.events.length,1);
  assert.equal(result.reportId,id);
  assert.equal(result.resultHash,'sha256:'+hash);
  assert.equal(result.events[0].displayName,'Reviewer One');
  assert.equal(result.events[0].orcid,'0000-0002-1825-0097');
  assert.equal(peerReviewContributors(result)[0].contributorType,'Reviewer');
});

test('anonymous review text cannot leak identity fields and editor roles map to DataCite Editor',()=>{
  const event={...baseEvent,eventId:'323e4567-e89b-42d3-a456-426614174000',role:'HandlingEditor',identityDisclosure:'anonymous'};
  const result=createPublicPeerReview(source([event]),{id,hash});
  assert.equal('displayName' in result.events[0],false);
  assert.equal(peerReviewContributors(result).length,0);
  const openEditor={...event,eventId:'423e4567-e89b-42d3-a456-426614174000',identityDisclosure:'open',displayName:'Editor One'};
  assert.equal(peerReviewContributors(createPublicPeerReview(source([openEditor]),{id,hash}))[0].contributorType,'Editor');
});

test('review tied to another report hash or an undisclosed open identity fails closed',()=>{
  assert.throws(()=>createPublicPeerReview(source([baseEvent],'sha256:'+'b'.repeat(64)),{id,hash}),/immutable DGR identity/);
  const noConsent={...baseEvent,displayName:''};
  assert.throws(()=>createPublicPeerReview(source([noConsent]),{id,hash}),/requires consent/);
  const invalidOrcid={...baseEvent,orcid:'not-an-orcid'};
  assert.throws(()=>createPublicPeerReview(source([invalidOrcid]),{id,hash}),/Invalid ORCID/);
});

test('review text is escaped in the public report renderer',()=>{
  const event={...baseEvent,text:'<script>alert(1)</script>'};
  const html=renderPublicPeerReview(createPublicPeerReview(source([event]),{id,hash}),s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/DendroGeo raporuna ait şeffaflık bilgisi/);
});
