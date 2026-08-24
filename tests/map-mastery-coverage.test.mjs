import test from "node:test";
import assert from "node:assert/strict";
import { MAP_MASTERY_DATA, detectMapMasteryTopic } from "../lib/study/mapMastery.js";

test("Map Mastery covers the requested physical-geography current-affairs topics", () => {
  for (const topic of ["deserts", "rivers", "mountains", "volcanoes", "tectonic_plates"]) {
    assert.ok(MAP_MASTERY_DATA[topic]?.india?.length, `${topic} needs Indian locations`);
    assert.ok(MAP_MASTERY_DATA[topic]?.world?.length, `${topic} needs world locations`);
  }
  assert.equal(detectMapMasteryTopic("Why the Thar Desert is expanding"), "deserts");
  assert.equal(detectMapMasteryTopic("Volcanic eruption explained"), "volcanoes");
  assert.equal(detectMapMasteryTopic("Tectonic plate boundary and earthquake risk"), "tectonic_plates");
});
