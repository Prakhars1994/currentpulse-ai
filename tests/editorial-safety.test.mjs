import test from "node:test";
import assert from "node:assert/strict";

import {
  assessCoverageEventness,
  assessNewsCandidate,
  sanitizeEditorialText,
} from "../lib/editorial/publicationSafety.js";
import { correctTaxonomy } from "../lib/contentTaxonomy.js";
import { isSameEvent } from "../lib/news/eventCluster.js";

test("rejects the audited non-event Current Affairs pages", () => {
  const titles = [
    "GUIDE : Indian Economy for UPSC Prelims & Mains Examination",
    "UPSC IAS Interview Preparation – Start Here",
    "Daily Current Affairs Editorials For UPSC Preparation",
    "[RESIDENTIAL] FRC #12 Mains Focus Group Students – Update",
    "Weekly Current Affairs PDF For UPSC",
    "Category: PUBLIC",
    "Constitution of India",
    "International Organizations in News for UPSC IAS Exam",
  ];

  for (const title of titles) {
    assert.equal(
      assessCoverageEventness({
        title,
        summary: "The Government recently announced an update in 2026.",
        publishedAt: "2026-08-10",
        url: "https://example.com/current-affairs",
      }).allowed,
      false,
      title
    );
  }
});

test("ForumIAS accepts only dated 9 PM digest sections", () => {
  const common = {
    title: "Supreme Court Rules on Bail Conditions",
    summary: "The Supreme Court recently ruled on bail conditions in a judgment released in 2026.",
    publishedAt: "2026-08-10",
    source: "ForumIAS",
  };
  assert.equal(
    assessCoverageEventness({ ...common, url: "https://forumias.com/blog/guides/indian-polity/" }).allowed,
    false
  );
  assert.equal(
    assessCoverageEventness({
      ...common,
      url: "https://forumias.com/blog/9-pm-upsc-current-affairs-articles-10-august-2026/#bail-conditions",
    }).allowed,
    true
  );
});

test("trusted CA sources bypass eventness selection while untrusted coverage still requires a trigger", () => {
  assert.equal(
    assessCoverageEventness({
      title: "Constitutional Remedies",
      summary: "The Constitution provides remedies through the Supreme Court and High Courts. This chapter explains their role, structure and jurisdiction in detail.",
      publishedAt: "2026-08-10",
      url: "https://example.com/current-affairs",
    }).allowed,
    false
  );
  assert.equal(
    assessCoverageEventness({
      title: "Epigenetic Inheritance",
      summary: "Why in News: Researchers have identified new evidence on DNA methylation in a study released in 2026.",
      publishedAt: "2026-08-10",
      url: "https://www.drishtiias.com/daily-updates/daily-news-analysis/epigenetic-inheritance",
      source: "Drishti IAS",
    }).allowed,
    true
  );
  assert.equal(
    assessCoverageEventness({
      title: "Lake Mead",
      summary: "Place-in-news notes selected by the Current Affairs publisher for competitive-exam preparation.",
      publishedAt: "2026-08-10",
      url: "https://www.gktoday.in/lake-mead/",
      source: "GKToday",
    }).allowed,
    true
  );
});

test("rejects audited routine and stale News inputs", () => {
  const rejected = [
    "ISRO procurement tender for Low Noise Frequency Distribution Units",
    "Oil India quarterly net profit rises",
    "R Madhavan's post about Finland's education model",
    "US Army National Guard awards corporate supply contract",
    "India and Malta hold Foreign Office Consultations in 2024",
  ];
  for (const title of rejected) {
    assert.equal(assessNewsCandidate({ title, publishedAt: "2026-08-10" }).allowed, false, title);
  }
  assert.equal(
    assessNewsCandidate({ title: "Supreme Court delivers privacy judgment", publishedAt: "2026-08-10" }).allowed,
    true
  );
});

test("hard taxonomy validation corrects the audited classifications", () => {
  assert.deepEqual(
    correctTaxonomy("Epigenetic inheritance and DNA methylation", "Social Issues", "GS-2"),
    { category: "Science & Technology", paper: "GS-3", overridden: true }
  );
  assert.deepEqual(
    correctTaxonomy("Republic of Naoero renaming and diplomatic relations", "Economy", "GS-3"),
    { category: "International Relations", paper: "GS-2", overridden: true }
  );
});

test("clusters the audited rewritten headlines but keeps later/opposite developments", () => {
  const date = "2026-08-10";
  assert.equal(
    isSameEvent(
      { title: "Organ Donation in India", publishedAt: date },
      { title: "Status and Growth of Organ Donation in India", publishedAt: date }
    ),
    true
  );
  assert.equal(
    isSameEvent(
      { title: "Bail Conditions in India", publishedAt: date },
      { title: "Bail Conditions and Judicial Reforms in India", publishedAt: date }
    ),
    true
  );
  assert.equal(
    isSameEvent(
      { title: "Turkey, Saudi Arabia and Pakistan to Sign Joint Defence Agreement", publishedAt: date },
      { title: "Saudi Arabia-Turkey-Pakistan Trilateral Defence Pact: Strategic Implications for Iran and India", publishedAt: date }
    ),
    true
  );
  assert.equal(
    isSameEvent(
      { title: "RBI Cuts Repo Rate", publishedAt: date },
      { title: "RBI Raises Repo Rate", publishedAt: date }
    ),
    false
  );
  assert.equal(
    isSameEvent(
      { title: "Supreme Court Rules on Bail Conditions", publishedAt: "2026-08-01" },
      { title: "Supreme Court Rules on Bail Conditions", publishedAt: date }
    ),
    false
  );
});

test("removes promotional and internal pipeline paragraphs", () => {
  const cleaned = sanitizeEditorialText(
    "Valid source-backed fact.\n\nToppers Wrote 1000 Answers Between Prelims & Mains.\n\nSelection reason: selected by local UPSC scoring.\n\nAnother useful fact."
  );
  assert.equal(cleaned, "Valid source-backed fact.\n\nAnother useful fact.");
});
