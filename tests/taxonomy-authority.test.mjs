import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const qualityRepair = fs.readFileSync(
  new URL("../app/api/quality-repair/route.js", import.meta.url),
  "utf8"
);
const editorialCleanup = fs.readFileSync(
  new URL("../app/api/editorial-cleanup/route.js", import.meta.url),
  "utf8"
);

test("editorial cleanup is the single taxonomy mutation owner", () => {
  assert.match(editorialCleanup, /correctTaxonomy\(/);
  assert.doesNotMatch(qualityRepair, /classifyCategoryWithConfidence/);
  assert.doesNotMatch(qualityRepair, /resolvePaper\(/);
  assert.doesNotMatch(qualityRepair, /values\.category\s*=/);
});

test("quality repair still owns quality and map repairs", () => {
  assert.match(qualityRepair, /assessArticleQuality\(/);
  assert.match(qualityRepair, /filterRelevantMapLocations\(/);
  assert.match(qualityRepair, /quarantine_quality_floor/);
});
