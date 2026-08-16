import test from "node:test";
import assert from "node:assert/strict";
import { correctTaxonomy } from "../lib/contentTaxonomy.js";

test("military exercises stay in Defence & Security", () => {
  const result = correctTaxonomy(
    "Exercise Pitch Black 2026 is a multinational air exercise involving air forces and Indo-Pacific security cooperation.",
    "International Relations",
    "GS-2"
  );
  assert.equal(result.category, "Defence & Security");
  assert.equal(result.paper, "GS-3");
});

test("handloom heritage stays in History & Culture", () => {
  const result = correctTaxonomy(
    "National Handloom Day highlights India's handloom heritage, traditional weaving and artisan traditions.",
    "International Relations",
    "GS-2"
  );
  assert.equal(result.category, "History & Culture");
  assert.equal(result.paper, "GS-1");
});

test("NOTTO organ-transplant portals stay in Social Issues", () => {
  const result = correctTaxonomy(
    "NOTTO launches the e-Pratyaropan portal for organ transplantation and organ donation governance.",
    "Science & Technology",
    "GS-3"
  );
  assert.equal(result.category, "Social Issues");
  assert.equal(result.paper, "GS-2");
});
