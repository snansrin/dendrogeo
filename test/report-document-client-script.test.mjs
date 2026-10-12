import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportDocumentClientScript} from '../scripts/lib/report-document-client-script.mjs';

test('renders the existing print and immutable-snapshot verification behavior',()=>{
 const snapshot={totals:{trees:3},park:{id:5}};
 const shareScript='window.DG_SHARE_READY=true;';
 const script=renderReportDocumentClientScript({hash:'sha256-example',snapshot,shareScript});
 assert.ok(script.includes('window.addEventListener(\'beforeprint\''));
 assert.ok(script.includes('window.addEventListener(\'afterprint\''));
 assert.ok(script.includes('const DG_HASH="sha256-example";'));
 assert.ok(script.includes('const DG_DATA='+JSON.stringify(snapshot)+';'));
 assert.ok(script.includes("crypto.subtle.digest('SHA-256'"));
 assert.ok(script.includes("document.getElementById('dgVerify')"));
 assert.ok(script.endsWith(shareScript));
});
