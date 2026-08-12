import assert from "node:assert/strict";
import { EXAM_OFFICIAL_SOURCES } from "../lib/exams/sourceCatalog.js";
import { EXAM_UPDATE_TYPES } from "../lib/exams/constants.js";

assert.ok(EXAM_OFFICIAL_SOURCES.length >= 10, "ResultPulse should start with at least 10 official source pages");
assert.equal(new Set(EXAM_OFFICIAL_SOURCES.map((source) => source.id)).size, EXAM_OFFICIAL_SOURCES.length, "ResultPulse source ids must be unique");
for (const source of EXAM_OFFICIAL_SOURCES) {
  assert.match(source.url, /^https:\/\//, `${source.id} must use HTTPS`);
  assert.ok(source.name && source.agency, `${source.id} must identify its authority`);
}
for (const required of ["result","admit-card","notification","answer-key","application","deadline","exam-date","cut-off","counselling"]) {
  assert.ok(EXAM_UPDATE_TYPES.includes(required), `Missing exam update type: ${required}`);
}
console.log(`ResultPulse smoke: PASS (${EXAM_OFFICIAL_SOURCES.length} official source pages, ${EXAM_UPDATE_TYPES.length} update types)`);
