import test from "node:test";
import assert from "node:assert/strict";
import { filterRelevantMapLocations } from "../lib/study/mapRelevance.js";

test("foreign island headlines cannot default to India", () => {
  const result = filterRelevantMapLocations({
    title: "Hallaniyat Islands threatened by oil spill",
    category: "Environment",
    text: "The Hallaniyat Islands lie off Dhofar in Oman in the Arabian Sea.",
    mapLocations: ["India", "Arabian Sea", "Oman"],
  });
  assert.deepEqual(result, ["Arabian Sea", "Oman"]);
});

test("India remains useful when India is explicitly part of the headline", () => {
  const result = filterRelevantMapLocations({
    title: "India-Oman maritime partnership in the Arabian Sea",
    category: "International Relations",
    text: "Bilateral maritime cooperation and sea-lane security.",
    mapLocations: ["Oman", "Arabian Sea", "India"],
  });
  assert.deepEqual(result, ["Oman", "Arabian Sea", "India"]);
});
