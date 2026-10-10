import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../src/application/parks/grid-session-state.js',import.meta.url),'utf8'),c);
const create=c.window.DG_GRID_SESSION_STATE.create;
test('invalidation makes pending epochs stale and clears accepted metadata without discarding renderer',()=>{const s=create(),renderer={};const epoch=s.nextEpoch();s.setSource('signature');s.setMeta('summary');s.setRenderer(renderer);assert.equal(s.invalidate(),epoch+1);assert.notEqual(s.getEpoch(),epoch);assert.equal(s.getSource(),null);assert.equal(s.getMeta(),'');assert.equal(s.getRenderer(),renderer);assert.equal(s.invalidate(),epoch+2);});
test('separate grid sessions cannot alter each other and preserve source identity',()=>{const a=create(),b=create(),source={};a.nextEpoch();a.setSource(source);a.setMeta('accepted');assert.equal(a.getSource(),source);assert.equal(b.getEpoch(),0);assert.equal(b.getMeta(),'');assert.equal(b.getSource(),null);b.invalidate();assert.equal(a.getMeta(),'accepted');assert.equal(a.getSource(),source);});
