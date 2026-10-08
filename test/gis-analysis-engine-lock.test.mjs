import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const PR59 = "05a414563efb799511697678204eb044af9653d8";
const UI_PRESENTATION_ALLOWLIST = [
  "dgSensScanAuditHtml",
  "dgSensRender",
  "dgSensRenderPaintTools",
  "dgSensRenderCurrentReport",
  "dgSensRenderAccepted",
  "dgSensMenuLabel",
  "dgSensToolbarIcon",
  "dgSensPanelHead"
];
const ENGINE_FUNCTIONS = {
  "dgSensGuard": "744a1942d4056cec",
  "dgSensModeAnalysis": "812b5eaf38f40498",
  "dgSensModePark": "9d652e7aa9c4c684",
  "dgSensParkId": "9260b4193b33c356",
  "dgSensCells": "eee17356df8221df",
  "dgSensGroupAreas": "ef9b8ad0c8ec6937",
  "dgSensEditSummary": "6c740944ae7e8fd8",
  "dgSensMeta": "cb6e19d6f182be4b",
  "dgSensScanAudit": "e28f29e3aa7e2219",
  "dgSensVegetationTiers": "9558e21d5392c627",
  "dgSensToggleVegetation": "1f2cde395ee00fa3",
  "dgSensRenderVegetation": "7f0a18be7ecd5895",
  "dgSensHa": "c8201f3a7f1118d8",
  "dgSensNewRecord": "9c381ca94238d19a",
  "dgSensResetScanState": "ddb5f478884fc648",
  "dgSensMigrateOsmObjects": "a3363b5a48fa1fc2",
  "dgSensLoadRecord": "fe6ac3dcc795d866",
  "dgSensSave": "30843d6db429adf6",
  "dgSensDirty": "a3bb5d535b137649",
  "dgSensPredict": "c58c994241ec380a",
  "dgSensCellKey": "1aea6da47d29700b",
  "dgSensHasExplicitWaterBoundary": "43e2099ad236f8af",
  "dgSensWaterOutsideClass": "f4180d20d25f5d82",
  "dgSensWaterOutsideParts": "3b01946429038f33",
  "dgSensWaterBoundaryUnresolved": "b4061a178d1f1c60",
  "dgSensNeedsWaterScan": "e0385fec8e199ce0",
  "dgSensEffective": "118f8ac0a0192fe3",
  "dgSensCandidates": "532d9551a365f760",
  "dgSensMount": "95deb141490e8ece",
  "dgSensParts": "cccdc674de21087c",
  "dgSensLayerClickIsCurrent": "e3364d9b1429090d",
  "dgSensBoundaryGeoJson": "42922f76c4e5c165",
  "dgSensRenderBoundaryLayer": "b9342fdc177d5dd3",
  "dgSensAreas": "55a2e114553147fa",
  "dgSensVisualResult": "578b375abe3bad1f",
  "dgSensAdjusted": "3d8b48937f8986ce",
  "dgSensRememberSection": "25ec3786998f2b75",
  "dgSensOpenMenu": "8d93f96431c848ed",
  "dgSensMenuToggle": "9ca517606db97db6",
  "dgSensCloseMenus": "33ea6fdf72195250",
  "dgSensSetDrawType": "1941de553aadab43",
  "dgSensBrushChoose": "7307bbe13d248ed7",
  "dgSensHandMode": "31306cbc347bc311",
  "dgSensBindRightPan": "e7a69d8351b75ab0",
  "dgSensUnbindRightPan": "33adc7974ed310b5",
  "dgSensOpacity": "15583b0917633961",
  "dgSensUpdateSummary": "d72c29d9536d36f5",
  "dgSensUpdateStatus": "63a18b7da38449ef",
  "dgSensScan": "ad57d3f5eabf4985",
  "dgSensPeriod": "29d6528dbd4bf297",
  "dgSensSlide": "c20515d54b8ff6ac",
  "dgSensFocus": "33b5bdc783c3e315",
  "dgSensToggleCand": "4386d26ae57daa66",
  "dgSensBase": "eaed079a0ae0abe4",
  "dgSensRefreshLayer": "6d110c75c26179e2",
  "dgSensSoftRing": "c79829e0efaf7592",
  "dgSensRepartition": "8b41174c1d53ee92",
  "dgSensPopup": "3a16a55a10ace4cc",
  "dgSensDecide": "cba9f07bc003ff85",
  "dgSensUndo": "de7639fb3398c48e",
  "dgSensBulk": "4aee12e6d93efde3",
  "dgSensAccept": "e45ab442c2db5f35",
  "dgSensReset": "3fa9eea398ff9263",
  "dgSensFindObjectAt": "9df07ee1c2e16268",
  "dgSensObjectPickStart": "9a819441eab61973",
  "dgSensObjectPickAt": "74370569432607a5",
  "dgSensObjectCancel": "cada2a61c37a9ab4",
  "dgSensObjectApply": "ce28bc4285871270",
  "dgSensObjectApplyAndAccept": "00040227d24f0f4e",
  "dgSensDrawStart": "951d3bf57725c4ca",
  "dgSensPointInPark": "9031c9220c0496c6",
  "dgSensDrawPoint": "f617d23aef8873df",
  "dgSensDrawRender": "40cdc4816598cd03",
  "dgSensDrawBack": "5edb611298a75b4b",
  "dgSensDrawCancel": "56a09a4ca62a41c1",
  "dgSensDrawFinish": "b59e98cf1857ea01",
  "dgSensRemoveFeature": "950bb548a9227518",
  "dgSensUndoBoundary": "1f6bc2ec9bd1bf87",
  "dgSensExportGeoJson": "a0fefe0ebfafffaf",
  "dgSensExportPng": "2fa0e91225beeb49",
  "dgSensRenderPng": "5a56b991efc73aa1",
  "dgSensExportCsv": "5aa6f2db6fdb6684",
  "dgSensCleanup": "5bd521d6304c313e",
  "dgSensResultSnapshot": "99715e193c6bbfd8",
  "dgSensAreaBars": "fe82d8c35a03ad25",
  "dgSensFeatures": "f280631a673bc4c8",
  "dgSensObjects": "6dd3283a0eaa1f4c",
  "dgSensRawView": "cc9e9f49dc476cfc",
  "dgSensBrushStop": "912e8cd9162ea7de",
  "dgSensBrushCellKeys": "7c8c35efa88ea0ef",
  "dgSensSetCellDecision": "46af610ad67e8ab5",
  "dgSensPushBrushHistory": "f565a1dbf1468117",
  "dgSensMigrateBrushMasks": "76e1e7d3f643ec2b",
  "dgSensOverlapBounds": "9f3e5c7a98d5207c",
  "dgSensBrushToggle": "0f6ea0e2b924c17b",
  "dgSensBrushCommit": "642b424df7267bd8",
  "dgSensBrushUndo": "b2e8f8415389df66",
  "dgSensBrushConfig": "3363ad9700b6dff1"
};
const SERVICE_BLOBS = {
  "src/services/lc-validate.js": "0a177508090f7f8681ba5594f436851e942376a1",
  "src/services/lc-review.js": "f6e6bc76053da8fd2ef931b61b30bfe125f4678a",
  "src/services/lc-s2.js": "1ecc8be08a898ca4f77efa4c58381584f2a7c5c2",
};

