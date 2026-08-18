import test from "node:test";
import assert from "node:assert/strict";
import {
  isRecoverableCoverageFallback,
  isRecoverableNewsEntailmentRejection,
  recoveredCoverageFlags,
} from "../lib/automation/pipelineRecoveryPolicy.js";

test("recovers only the known News field-boundary entailment regression", () => {
  assert.equal(isRecoverableNewsEntailmentRejection({
    pipeline_kind: "news",
    status: "rejected",
    error: "PUBLICATION_BLOCKED: unsupported_named_entities: Generated News introduced multiple named entities: Reuters Verified, Reuters Essential.",
  }), true);
  assert.equal(isRecoverableNewsEntailmentRejection({
    pipeline_kind: "news",
    status: "rejected",
    error: "PUBLICATION_BLOCKED: unsupported_named_entities: Imaginary Agency, Fake Ministry.",
  }), false);
});

test("recovers a source-grounded CA draft only after the aligned quality gate passes", () => {
  const article = { quality_flags: ["source_grounded_fallback", "quarantined_quality_floor_v4"] };
  const quality = { passed: true, score: 86, flags: ["prelims_too_long"] };
  assert.equal(isRecoverableCoverageFallback(article, quality), true);
  const flags = recoveredCoverageFlags(article, quality);
  assert.ok(flags.includes("source_grounded_fallback"));
  assert.ok(flags.includes("recovered_after_quality_gate_alignment"));
  assert.equal(flags.includes("quarantined_quality_floor_v4"), false);
});