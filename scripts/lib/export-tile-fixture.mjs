/* Deterministic basemap image; no external network or account access. */
export async function mockExportTiles(page,{solid=false}={}){
 const body=Buffer.from(await page.evaluate(solid=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#86b6a8';g.fillRect(0,0,256,256);if(!solid){g.fillStyle='#c8d8c0';g.fillRect(0,0,128,128);g.fillRect(128,128,128,128);}return c.toDataURL('image/png').split(',')[1];},solid),'base64');
 await page.route(/^https:\/\/(?:[abc]\.tile\.(?:openstreetmap|opentopomap)\.org|server\.arcgisonline\.com)\//,route=>route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body}));
}
