import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  APPROVED_UPSC_COVERAGE_SOURCE_IDS,
  hasApprovedUpscCoverageSource,
} from "../lib/coverage/sourcePolicy.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const EXPECTED_IDS = [
  "vision",
  "drishti",
  "insights",
  "forum",
  "nextias",
  "vajiram",
  "iasbaba",
];

test("Current Affairs has exactly seven approved UPSC source IDs", () => {
  assert.deepEqual(
    [...APPROVED_UPSC_COVERAGE_SOURCE_IDS],
    EXPECTED_IDS
  );
});

test("approved UPSC sources are recognized by name or canonical domain", () => {
  const samples = [
    ["Vision IAS", "https://visionias.in/current-affairs/"],
    ["Drishti IAS", "https://www.drishtiias.com/daily-updates/daily-news-analysis/example"],
    ["Insights IAS", "https://www.insightsonindia.com/2026/08/17/example/"],
    ["ForumIAS", "https://forumias.com/blog/9-pm-upsc-current-affairs-articles-17-august-2026/"],
    ["NEXT IAS", "https://www.nextias.com/ca/current-affairs/17-08-2026"],
    ["Vajiram & Ravi", "https://vajiramandravi.com/current-affairs/example/"],
    ["IASbaba", "https://iasbaba.com/2026/08/example/"],
  ];

  for (const [source, url] of samples) {
    assert.equal(
      hasApprovedUpscCoverageSource({ source, url }),
      true,
      source
    );
  }
});

test("deprecated exam-coaching sources cannot regain trusted CA status", () => {
  const deprecated = [
    ["GKToday", "https://www.gktoday.in/example/"],
    ["BankersAdda", "https://www.bankersadda.com/example/"],
    ["Oliveboard", "https://www.oliveboard.in/blog/example/"],
    ["AffairsCloud", "https://affairscloud.com/example/"],
    ["Testbook", "https://testbook.com/current-affairs/example"],
  ];

  for (const [source, url] of deprecated) {
    assert.equal(
      hasApprovedUpscCoverageSource({
        source,
        url,
        source_domain: "trusted-coaching-coverage",
      }),
      false,
      source
    );
  }
});

test("all source-policy consumers import the canonical module", () => {
  const collector = read("lib/coverage/queueCoverageImport.js");
  const queue = read("app/api/process-queue/route.js");
  const safety = read("lib/editorial/publicationSafety.js");

  assert.match(collector, /APPROVED_UPSC_COVERAGE_SOURCE_IDS/);
  assert.match(queue, /hasApprovedUpscCoverageSource/);
  assert.match(safety, /hasApprovedUpscCoverageSource/);

  assert.doesNotMatch(
    queue,
    /const APPROVED_UPSC_COVERAGE_SOURCES/
  );
  assert.doesNotMatch(
    safety,
    /TRUSTED_COVERAGE_SOURCE_PATTERN/
  );
});

test("timeout hardening cannot silently re-enable inline CA AI", () => {
  const collector = read("lib/coverage/queueCoverageImport.js");
  assert.match(collector, /const shouldPublishImmediately = false/);
});

test("deprecated CA adapters are not active imports", () => {
  const collector = read("lib/coverage/queueCoverageImport.js");
  for (const token of [
    "fetchGkTodayTopics",
    "fetchBankersAddaTopics",
    "fetchOliveboardTopics",
    "fetchAffairsCloudTopics",
    "fetchTestbookCurrentAffairsTopics",
  ]) {
    assert.doesNotMatch(collector, new RegExp(token));
  }
});
