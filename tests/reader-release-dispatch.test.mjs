import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ReaderReleaseError, readerReleaseAdminMessage, readerReleaseReason } from "../lib/publisher/readerReleaseResult.js";
import { dispatchReaderRelease } from "../lib/publisher/dispatchReaderRelease.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dispatch = read("lib/publisher/requestReaderRelease.js");
const route = read("app/api/admin/exam-pdfs/route.js");
const refresh = read("app/api/admin/exam-pdfs/refresh/route.js");
const workspace = read("components/admin/ExamPdfWorkspace.jsx");
const planner = read("scripts/public-release-paths.mjs");
const pdfPage = read("app/pdf/page.js");

test("safe reader-release reasons cover missing token and GitHub failures", () => {
  assert.equal(readerReleaseReason(new ReaderReleaseError("token_missing")), "token_missing");
  for (const status of [403, 422]) assert.equal(readerReleaseReason(new ReaderReleaseError(`github_${status}`, status)), `github_${status}`);
  assert.equal(readerReleaseReason(new Error("secret token text")), "network_error");
});

test("Admin diagnostics are actionable and never include sensitive values", () => {
  assert.match(readerReleaseAdminMessage("github_403"), /permission/i);
  assert.match(readerReleaseAdminMessage("github_422"), /inputs/i);
  assert.match(readerReleaseAdminMessage("token_missing"), /not configured/i);
  for (const reason of ["github_403", "github_422", "token_missing", "network_error"]) {
    assert.doesNotMatch(readerReleaseAdminMessage(reason), /Bearer|Authorization|GITHUB_READER_RELEASE_TOKEN=/i);
  }
  assert.match(workspace, /readerReleaseAdminMessage/);
});

test("dispatch treats successful 204 as queued and sends workflow inputs as strings", async () => {
  let body;
  await dispatchReaderRelease({ token: "test-token", owner: "owner", repository: "repo", articleId: 7, stream: "pdf", fetchImpl: async (_url, options) => { body = JSON.parse(options.body); return { ok: true, status: 204 }; } });
  assert.equal(body.inputs.full, "false");
  assert.match(dispatch, /recentlyQueued\.set/);
  assert.match(dispatch, /return \{ queued: true, durable: outbox\.durable, deduplicated: false \}/);
});

test("dispatch classifies missing tokens, GitHub 403, GitHub 422, and network errors", async () => {
  const base = { owner: "owner", repository: "repo", articleId: 7, stream: "pdf" };
  await assert.rejects(dispatchReaderRelease({ ...base, token: "" }), (error) => error.reason === "token_missing");
  for (const status of [403, 422]) {
    await assert.rejects(dispatchReaderRelease({ ...base, token: "test-token", fetchImpl: async () => ({ ok: false, status }) }), (error) => error.reason === `github_${status}`);
  }
  await assert.rejects(dispatchReaderRelease({ ...base, token: "test-token", fetchImpl: async () => { throw new Error("secret details"); } }), (error) => error.reason === "network_error" && !error.message.includes("secret details"));
});

test("publication stays successful when dispatch fails and reports a safe reason", () => {
  assert.match(route, /readerRefresh = \{ queued: false, durable: Boolean\(error\?\.durable\), reason: readerReleaseReason\(error\) \}/);
  assert.match(route, /success: true, releaseQueued, readerRefresh/);
  assert.match(route, /releaseQueued = true/);
  assert.doesNotMatch(route, /Authorization|Bearer/);
});

test("authenticated retry only queues the PDF reader release", () => {
  assert.match(refresh, /requireAuthenticatedAdmin/);
  assert.match(refresh, /stream: "pdf"/);
  assert.match(refresh, /success: true, releaseQueued: false/);
});

test("exam_pdfs changes include the public PDF path", () => {
  assert.match(planner, /optionalChangedRows\("exam_pdfs"/);
  assert.match(planner, /if \(changedExamPdfs\.length\) paths\.add\("\/pdf"\)/);
  assert.match(pdfPage, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(pdfPage, /export const revalidate/);
});