function gitBlobSha(content) {
  return createHash("sha1")
    .update(`blob ${Buffer.byteLength(content)}`)
    .update(Buffer.from([0]))
    .update(content, "utf8")
    .digest("hex");
}

function fnv64(source) {
  let hash = 14695981039346656037n;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= BigInt(source.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, "0");
}

function topLevelFunctions(source) {
  const declarations = [...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)];
  return new Map(declarations.map((declaration, index) => [
    declaration[1],
    source.slice(declaration.index, declarations[index + 1]?.index ?? source.length).trim(),
  ]));
}

test(`GIS analysis services stay byte-identical to PR #59 (${PR59.slice(0, 7)})`, () => {
  for (const [path, expected] of Object.entries(SERVICE_BLOBS)) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.equal(gitBlobSha(source), expected, `${path} changed from PR #59; update only with explicit engine review`);
  }
});

test(`surface analysis logic stays pinned to PR #59; only named presentation functions are editable`, () => {
  const source = readFileSync(new URL("../src/ui/lc-sens.js", import.meta.url), "utf8");
  const functions = topLevelFunctions(source);
  const expectedNames = [...Object.keys(ENGINE_FUNCTIONS), ...UI_PRESENTATION_ALLOWLIST].sort();
  assert.deepEqual([...functions.keys()].sort(), expectedNames, "new, removed, or renamed functions need explicit engine/UI review");

  for (const [name, expected] of Object.entries(ENGINE_FUNCTIONS)) {
    assert.equal(fnv64(functions.get(name)), expected, `${name} changed from PR #59; keep GIS analysis engine locked`);
  }
});
