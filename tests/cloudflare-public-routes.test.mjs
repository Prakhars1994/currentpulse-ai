import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("OpenNext uses Edge middleware rather than unsupported Next 16 Node proxy", () => {
  assert.equal(fs.existsSync(new URL("../middleware.ts", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../proxy.ts", import.meta.url)), false);
  assert.match(read("middleware.ts"), /export async function middleware/);
});

test("quiz has a bounded database wait and foundation fallback", () => {
  const source = read("app/quiz/page.js");
  assert.match(source, /Promise\.race/);
  assert.match(source, /Quiz query timed out after/);
  assert.match(source, /UPSC_FOUNDATION_FALLBACK/);
});

test("RSS is a short-cached database-backed Worker route", () => {
  assert.equal(fs.existsSync(new URL("../app/feed.xml/route.js", import.meta.url)), true);
  assert.equal(fs.existsSync(new URL("../public/feed.xml", import.meta.url)), false);
  const route = read("app/feed.xml/route.js");
  assert.match(route, /loadNewsArticles/);
  assert.match(route, /loadCurrentAffairsArticles/);
  assert.match(route, /s-maxage=60/);
});
