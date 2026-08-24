import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

test("Hindi Current Affairs uses a separate durable language field and archive", () => {
  const migration = read("supabase/migrations/20260824135419_add_article_language.sql");
  const route = read("app/api/admin/pdf-import/publish/route.js");
  const page = read("app/current-affairs/hindi/page.js");
  assert.match(migration, /add column if not exists language text not null default 'en'/);
  assert.match(migration, /language in \('en', 'hi'\)/);
  assert.match(route, /language: stream === "ca_hi" \? "hi" : "en"/);
  assert.match(page, /language: "hi"/);
  assert.match(page, /हिंदी करेंट अफेयर्स/);
});
