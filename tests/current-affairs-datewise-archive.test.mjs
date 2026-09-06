import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Current Affairs archive selects a published IST date in the URL", () => {
  const page = read("app/current-affairs/page.js");
  assert.match(page, /name="date"/);
  assert.match(page, /loadCurrentAffairsDatePage\(\{ date/);
  assert.match(page, /loadCurrentAffairsDates/);
  assert.match(page, /Select date/);
  assert.match(page, /No Current Affairs published for/);
});

test("Current Affairs date queries use published_at with an IST range", () => {
  const streams = read("lib/articleStreams.js");
  const dates = read("lib/study/digestDates.js");
  assert.match(streams, /\.gte\("published_at", range\.start\)/);
  assert.match(streams, /\.lt\("published_at", range\.end\)/);
  assert.match(streams, /\.order\("published_at"/);
  assert.match(dates, /T00:00:00\$\{IST_OFFSET\}/);
});

test("homepage does not render operational freshness counters", () => {
  const hero = read("components/Hero.tsx");
  assert.doesNotMatch(hero, /Today CA|Today News|Last updated IST|freshness score|freshness status/i);
  assert.match(hero, /Latest Current Affairs/);
  assert.match(hero, /Browse by Date/);
});

test("daily quiz generation uses the latest published Current Affairs date", () => {
  const quiz = read("lib/quiz/generateDailyQuiz.js");
  assert.match(quiz, /loadCurrentAffairsDates\(\{ limit: 1 \}\)/);
  assert.match(quiz, /loadCurrentAffairsDatePage\(\{ date: quizDate/);
});
